/**
 * In-memory sliding window rate limiter for single-server deployment.
 * Assumes reverse proxy (Traefik) always sets x-forwarded-for.
 */

import { NextResponse } from 'next/server';

interface RateLimitOptions {
  interval: number;
  maxRequests: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimiter {
  check(identifier: string): RateLimitResult;
}

const CLEANUP_INTERVAL_MS = 60_000;

export function rateLimit({ interval, maxRequests }: RateLimitOptions): RateLimiter {
  const store = new Map<string, RateLimitEntry>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    });
  }, CLEANUP_INTERVAL_MS);

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return {
    check(identifier: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(identifier);

      if (!entry || now > entry.resetTime) {
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

export function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function rateLimitResponse(resetTime: number): NextResponse {
  const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) } }
  );
}

/**
 * Check rate limit for a request. Returns a 429 NextResponse if exceeded, null if OK.
 * Follows the same null=ok pattern as requireBrowserOrigin.
 */
export function applyRateLimit(limiter: RateLimiter, request: Request): NextResponse | null {
  const ip = getClientIP(request);
  const result = limiter.check(ip);
  return result.success ? null : rateLimitResponse(result.resetTime);
}

// Pre-configured limiters (singletons — persist across requests in same process)
export const paymentLimiter = rateLimit({ interval: 60_000, maxRequests: 10 });
export const photoUploadLimiter = rateLimit({ interval: 60_000, maxRequests: 10 });
export const withdrawalLimiter = rateLimit({ interval: 60_000, maxRequests: 3 });
export const profileUpdateLimiter = rateLimit({ interval: 60_000, maxRequests: 5 });
export const dataExportLimiter = rateLimit({ interval: 3_600_000, maxRequests: 3 });
export const accountDeleteLimiter = rateLimit({ interval: 3_600_000, maxRequests: 3 });
export const newsletterLimiter = rateLimit({ interval: 60_000, maxRequests: 5 });
export const thumbnailLimiter = rateLimit({ interval: 10_000, maxRequests: 5 });
export const gameSearchLimiter = rateLimit({ interval: 60_000, maxRequests: 30 });
export const messageLimiter = rateLimit({ interval: 60_000, maxRequests: 20 });
export const paymentCallbackLimiter = rateLimit({ interval: 60_000, maxRequests: 20 });
