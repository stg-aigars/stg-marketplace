import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { applyRateLimit, newsletterLimiter } from '@/lib/rate-limit';

const resend = new Resend(env.resend.apiKey);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const rateLimitError = applyRateLimit(newsletterLimiter, request);
  if (rateLimitError) return rateLimitError;

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

    await resend.contacts.create({
      email,
      audienceId: env.resend.audienceId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Newsletter] Subscribe failed:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    );
  }
}
