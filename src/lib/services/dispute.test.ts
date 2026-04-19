import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  canOpenDispute,
  canEscalateDispute,
  canWithdrawDispute,
} from './dispute-validation';

// Mocks for sellerAcceptRefund behavioural test below.
// vi.mock calls are hoisted by vitest and don't affect the pure validation
// tests above (they import from './dispute-validation', not './dispute').

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('./order-transitions', () => ({
  loadOrder: vi.fn(),
  creditSellerWallet: vi.fn(),
  markOrderListingsSold: vi.fn(),
}));
vi.mock('./order-refund', () => ({
  refundOrder: vi.fn(),
  markRefundFailed: vi.fn(),
  RefundInitiationError: class RefundInitiationError extends Error {},
}));
vi.mock('./audit', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendOrderDisputedToSeller: vi.fn(),
  sendDisputeResolvedRefund: vi.fn(() => ({ catch: vi.fn() })),
  sendDisputeResolvedNoRefund: vi.fn(() => ({ catch: vi.fn() })),
  sendDisputeEscalated: vi.fn(() => ({ catch: vi.fn() })),
  sendDisputeWithdrawn: vi.fn(() => ({ catch: vi.fn() })),
}));
vi.mock('@/lib/notifications', () => ({
  notify: vi.fn(),
  notifyMany: vi.fn(),
}));

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

describe('sellerAcceptRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression guard for the listing restore bug: before this fix, sellerAcceptRefund
  // marked order_items inactive but left listings stuck in 'reserved' status, so a
  // seller who voluntarily accepted a refund couldn't re-list the game afterward.
  // staffResolveDispute had the restore block; sellerAcceptRefund was silently missing it.
  it('restores reserved listings after a successful refund', async () => {
    const { sellerAcceptRefund } = await import('./dispute');
    const { loadOrder } = await import('./order-transitions');
    const { refundOrder } = await import('./order-refund');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = {
      id: 'order-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'disputed' as const,
      total_amount_cents: 1000,
      items_total_cents: 800,
      shipping_cost_cents: 200,
      order_number: 'STG-20260410-TEST',
      order_items: [
        { listing_id: 'L1', price_cents: 400, listings: null },
        { listing_id: 'L2', price_cents: 400, listings: null },
      ],
      listing_id: null,
      buyer_profile: null,
      seller_profile: null,
      listings: null,
    };

    let listingsTableAccessed = false;
    const makeBuilder = (table: string) => {
      const builder: Record<string, unknown> = {
        update: vi.fn(() => builder),
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        in: vi.fn(() => builder),
        single: vi.fn(() => {
          if (table === 'disputes') return Promise.resolve({ data: { id: 'dispute-1' }, error: null });
          if (table === 'orders') return Promise.resolve({ data: { ...mockOrder, status: 'refunded' }, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
        maybeSingle: vi.fn(() => {
          if (table === 'disputes') {
            return Promise.resolve({
              data: { id: 'dispute-1', resolved_at: null, escalated_at: null },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      };
      return builder;
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'listings') listingsTableAccessed = true;
        return makeBuilder(table);
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    (loadOrder as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);
    (refundOrder as ReturnType<typeof vi.fn>).mockResolvedValue({ cardRefunded: 1000, walletRefunded: 0 });

    await sellerAcceptRefund('order-1', 'seller-1');

    // Listings table must be updated (proves the restore block ran)
    expect(listingsTableAccessed).toBe(true);
  });
});

describe('staffResolveDispute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores reserved listings on refund decision', async () => {
    const { staffResolveDispute } = await import('./dispute');
    const { loadOrder } = await import('./order-transitions');
    const { refundOrder } = await import('./order-refund');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = {
      id: 'order-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'disputed' as const,
      total_amount_cents: 1000,
      items_total_cents: 800,
      shipping_cost_cents: 200,
      order_number: 'STG-20260410-TEST',
      listing_id: null,
      order_items: [
        { listing_id: 'L1', price_cents: 400, listings: null },
        { listing_id: 'L2', price_cents: 400, listings: null },
      ],
      buyer_profile: null,
      seller_profile: null,
      listings: null,
    };

    let listingsTableAccessed = false;
    const makeBuilder = (table: string) => {
      const builder: Record<string, unknown> = {
        update: vi.fn(() => builder),
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        in: vi.fn(() => builder),
        single: vi.fn(() => {
          if (table === 'disputes') return Promise.resolve({ data: { id: 'dispute-1' }, error: null });
          if (table === 'orders') return Promise.resolve({ data: { ...mockOrder, status: 'refunded' }, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
        maybeSingle: vi.fn(() => {
          if (table === 'disputes') {
            return Promise.resolve({
              data: { id: 'dispute-1', resolved_at: null, escalated_at: null },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      };
      return builder;
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'listings') listingsTableAccessed = true;
        return makeBuilder(table);
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    (loadOrder as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);
    (refundOrder as ReturnType<typeof vi.fn>).mockResolvedValue({ cardRefunded: 1000, walletRefunded: 0 });

    await staffResolveDispute('order-1', 'staff-1', 'refund', 'Test notes');

    expect(listingsTableAccessed).toBe(true);
  });
});
