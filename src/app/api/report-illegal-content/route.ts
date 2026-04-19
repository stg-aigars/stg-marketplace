import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { applyRateLimit, reportIllegalContentLimiter } from '@/lib/rate-limit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';
import { logAuditEvent } from '@/lib/services/audit';
import { LEGAL_ENTITY_EMAIL } from '@/lib/constants';

const VALID_CATEGORIES = new Set([
  'counterfeit',
  'ip_infringement',
  'illegal_goods',
  'csam',
  'hate_or_harassment',
  'other',
]);

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

  void logAuditEvent({
    actorType: notifierEmail ? 'user' : 'system',
    action: 'illegal_content.reported',
    resourceType: 'notice',
    metadata: {
      category,
      anonymous: !notifierEmail,
      contentReferencePreview: contentReference.slice(0, 200),
    },
  });

  return NextResponse.json({ success: true });
}
