import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit, getClientIP } from './rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within limit', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 3 });

    const r1 = limiter.check('ip-1');
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check('ip-1');
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check('ip-1');
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests exceeding limit', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 2 });

    limiter.check('ip-1');
    limiter.check('ip-1');

    const r3 = limiter.check('ip-1');
    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('tracks identifiers independently', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 1 });

    const r1 = limiter.check('ip-1');
    expect(r1.success).toBe(true);

    const r2 = limiter.check('ip-2');
    expect(r2.success).toBe(true);

    const r3 = limiter.check('ip-1');
    expect(r3.success).toBe(false);
  });

  it('resets window after interval expires', () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 1 });

    const r1 = limiter.check('ip-1');
    expect(r1.success).toBe(true);

    const r2 = limiter.check('ip-1');
    expect(r2.success).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(60_001);

    const r3 = limiter.check('ip-1');
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('returns correct resetTime', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = rateLimit({ interval: 60_000, maxRequests: 1 });

    const result = limiter.check('ip-1');
    expect(result.resetTime).toBe(Date.now() + 60_000);
  });

  it('cleanup removes expired entries from store', () => {
    const limiter = rateLimit({ interval: 10_000, maxRequests: 1 });

    limiter.check('ip-1');
    limiter.check('ip-2');
    expect(limiter._store.size).toBe(2);

    // Advance past interval + cleanup interval (60s)
    vi.advanceTimersByTime(10_001 + 60_000);

    expect(limiter._store.size).toBe(0);
  });
});

describe('getClientIP', () => {
  it('extracts first IP from x-forwarded-for', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIP(request)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '9.8.7.6' },
    });
    expect(getClientIP(request)).toBe('9.8.7.6');
  });

  it('returns unknown when no IP headers present', () => {
    const request = new Request('http://localhost');
    expect(getClientIP(request)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '9.8.7.6',
      },
    });
    expect(getClientIP(request)).toBe('1.2.3.4');
  });
});
