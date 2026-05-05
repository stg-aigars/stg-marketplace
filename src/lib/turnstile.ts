import { headers } from 'next/headers';

export type TurnstileFailureReason = 'missing_token' | 'invalid_token' | 'network_error';

type TurnstileVerifyResult =
  | { success: true; error?: undefined; errorCodes?: undefined; reason?: undefined }
  | { success: false; error: string; errorCodes: string[]; reason: TurnstileFailureReason };

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5_000;
const secretKey = process.env.TURNSTILE_SECRET_KEY;

/**
 * Verify a Turnstile token server-side.
 * Skips verification if TURNSTILE_SECRET_KEY is not set (dev/CI only).
 * Fails closed on network errors — returns failure, not silent pass.
 *
 * On failure, returns `errorCodes` (Cloudflare's `error-codes` array, or `[]` when
 * we never reached Cloudflare — e.g. missing token, network timeout) AND `reason`
 * (a high-level bucket: `missing_token`, `invalid_token`, `network_error`) so the
 * "no errorCodes" cases are still distinguishable in Sentry/logs. Callers can
 * forward these to Sentry; the helper itself emits a single `console.error` with
 * `{ reason, errorCodes }` (plus the underlying `error` on the network-error path)
 * so the diagnostic is visible in container logs without requiring each caller
 * to wire it up.
 *
 * Payload contains diagnostic codes only — no IP, no email — so it sits outside the
 * `login_activity` ROPA and doesn't expand processing scope.
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
    console.error('[Turnstile] verify failed', { reason: 'missing_token', errorCodes: [] });
    return { success: false, error: 'Verification failed. Please try again.', errorCodes: [], reason: 'missing_token' };
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
      const errorCodes: string[] = Array.isArray(data['error-codes']) ? data['error-codes'] : [];
      console.error('[Turnstile] verify failed', { reason: 'invalid_token', errorCodes });
      return { success: false, error: 'Verification failed. Please try again.', errorCodes, reason: 'invalid_token' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Turnstile] verify failed', { reason: 'network_error', error });
    return { success: false, error: 'Verification service unavailable. Please try again.', errorCodes: [], reason: 'network_error' };
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
