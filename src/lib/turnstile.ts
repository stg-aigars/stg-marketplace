import { headers } from 'next/headers';

type TurnstileVerifyResult =
  | { success: true; error?: undefined }
  | { success: false; error: string };

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5_000;
const secretKey = process.env.TURNSTILE_SECRET_KEY;

/**
 * Verify a Turnstile token server-side.
 * Skips verification if TURNSTILE_SECRET_KEY is not set (dev/CI only).
 * Fails closed on network errors — returns failure, not silent pass.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null
): Promise<TurnstileVerifyResult> {
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set in production — bot protection disabled');
    }
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Verification failed. Please try again.' };
  }

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: token,
    });
    if (ip) {
      body.set('remoteip', ip);
    }

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    const data = await res.json();

    if (!data.success) {
      return { success: false, error: 'Verification failed. Please try again.' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Turnstile] Verification request failed:', error);
    return { success: false, error: 'Verification service unavailable. Please try again.' };
  }
}

/** Extract client IP from a request object (API routes). */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined;
}

/** Extract client IP inside a server action (uses next/headers). */
export async function getServerActionIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0].trim() || undefined;
}
