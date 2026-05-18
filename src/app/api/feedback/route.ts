import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { applyRateLimit, feedbackLimiter } from '@/lib/rate-limit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';
import { notifyStaff } from '@/lib/notifications';
import { createServiceClient } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { trackServer } from '@/lib/analytics/track-server';
import { LEGAL_ENTITY_EMAIL } from '@/lib/constants';
import { routing } from '@/i18n/routing';

// No `logAuditEvent` call by design — feedback is operational signal, not
// compliance-relevant. Matches the newsletter-signup precedent. PostHog
// `feedback_submitted` is the volume record.

const CATEGORIES = ['idea', 'bug', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

const MAX = {
  message: 2000,
  contactEmail: 200,
  pageUrl: 1000,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resend = new Resend(env.resend.apiKey);

interface Payload {
  category: unknown;
  message: unknown;
  contactEmail?: unknown;
  pageUrl?: unknown;
  locale?: unknown;
  turnstileToken: unknown;
}

export async function POST(request: Request) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const rateLimitError = applyRateLimit(feedbackLimiter, request);
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

  const category = String(body.category ?? '').trim();
  if (!CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: 'Please pick a category' }, { status: 400 });
  }

  const message = String(body.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ error: 'Please write a message' }, { status: 400 });
  }
  if (message.length > MAX.message) {
    return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
  }

  // contactEmail flows into the Resend `replyTo` header — reject CRLF before
  // the regex so a newline-payload can't sneak past format validation.
  let contactEmail: string | null = null;
  const rawEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';
  if (rawEmail) {
    if (
      /[\r\n]/.test(rawEmail) ||
      !EMAIL_REGEX.test(rawEmail) ||
      rawEmail.length > MAX.contactEmail
    ) {
      return NextResponse.json(
        { error: 'Please enter a valid email or leave it blank' },
        { status: 400 },
      );
    }
    contactEmail = rawEmail.toLowerCase();
  }

  // pageUrl persists path only — strips query string + hash per the
  // data-minimization promise documented in the plan.
  let pageUrl: string | null = null;
  const rawPageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.trim() : '';
  if (rawPageUrl) {
    if (rawPageUrl.length > MAX.pageUrl) {
      return NextResponse.json({ error: 'Invalid page URL' }, { status: 400 });
    }
    try {
      pageUrl = new URL(rawPageUrl, env.app.url).pathname;
    } catch {
      return NextResponse.json({ error: 'Invalid page URL' }, { status: 400 });
    }
  }

  let locale: string | null = null;
  const rawLocale = typeof body.locale === 'string' ? body.locale.trim() : '';
  if (rawLocale) {
    if (!(routing.locales as readonly string[]).includes(rawLocale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }
    locale = rawLocale;
  }

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Session lookup failure is non-fatal — treat as anonymous.
  }

  const serviceClient = createServiceClient();
  const { data: row, error: insertError } = await serviceClient
    .from('site_feedback')
    .insert({
      user_id: userId,
      category,
      message,
      contact_email: contactEmail,
      page_url: pageUrl,
      locale,
    })
    .select('id')
    .single();

  if (insertError || !row) {
    console.error('[feedback] insert failed:', insertError?.message);
    return NextResponse.json(
      { error: 'Could not save your feedback. Please try again.' },
      { status: 500 },
    );
  }

  const feedbackId = row.id as string;

  const emailLines = [
    `Category: ${category}`,
    `From: ${userId ? `user ${userId}` : 'anonymous'}`,
    `Reply-to: ${contactEmail ?? '(not provided)'}`,
    `Page: ${pageUrl ?? '(not provided)'}`,
    `Locale: ${locale ?? '(not provided)'}`,
    '',
    'Message:',
    message,
  ];

  void resend.emails
    .send({
      from: `Second Turn Games <${env.resend.fromEmail}>`,
      to: LEGAL_ENTITY_EMAIL,
      replyTo: contactEmail || undefined,
      subject: `[Site feedback] ${category} — ${message.slice(0, 80)}`,
      text: emailLines.join('\n'),
    })
    .catch((err) => {
      console.error('[feedback] email forward failed:', err);
    });

  void notifyStaff('feedback.received', {
    feedbackId,
    category,
    preview: message.slice(0, 140),
  });

  // Anonymous submissions use a stable sentinel distinctId so they collapse to
  // a single PostHog person rather than minting one per event (cookieless EU
  // mode is already coarse-grained on uniqueness — see CLAUDE.md "Analytics").
  void trackServer('feedback_submitted', userId ?? 'anonymous-feedback', {
    category: category as Category,
    anonymous: !userId,
  });

  return NextResponse.json({ success: true });
}
