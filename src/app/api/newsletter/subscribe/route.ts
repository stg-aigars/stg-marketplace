import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { applyRateLimit, newsletterLimiter } from '@/lib/rate-limit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';

const resend = new Resend(env.resend.apiKey);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const rateLimitError = applyRateLimit(newsletterLimiter, request);
  if (rateLimitError) return rateLimitError;

  // Verify Turnstile token
  let turnstileToken: string | undefined;
  try {
    const body = await request.clone().json();
    turnstileToken = body.turnstileToken;
  } catch {
    // body parsing handled below
  }
  const turnstileResult = await verifyTurnstileToken(turnstileToken, getClientIp(request));
  if (!turnstileResult.success) {
    return NextResponse.json({ error: turnstileResult.error }, { status: 400 });
  }

  if (!env.resend.audienceId) {
    return NextResponse.json(
      { error: 'Newsletter is not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const email = (body.email as string)?.trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const { data, error: contactError } = await resend.contacts.create({
      email,
      audienceId: env.resend.audienceId,
    });

    if (contactError) {
      console.error('[Newsletter] Contact create failed:', contactError);
      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[Newsletter] Contact created:', data?.id, email);

    // Notify admin of new signup (fire-and-forget)
    void resend.emails.send({
      from: `Second Turn Games <${env.resend.fromEmail}>`,
      to: 'aigars@secondturn.games',
      subject: 'New launch notification signup',
      text: `${email} signed up for launch notifications.`,
    }).catch((err) => console.error('[Newsletter] Admin notify failed:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Newsletter] Subscribe failed:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    );
  }
}
