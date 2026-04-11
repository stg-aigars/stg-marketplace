import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  canOpenDispute,
  canEscalateDispute,
  canWithdrawDispute,
} from './dispute-validation';

describe('canOpenDispute', () => {
  const baseOrder = {
    status: 'delivered' as const,
    buyer_id: 'buyer-1',
    delivered_at: new Date('2026-03-20T12:00:00Z').toISOString(),
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows buyer to open dispute within 2-day window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00Z')); // 24 hours later

    const result = canOpenDispute(baseOrder, 'buyer-1');
    expect(result.allowed).toBe(true);
  });

  it('rejects non-buyer users', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00Z'));

    const result = canOpenDispute(baseOrder, 'other-user');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Only the buyer can open a dispute');
  });

  it('rejects if order is not delivered', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00Z'));

    const result = canOpenDispute(
      { ...baseOrder, status: 'shipped' },
      'buyer-1'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Disputes can only be opened on delivered orders');
  });

  it('rejects if dispute window has expired (48h01m after delivery)', () => {
    vi.useFakeTimers();
    // 48 hours and 1 minute after delivery
    vi.setSystemTime(new Date('2026-03-22T12:01:00Z'));

    const result = canOpenDispute(baseOrder, 'buyer-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('The dispute window has expired');
  });

  it('allows dispute at 47h59m (just before window closes)', () => {
    vi.useFakeTimers();
    // 47 hours and 59 minutes after delivery
    vi.setSystemTime(new Date('2026-03-22T11:59:00Z'));

    const result = canOpenDispute(baseOrder, 'buyer-1');
    expect(result.allowed).toBe(true);
  });

  it('rejects at exactly 48h boundary', () => {
    vi.useFakeTimers();
    // Exactly 48 hours after delivery
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'));

    const result = canOpenDispute(baseOrder, 'buyer-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('The dispute window has expired');
  });

  it('rejects if delivered_at is null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00Z'));

    const result = canOpenDispute(
      { ...baseOrder, delivered_at: null },
      'buyer-1'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Order has no delivery timestamp');
  });
});

describe('canEscalateDispute', () => {
  const baseDispute = {
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    escalated_at: null,
    resolved_at: null,
    created_at: new Date('2026-03-10T12:00:00Z').toISOString(),
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows escalation after 7 days by buyer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:01:00Z')); // 7 days + 1 min

    const result = canEscalateDispute(baseDispute, 'buyer-1');
    expect(result.allowed).toBe(true);
  });

  it('allows escalation after 7 days by seller', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:01:00Z'));

    const result = canEscalateDispute(baseDispute, 'seller-1');
    expect(result.allowed).toBe(true);
  });

  it('rejects escalation before 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z')); // 6 days

    const result = canEscalateDispute(baseDispute, 'buyer-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Escalation is available after 7 days of negotiation');
  });

  it('rejects unrelated users', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:01:00Z'));

    const result = canEscalateDispute(baseDispute, 'random-user');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Only the buyer or seller can escalate');
  });

  it('rejects if already escalated', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:01:00Z'));

    const result = canEscalateDispute(
      { ...baseDispute, escalated_at: '2026-03-17T10:00:00Z' },
      'buyer-1'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Dispute is already escalated');
  });

  it('rejects if already resolved', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:01:00Z'));

    const result = canEscalateDispute(
      { ...baseDispute, resolved_at: '2026-03-15T10:00:00Z' },
      'buyer-1'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Dispute is already resolved');
  });
});

describe('canWithdrawDispute', () => {
  const baseDispute = {
    buyer_id: 'buyer-1',
    escalated_at: null,
    resolved_at: null,
  };

  it('allows buyer to withdraw open dispute', () => {
    const result = canWithdrawDispute(baseDispute, 'buyer-1');
    expect(result.allowed).toBe(true);
  });

  it('rejects non-buyer', () => {
    const result = canWithdrawDispute(baseDispute, 'seller-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Only the buyer can withdraw a dispute');
  });

  it('rejects if escalated', () => {
    const result = canWithdrawDispute(
      { ...baseDispute, escalated_at: '2026-03-17T10:00:00Z' },
      'buyer-1'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Cannot withdraw an escalated dispute');
  });

  it('rejects if already resolved', () => {
    const result = canWithdrawDispute(
      { ...baseDispute, resolved_at: '2026-03-15T10:00:00Z' },
      'buyer-1'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Dispute is already resolved');
  });
});

