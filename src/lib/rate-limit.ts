/**
 * In-memory sliding window rate limiter for single-server deployment.
 * Uses IP address (or other identifier) as the key.
 */

import { NextResponse } from 'next/server';

interface RateLimitOptions {
  interval: number;   // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp (ms) when the window resets
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimiter {
  check(identifier: string): RateLimitResult;
  /** Exposed for testing — the internal store */
  _store: Map<string, RateLimitEntry>;
}

const CLEANUP_INTERVAL_MS = 60_000;

export function rateLimit({ interval, maxRequests }: RateLimitOptions): RateLimiter {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    });
  }, CLEANUP_INTERVAL_MS);

  // Allow Node.js to exit without waiting for this timer
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return {
    _store: store,
    check(identifier: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(identifier);

      if (!entry || now > entry.resetTime) {
        // New window
        const resetTime = now + interval;
        store.set(identifier, { count: 1, resetTime });
        return { success: true, remaining: maxRequests - 1, resetTime };
      }

      if (entry.count < maxRequests) {
        entry.count++;
        return { success: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
      }

      return { success: false, remaining: 0, resetTime: entry.resetTime };
    },
  };
}

/**
 * Extract client IP from request headers.
 * Reads x-forwarded-for (first IP in chain) → x-real-ip → 'unknown'.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Standard 429 response for rate-limited requests.
 */
export function rateLimitResponse(resetTime: number): NextResponse {
  const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) } }
  );
}

// Pre-configured limiters (singletons — persist across requests in same process)
export const paymentLimiter = rateLimit({ interval: 60_000, maxRequests: 10 });
export const photoUploadLimiter = rateLimit({ interval: 60_000, maxRequests: 5 });
export const withdrawalLimiter = rateLimit({ interval: 60_000, maxRequests: 3 });
export const profileUpdateLimiter = rateLimit({ interval: 60_000, maxRequests: 5 });
