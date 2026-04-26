/**
 * Payment edge-case scenario tests (I2, I3, I5, I6, I8, I11).
 *
 * Tests payment fulfillment, reconciliation, and reservation expiry
 * by mocking Supabase and payment dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CartCheckoutGroup } from '@/lib/checkout/cart-types';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockGetPaymentStatus = vi.fn();
const mockMapEveryPayMethod = vi.fn((..._args: unknown[]) => 'card' as const);
// mockFulfillCartPayment reserved for future reconcile-payments integration tests
const mockDebitWallet = vi.fn();
const mockCreditWallet = vi.fn();
const mockRefundToWallet = vi.fn();
const mockRefundPayment = vi.fn();
const mockCreateOrder = vi.fn();
const mockSendCartOrderEmails = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockSendEmail = vi.fn((..._args: unknown[]) => Promise.resolve());

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('@/lib/env', () => ({
  env: {
    cron: { secret: 'test-secret' },
    app: { adminEmail: 'admin@test.com' },
    resend: { fromEmail: 'noreply@test.com' },
  },
}));
vi.mock('@/lib/services/everypay', () => ({
  getPaymentStatus: (...args: unknown[]) => mockGetPaymentStatus(...args),
  SUCCESSFUL_STATES: new Set(['settled']),
  FAILED_STATES: new Set(['failed', 'abandoned']),
  mapEveryPayMethod: (...args: unknown[]) => mockMapEveryPayMethod(...args),
}));
vi.mock('@/lib/services/everypay/client', () => ({
  refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
}));
vi.mock('@/lib/services/wallet', () => ({
  debitWallet: (...args: unknown[]) => mockDebitWallet(...args),
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
  refundToWallet: (...args: unknown[]) => mockRefundToWallet(...args),
}));
vi.mock('@/lib/services/orders', () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));
vi.mock('@/lib/email/cart-emails', () => ({
  sendCartOrderEmails: (...args: unknown[]) => mockSendCartOrderEmails(...args),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));
vi.mock('@/lib/services/payment-fulfillment', async (importOriginal) => {
  // For reconcile-payments tests we need to mock fulfillCartPayment,
  // but for direct fulfillment tests we import the real one.
  // We'll use the real module in most tests and override only for I2.
  return importOriginal();
});
vi.mock('@/lib/email/service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));
vi.mock('@/lib/listings/constants', () => ({
  RESERVATION_TTL_MS: 30 * 60 * 1000,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(secret = 'test-secret') {
  return new Request('http://localhost:3000/api/cron/reconcile-payments', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

function makeExpireRequest(secret = 'test-secret') {
  return new Request('http://localhost:3000/api/cron/expire-reservations', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

function makeQueryBuilder(resolvedData: unknown = null, resolvedError: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'neq', 'lt', 'gt', 'in', 'not', 'limit', 'update', 'returns', 'is'];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: resolvedData, error: resolvedError });
  return builder;
}

function makeGroup(overrides: Partial<CartCheckoutGroup> = {}): CartCheckoutGroup {
  return {
    id: 'group-1',
    order_number: 'STG-20260413-001',
    callback_token: 'cb-1',
    buyer_id: 'buyer-1',
    terminal_id: 't1',
    terminal_name: 'Omniva Riga',
    terminal_address: null,
    terminal_city: null,
    terminal_postal_code: null,
    terminal_country: 'LV',
    buyer_phone: '+37120000001',
    total_amount_cents: 2000,
    wallet_debit_cents: 0,
    wallet_allocation: {},
    listing_ids: ['listing-1'],
    everypay_payment_reference: 'ep-ref-1',
    status: 'pending',
    created_at: '2026-04-13T11:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// I2: Orphan reconciliation
// ---------------------------------------------------------------------------

describe('reconcile-payments cron (I2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('I2: finds pending cart group 5+ min old with settled payment -> fulfills order', async () => {
    const { createServiceClient } = await import('@/lib/supabase');

    const staleGroup = makeGroup({
      created_at: new Date('2026-04-13T11:50:00Z').toISOString(), // 10 min old
    });

    mockGetPaymentStatus.mockResolvedValue({
      payment_state: 'settled',
      payment_method: 'card',
      order_reference: 'order-ref-1',
    });

    // fulfillCartPayment is imported real; we need to mock what IT calls
    // But the reconcile route calls it, so we need the real chain.
    // For simplicity, test at the cron route level: mock the supabase client
    // that returns the stale group, and mock fulfillCartPayment at module level.

    // Actually, the reconcile route imports fulfillCartPayment directly.
    // Let's verify the cron route calls getPaymentStatus and then fulfillCartPayment.
    // We need to re-mock fulfillCartPayment for this test specifically.

    // Since we can't partially re-mock, let's test at a higher level:
    // verify the cron queries for stale groups, checks EveryPay, and creates orders.

    const cartGroupsBuilder = makeQueryBuilder([staleGroup]);
    // Wallet retry query returns nothing
    // Wallet retry query returns nothing (via default makeQueryBuilder)

    // For fulfillCartPayment: mock its internal supabase queries
    const existingOrdersBuilder = makeQueryBuilder([]); // no existing orders
    const listingsBuilder = makeQueryBuilder([{
      id: 'listing-1',
      seller_id: 'seller-1',
      price_cents: 2000,
      status: 'reserved',
      country: 'LV',
      game_name: 'Catan',
      reserved_by: 'buyer-1',
      listing_type: 'fixed_price',
      highest_bidder_id: null,
      current_bid_cents: null,
    }]);
    const expansionsBuilder = makeQueryBuilder([]);
    const groupUpdateBuilder = makeQueryBuilder();

    mockCreateOrder.mockResolvedValue({
      id: 'order-new-1',
      order_number: 'STG-20260413-002',
    });

    let fromCallIdx = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'cart_checkout_groups') {
          fromCallIdx++;
          if (fromCallIdx <= 1) return cartGroupsBuilder; // stale groups query
          return groupUpdateBuilder; // status update
        }
        if (table === 'orders') return existingOrdersBuilder;
        if (table === 'listings') return listingsBuilder;
        if (table === 'listing_expansions') return expansionsBuilder;
        return makeQueryBuilder();
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const { POST } = await import('@/app/api/cron/reconcile-payments/route');
    const response = await POST(makeRequest());
    const body = await response.json();

    // Payment status was checked
    expect(mockGetPaymentStatus).toHaveBeenCalledWith('ep-ref-1');

    // Order was created
    expect(mockCreateOrder).toHaveBeenCalled();
    expect(body.carts.created).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// I3, I5, I6, I11: fulfillCartPayment direct tests
// ---------------------------------------------------------------------------

describe('fulfillCartPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('I3: listing unavailable at fulfillment -> partial refund triggered', async () => {
    const { fulfillCartPayment } = await import('@/lib/services/payment-fulfillment');

    const group = makeGroup({
      listing_ids: ['listing-ok', 'listing-gone'],
      total_amount_cents: 4000,
      wallet_debit_cents: 0,
      wallet_allocation: {},
    });

    const okListing = {
      id: 'listing-ok',
      seller_id: 'seller-1',
      price_cents: 2000,
      status: 'reserved',
      country: 'LV',
      game_name: 'Catan',
      reserved_by: 'buyer-1',
      listing_type: 'fixed_price',
      highest_bidder_id: null,
      current_bid_cents: null,
    };

    // listing-gone was cancelled/sold between reservation and fulfillment
    const goneListing = {
      id: 'listing-gone',
      seller_id: 'seller-2',
      price_cents: 2000,
      status: 'sold', // no longer reserved
      country: 'LV',
      game_name: 'Wingspan',
      reserved_by: null,
      listing_type: 'fixed_price',
      highest_bidder_id: null,
      current_bid_cents: null,
    };

    mockCreateOrder.mockResolvedValue({
      id: 'order-1',
      order_number: 'STG-20260413-003',
    });
    mockRefundPayment.mockResolvedValue(undefined);

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'orders') return makeQueryBuilder([]); // no existing orders
        if (table === 'listings') return makeQueryBuilder([okListing, goneListing]);
        if (table === 'listing_expansions') return makeQueryBuilder([]);
        if (table === 'cart_checkout_groups') return makeQueryBuilder();
        return makeQueryBuilder();
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fulfillCartPayment(group, 'ep-ref-1', 'settled', mockClient as any, 'card');

    expect(result.outcome).toBe('created');
    // Partial refund for the unavailable item
    expect(mockRefundPayment).toHaveBeenCalled();
  });

  it('I5: all items unavailable -> full refund, outcome unavailable', async () => {
    const { fulfillCartPayment } = await import('@/lib/services/payment-fulfillment');

    const group = makeGroup({
      listing_ids: ['listing-gone-1', 'listing-gone-2'],
      total_amount_cents: 4000,
    });

    const allGone = [
      {
        id: 'listing-gone-1', seller_id: 'seller-1', price_cents: 2000,
        status: 'sold', country: 'LV', game_name: 'Catan',
        reserved_by: null, listing_type: 'fixed_price',
        highest_bidder_id: null, current_bid_cents: null,
      },
      {
        id: 'listing-gone-2', seller_id: 'seller-2', price_cents: 2000,
        status: 'cancelled', country: 'LV', game_name: 'Azul',
        reserved_by: null, listing_type: 'fixed_price',
        highest_bidder_id: null, current_bid_cents: null,
      },
    ];

    mockRefundPayment.mockResolvedValue(undefined);

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'orders') return makeQueryBuilder([]); // no existing orders
        if (table === 'listings') return makeQueryBuilder(allGone);
        if (table === 'listing_expansions') return makeQueryBuilder([]);
        if (table === 'cart_checkout_groups') return makeQueryBuilder();
        return makeQueryBuilder();
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fulfillCartPayment(group, 'ep-ref-1', 'settled', mockClient as any, 'card');

    expect(result.outcome).toBe('unavailable');
    // Full refund via EveryPay
    expect(mockRefundPayment).toHaveBeenCalledWith('ep-ref-1', 4000);
  });

  it('I6: wallet debit fails -> order created with buyer_wallet_debit_cents=0', async () => {
    const { fulfillCartPayment } = await import('@/lib/services/payment-fulfillment');

    const group = makeGroup({
      total_amount_cents: 3000,
      wallet_debit_cents: 500,
      wallet_allocation: { 'listing-1': 500 },
    });

    const listing = {
      id: 'listing-1',
      seller_id: 'seller-1',
      price_cents: 2500,
      status: 'reserved',
      country: 'LV',
      game_name: 'Catan',
      reserved_by: 'buyer-1',
      listing_type: 'fixed_price',
      highest_bidder_id: null,
      current_bid_cents: null,
    };

    mockCreateOrder.mockResolvedValue({
      id: 'order-1',
      order_number: 'STG-20260413-004',
    });

    // Wallet debit fails
    mockDebitWallet.mockRejectedValue(new Error('Insufficient balance'));

    const updateCalls: Array<{ table: string; data: unknown; orderId: string }> = [];
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          const builder = makeQueryBuilder([]);
          // Track update calls for buyer_wallet_debit_cents
          builder.update = vi.fn((data: unknown) => {
            updateCalls.push({ table, data, orderId: '' });
            return builder;
          });
          return builder;
        }
        if (table === 'listings') return makeQueryBuilder([listing]);
        if (table === 'listing_expansions') return makeQueryBuilder([]);
        if (table === 'cart_checkout_groups') return makeQueryBuilder();
        return makeQueryBuilder();
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fulfillCartPayment(group, 'ep-ref-1', 'settled', mockClient as any, 'card');

    expect(result.outcome).toBe('created');
    // Wallet debit was attempted
    expect(mockDebitWallet).toHaveBeenCalled();
    // Order update to set buyer_wallet_debit_cents=0 happened after failure
    const walletResetUpdate = updateCalls.find(
      (c) => c.table === 'orders' && (c.data as Record<string, unknown>).buyer_wallet_debit_cents === 0
    );
    expect(walletResetUpdate).toBeDefined();
  });

  it('I11: duplicate callback -> second call returns already_exists', async () => {
    const { fulfillCartPayment } = await import('@/lib/services/payment-fulfillment');

    const group = makeGroup();

    // First call already created orders for this group
    const existingOrders = [{ id: 'order-existing-1' }];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'orders') return makeQueryBuilder(existingOrders);
        return makeQueryBuilder();
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fulfillCartPayment(group, 'ep-ref-1', 'settled', mockClient as any, 'card');

    expect(result.outcome).toBe('already_exists');
    // createOrder should NOT be called
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// I8: Reservation expiry
// ---------------------------------------------------------------------------

describe('expire-reservations cron (I8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('I8: stale reserved listing with no active order -> released', async () => {
    const { createServiceClient } = await import('@/lib/supabase');

    // The cron calls supabase.rpc('expire_stale_reservations', { cutoff })
    const mockRpc = vi.fn().mockResolvedValue({
      data: ['listing-stale-1', 'listing-stale-2'],
      error: null,
    });

    const mockSupabase = {
      from: vi.fn(() => makeQueryBuilder()),
      rpc: mockRpc,
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const { POST } = await import('@/app/api/cron/expire-reservations/route');
    const response = await POST(makeExpireRequest());
    const body = await response.json();

    expect(body.expired).toBe(2);
    // RPC was called with the correct cutoff (30 min before now)
    expect(mockRpc).toHaveBeenCalledWith('expire_stale_reservations', {
      cutoff: expect.any(String),
    });

    // Verify the cutoff is approximately 30 minutes before "now"
    const cutoff = mockRpc.mock.calls[0][1].cutoff;
    const cutoffDate = new Date(cutoff);
    const expectedCutoff = new Date('2026-04-13T11:30:00Z');
    expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
  });
});
