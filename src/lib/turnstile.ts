import { headers } from 'next/headers';

type TurnstileVerifyResult =
  | { success: true; error?: undefined }
  | { success: false; error: string };

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5_000;
const secretKey = process.env.TURNSTILE_SECRET_KEY;

/**
 * Verify a Turnstile token server-side.
 * Gracefully skips if TURNSTILE_SECRET_KEY is not set.
 * Gracefully allows on network error (logs but doesn't block the user).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null
): Promise<TurnstileVerifyResult> {
  if (!secretKey) {
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
  } catch {
    console.error('Turnstile verification request failed');
    return { success: true };
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
