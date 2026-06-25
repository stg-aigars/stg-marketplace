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
const mockMapEveryPayMethod = vi.fn().mockReturnValue('card' as const);
// mockFulfillCartPayment reserved for future reconcile-payments integration tests
const mockDebitWallet = vi.fn();
const mockCreditWallet = vi.fn();
const mockRefundToWallet = vi.fn();
const mockRefundPayment = vi.fn();
const mockCreateOrder = vi.fn();
const mockSendCartOrderEmails = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('@/lib/env', () => ({
  env: {
    cron: { secret: 'test-secret' },
    app: { adminEmail: 'admin@test.com' },
    resend: { fromEmail: 'noreply@test.com' },
    accounting: { engineEnabled: false },
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
  lookupSellerIbanCountry: vi.fn().mockResolvedValue(null),
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
    is_staff_test: false,
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

  // -------------------------------------------------------------------------
  // I12: end-to-end mid-loop rollback against real row state
  // -------------------------------------------------------------------------
  //
  // Every other test in this file (and the unit tests in
  // payment-fulfillment.test.ts) asserts on mock *call arguments* — what
  // payload was passed to `.update(...)`. This test instead runs a tiny
  // in-memory fake table store: `.update()` actually mutates rows filtered by
  // `.eq()`, and assertions read the resulting rows back via `.select()`,
  // exactly as a production reader of the `orders` table would see them.
  // This is the strongest evidence that claimAndCancelOrder,
  // refundOrderWalletLeg, and stampRollbackRefundStatus actually compose into
  // correct final state, not just correct individual calls.
  //
  // Scenario: a two-seller cart. Seller A's createOrder() call fully
  // succeeds (order + order_items inserted, listing flipped to 'reserved').
  // Seller B's createOrder() call fails — modeling another buyer having
  // bought seller B's listing between cart creation and fulfillment, which
  // makes createOrder()'s internal listings-availability check fail and
  // throw (createOrder()'s own self-rollback is covered by orders.ts's own
  // tests; createOrder is mocked here, same as every other test in this
  // file). That throw propagates to fulfillCartPayment's catch block, which
  // must roll back seller A's already-created order.
  it('I12: multi-seller cart, one seller fails mid-loop -> surviving sibling order ends fully rolled back in the orders table', async () => {
    const { fulfillCartPayment } = await import('@/lib/services/payment-fulfillment');

    const BUYER_ID = 'buyer-1';
    const SELLER_A_ORDER_ID = 'order-seller-a';
    const SELLER_A_ORDER_NUMBER = 'STG-20260413-AAAA';

    // ---- In-memory fake table store, scoped to this test -------------------
    type Row = Record<string, unknown>;
    const ordersStore: Row[] = [];
    const orderItemsStore: Row[] = [];
    const listingsStore: Row[] = [
      {
        id: 'listing-a',
        seller_id: 'seller-a',
        price_cents: 2000,
        status: 'reserved',
        reserved_by: BUYER_ID,
        country: 'LV',
        game_name: 'Catan',
        listing_type: 'fixed_price',
        highest_bidder_id: null,
        current_bid_cents: null,
      },
      {
        id: 'listing-b',
        seller_id: 'seller-b',
        // Sold to another buyer between cart creation and fulfillment —
        // no longer reserved by this buyer, so isAvailable() in
        // fulfillCartPayment returns false and seller B's listing lands in
        // the `unavailable` bucket up front... but the scenario this test
        // targets is the MID-LOOP failure, not the pre-loop partial-refund
        // path. To force seller B through createAndCancelOrder's seller
        // loop (not the pre-loop unavailable filter), seller B's listing
        // must still read as available to fulfillCartPayment's own
        // isAvailable() check; the unavailability is discovered only inside
        // createOrder()'s own re-check, which is mocked (rejected) below.
        status: 'reserved',
        reserved_by: BUYER_ID,
        country: 'LV',
        game_name: 'Wingspan',
        listing_type: 'fixed_price',
        highest_bidder_id: null,
        current_bid_cents: null,
      },
    ];

    function matchesEq(row: Row, filters: Array<[string, unknown]>) {
      return filters.every(([col, val]) => row[col] === val);
    }
    function matchesNeq(row: Row, filters: Array<[string, unknown]>) {
      return filters.every(([col, val]) => row[col] !== val);
    }
    function matchesIn(row: Row, inFilters: Array<[string, unknown[]]>) {
      return inFilters.every(([col, vals]) => vals.includes(row[col]));
    }

    function makeOrdersBuilder() {
      const eqFilters: Array<[string, unknown]> = [];
      const neqFilters: Array<[string, unknown]> = [];
      let updatePatch: Row | null = null;
      let wantsSingle = false;

      const builder: Row = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
          eqFilters.push([col, val]);
          return builder;
        }),
        neq: vi.fn((col: string, val: unknown) => {
          neqFilters.push([col, val]);
          return builder;
        }),
        update: vi.fn((patch: Row) => {
          updatePatch = patch;
          return builder;
        }),
        single: vi.fn(() => {
          wantsSingle = true;
          return builder;
        }),
        then: (resolve: (v: unknown) => void) => {
          const matched = ordersStore.filter(
            (r) => matchesEq(r, eqFilters) && matchesNeq(r, neqFilters)
          );
          if (updatePatch) {
            matched.forEach((r) => Object.assign(r, updatePatch));
          }
          if (wantsSingle) {
            resolve({ data: matched[0] ?? null, error: null });
          } else {
            resolve({ data: matched, error: null });
          }
        },
      };
      return builder;
    }

    function makeOrderItemsBuilder() {
      const eqFilters: Array<[string, unknown]> = [];
      let updatePatch: Row | null = null;

      const builder: Row = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
          eqFilters.push([col, val]);
          return builder;
        }),
        update: vi.fn((patch: Row) => {
          updatePatch = patch;
          return builder;
        }),
        then: (resolve: (v: unknown) => void) => {
          const matched = orderItemsStore.filter((r) => matchesEq(r, eqFilters));
          if (updatePatch) {
            matched.forEach((r) => Object.assign(r, updatePatch));
          }
          resolve({ data: matched, error: null });
        },
      };
      return builder;
    }

    function makeListingsBuilder() {
      const inFilters: Array<[string, unknown[]]> = [];

      const builder: Row = {
        select: vi.fn(() => builder),
        in: vi.fn((col: string, vals: unknown[]) => {
          inFilters.push([col, vals]);
          return builder;
        }),
        then: (resolve: (v: unknown) => void) => {
          const matched = listingsStore.filter((r) => matchesIn(r, inFilters));
          resolve({ data: matched, error: null });
        },
      };
      return builder;
    }

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'orders') return makeOrdersBuilder();
        if (table === 'order_items') return makeOrderItemsBuilder();
        if (table === 'listings') return makeListingsBuilder();
        if (table === 'listing_expansions') return makeQueryBuilder([]);
        if (table === 'cart_checkout_groups') return makeQueryBuilder();
        return makeQueryBuilder();
      }),
      rpc: vi.fn((fnName: string, args: { p_listing_ids: string[]; p_buyer_id: string }) => {
        if (fnName === 'unreserve_listings') {
          let count = 0;
          for (const listing of listingsStore) {
            if (
              args.p_listing_ids.includes(listing.id as string) &&
              listing.status === 'reserved' &&
              listing.reserved_by === args.p_buyer_id
            ) {
              listing.status = 'active';
              listing.reserved_by = null;
              listing.reserved_at = null;
              count++;
            }
          }
          return Promise.resolve({ data: count, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    // ---- createOrder mock: seller A succeeds (and writes through to the ----
    // fake store, modeling what the real createOrder() does), seller B
    // fails (modeling createOrder()'s own internal listings-mismatch
    // rollback + throw — covered separately by orders.ts's own tests).
    mockCreateOrder.mockImplementation(
      async (params: { sellerId: string; items: Array<{ listingId: string; priceCents: number }> }) => {
        if (params.sellerId === 'seller-b') {
          throw new Error('One or more listings are no longer available');
        }
        // seller-a path: insert order + order_items, flip listing to reserved
        const itemsTotal = params.items.reduce((sum, i) => sum + i.priceCents, 0);
        ordersStore.push({
          id: SELLER_A_ORDER_ID,
          order_number: SELLER_A_ORDER_NUMBER,
          buyer_id: BUYER_ID,
          seller_id: params.sellerId,
          status: 'pending_seller',
          total_amount_cents: itemsTotal,
          buyer_wallet_debit_cents: 0,
          cart_group_id: 'group-1',
          refund_status: null,
          refund_amount_cents: null,
          cancellation_reason: null,
          cancelled_at: null,
        });
        for (const item of params.items) {
          orderItemsStore.push({
            id: `item-${item.listingId}`,
            order_id: SELLER_A_ORDER_ID,
            listing_id: item.listingId,
            price_cents: item.priceCents,
            active: true,
          });
        }
        for (const listing of listingsStore) {
          if (params.items.some((i) => i.listingId === listing.id)) {
            listing.status = 'reserved';
            listing.reserved_by = BUYER_ID;
          }
        }
        return { id: SELLER_A_ORDER_ID, order_number: SELLER_A_ORDER_NUMBER };
      }
    );
    mockRefundPayment.mockResolvedValue(undefined);

    const group = makeGroup({
      buyer_id: BUYER_ID,
      listing_ids: ['listing-a', 'listing-b'],
      total_amount_cents: 4000,
      wallet_debit_cents: 0,
      wallet_allocation: {},
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fulfillCartPayment(group, 'ep-ref-1', 'settled', mockClient as any, 'card');

    expect(result.outcome).toBe('failed');

    // EveryPay refund called for the full cart amount (seller A's order was
    // never separately refunded pre-loop — both listings looked available
    // going in, so the entire amount is refunded as the mid-loop aggregate).
    expect(mockRefundPayment).toHaveBeenCalledWith('ep-ref-1', 4000);

    // ---- Assert on FINAL PERSISTED STATE, read back from the fake store ----
    const survivingOrder = ordersStore.find((o) => o.id === SELLER_A_ORDER_ID);
    expect(survivingOrder).toBeDefined();
    expect(survivingOrder!.status).toBe('cancelled');
    expect(survivingOrder!.cancellation_reason).toBe('system');
    expect(survivingOrder!.refund_status).toBe('completed');
    expect(survivingOrder!.refund_amount_cents).toBe(survivingOrder!.total_amount_cents);

    const listingA = listingsStore.find((l) => l.id === 'listing-a');
    expect(listingA!.status).toBe('active');
    expect(listingA!.reserved_by).toBeNull();

    const orderItemA = orderItemsStore.find((i) => i.order_id === SELLER_A_ORDER_ID);
    expect(orderItemA).toBeDefined();
    expect(orderItemA!.active).toBe(false);
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
