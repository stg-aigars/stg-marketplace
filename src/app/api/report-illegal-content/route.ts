import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { applyRateLimit, reportIllegalContentLimiter } from '@/lib/rate-limit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';
import { logAuditEvent } from '@/lib/services/audit';
import { notifyStaff } from '@/lib/notifications';
import { createServiceClient } from '@/lib/supabase';
import { LEGAL_ENTITY_EMAIL } from '@/lib/constants';
import { REPORT_CATEGORY_VALUES } from '@/app/[locale]/report-illegal-content/categories';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_CATEGORIES = new Set<string>(REPORT_CATEGORY_VALUES);

const MAX_FIELD = {
  contentReference: 2000,
  explanation: 5000,
  notifierName: 200,
  notifierEmail: 200,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resend = new Resend(env.resend.apiKey);

interface Payload {
  contentReference: unknown;
  category: unknown;
  explanation: unknown;
  notifierName: unknown;
  notifierEmail: unknown;
  accuracyConfirmed: unknown;
  turnstileToken: unknown;
  // Optional: when the notice is filed against a specific listing, the listing
  // detail page passes this UUID so the staff queue can deep-link.
  listingId?: unknown;
}

export async function POST(request: Request) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const rateLimitError = applyRateLimit(reportIllegalContentLimiter, request);
  if (rateLimitError) return rateLimitError;

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const turnstile = await verifyTurnstileToken(
    typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined,
    getClientIp(request),
  );
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 400 });
  }

  const contentReference = String(body.contentReference ?? '').trim();
  const category = String(body.category ?? '').trim();
  const explanation = String(body.explanation ?? '').trim();
  const notifierName = String(body.notifierName ?? '').trim();
  const notifierEmail = String(body.notifierEmail ?? '').trim().toLowerCase();
  const accuracyConfirmed = body.accuracyConfirmed === true;

  if (!contentReference || contentReference.length > MAX_FIELD.contentReference) {
    return NextResponse.json({ error: 'Content reference is required' }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Please pick a category' }, { status: 400 });
  }
  if (!explanation || explanation.length > MAX_FIELD.explanation) {
    return NextResponse.json({ error: 'Explanation is required' }, { status: 400 });
  }
  if (!accuracyConfirmed) {
    return NextResponse.json(
      { error: 'Please confirm your information is accurate' },
      { status: 400 },
    );
  }

  // CSAM notices may be anonymous; all other categories require name + valid email.
  if (category !== 'csam') {
    if (!notifierName || notifierName.length > MAX_FIELD.notifierName) {
      return NextResponse.json({ error: 'Your name is required' }, { status: 400 });
    }
    if (!notifierEmail || !EMAIL_REGEX.test(notifierEmail) || notifierEmail.length > MAX_FIELD.notifierEmail) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
  }

  // Optional listing binding — only persisted if the caller passed a syntactically valid UUID;
  // we do not verify FK existence here (the FK is `on delete set null` so a stale ID is harmless).
  const listingId =
    typeof body.listingId === 'string' && UUID_REGEX.test(body.listingId) ? body.listingId : null;

  // Forward the notice to our legal mailbox. Keep the body plain text — staff will review
  // and triage manually at launch volume; queueing + review UI land when volume warrants.
  const lines = [
    `Category: ${category}`,
    `Content: ${contentReference}`,
    `Notifier: ${notifierName || '(anonymous, CSAM)'}`,
    `Reply-to: ${notifierEmail || '(anonymous, CSAM)'}`,
    `Accuracy confirmed: ${accuracyConfirmed}`,
    '',
    'Explanation:',
    explanation,
  ];

  try {
    await resend.emails.send({
      from: `Second Turn Games <${env.resend.fromEmail}>`,
      to: LEGAL_ENTITY_EMAIL,
      replyTo: notifierEmail || undefined,
      subject: `[DSA Art. 16 notice] ${category} — ${contentReference.slice(0, 80)}`,
      text: lines.join('\n'),
    });
  } catch (err) {
    console.error('[report-illegal-content] Email send failed:', err);
    return NextResponse.json(
      { error: 'Failed to submit notice. Please try again.' },
      { status: 500 },
    );
  }

  // Persist the notice to the staff review queue (Phase 5 of PTAC plan). The row ID is
  // captured so the audit-log row references the persistent record. If the insert fails,
  // we still ack the email-forward path (the notice already shipped to legal) — staff can
  // reconcile from email if the queue insert dropped.
  let noticeId: string | null = null;
  try {
    const serviceClient = createServiceClient();
    const { data: noticeRow, error: insertError } = await serviceClient
      .from('dsa_notices')
      .insert({
        listing_id: listingId,
        reporter_id: null, // unauthenticated route — no auth.uid() at this point
        reporter_email: notifierEmail || null,
        notifier_name: notifierName || null,
        category,
        content_reference: contentReference,
        explanation,
        reporter_ip: getClientIp(request) || null,
      })
      .select('id')
      .single();
    if (insertError) {
      console.error('[report-illegal-content] dsa_notices insert failed:', insertError.message);
    } else {
      noticeId = noticeRow?.id ?? null;
    }
  } catch (err) {
    console.error('[report-illegal-content] dsa_notices insert unexpected error:', err);
  }

  // actorType: 'system' — the notice is an inbound external submission, not a platform-
  // initiated user action. There is no authenticated actor (even named notifiers are
  // unauthenticated visitors), so 'user' without an actorId would misrepresent the
  // relationship. Reporter identity lives in metadata where it can be queried without
  // conflating with authenticated user-attributed rows.
  void logAuditEvent({
    actorType: 'system',
    action: 'dsa_notice.received',
    resourceType: 'dsa_notice',
    resourceId: noticeId ?? undefined,
    metadata: {
      category,
      anonymous: !notifierEmail,
      notifierEmail: notifierEmail || null,
      contentReferencePreview: contentReference.slice(0, 200),
      listingId,
    },
    retentionClass: 'regulatory',
  });

  // Fan out to staff so the queue is visible without polling. Fire-and-forget.
  void notifyStaff('moderation.notice_received', {
    noticeId: noticeId ?? undefined,
    listingId: listingId ?? undefined,
    category,
    anonymous: !notifierEmail,
  });

  return NextResponse.json({ success: true });
}
