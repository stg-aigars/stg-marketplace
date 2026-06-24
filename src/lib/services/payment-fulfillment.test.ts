/**
 * fulfillCartPayment wrap tests (PR C commit 9) + mid-loop rollback tests
 * (cart-rollback-refund-consistency fix).
 *
 * The wrap-tests describe block covers the ACCOUNTING_ENGINE_ENABLED
 * flag-check at the cart_checkout_groups update point. Flag-OFF runs
 * byte-identical to pre-PR-C behaviour (direct UPDATE statement against the
 * table); flag-ON delegates to cartFulfillmentWithGL which composes the
 * status flip + paid_at stamp + C.1/C.2 GL emit through the
 * cart_complete_payment_with_event_atomic parent RPC, plus a paired C.9 emit
 * when partial refunds fired upstream.
 *
 * What this file does NOT test:
 *   - cartFulfillmentWithGL internals (assembled entry shape, RPC argument
 *     construction, audit-log firing). Covered by mapping.test.ts +
 *     lifecycle-events.test.ts + the eventual lifecycle-wraps integration tests.
 *   - The RPC body itself (idempotency, FOR UPDATE locking, balance trigger).
 *     Covered by migration 108 + integration tests against the live Supabase.
 *   - End-to-end cart fulfillment scenarios (order creation, wallet debit,
 *     emails). Covered by src/test/scenarios/payment-edges.test.ts.
 *
 * The mid-loop rollback describe block covers the production incident where
 * order STG-20260606-UJRJ had its card payment refunded but the order itself
 * was never cancelled — the catch block refunded the card BEFORE cancelling
 * orders, so a crash mid-rollback reproduced the exact incident. The fix
 * (claimAndCancelOrder, refundOrderWalletLeg, stampRollbackRefundStatus) is
 * cancel-first: Phase 1 cancels + restores listings + refunds wallet legs for
 * every pending order, Phase 2 does the single aggregate card refund only
 * after Phase 1 completes, Phase 3 upgrades refund_status once the card
 * outcome is known.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { CartCheckoutGroup } from '@/lib/checkout/cart-types';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockIsAccountingEngineEnabled = vi.fn();
const mockCartFulfillmentWithGL = vi.fn().mockResolvedValue({
  cart_journal_entry_id: 'je_cart_1',
  partial_refund_journal_entry_id: null,
  idempotent_skip: false,
});
const mockCreateOrder = vi.fn();
const mockLookupSellerIbanCountry = vi.fn().mockResolvedValue(null);
const mockDebitWallet = vi.fn().mockResolvedValue(undefined);
const mockRefundToWallet = vi.fn().mockResolvedValue(undefined);
const mockRefundPayment = vi.fn().mockResolvedValue(undefined);
const mockSendCartOrderEmails = vi.fn().mockResolvedValue(undefined);
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
const mockCaptureException = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));
vi.mock('@/lib/accounting/feature-flag', () => ({
  isAccountingEngineEnabled: (...args: unknown[]) => mockIsAccountingEngineEnabled(...args),
}));
vi.mock('@/lib/accounting/lifecycle-wraps', () => ({
  cartFulfillmentWithGL: (...args: unknown[]) => mockCartFulfillmentWithGL(...args),
}));
vi.mock('@/lib/env', () => ({
  env: {
    cron: { secret: 'test-secret' },
    app: { adminEmail: 'admin@test.com' },
    resend: { fromEmail: 'noreply@test.com' },
    accounting: { engineEnabled: false },
  },
}));
vi.mock('@/lib/services/orders', () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
  lookupSellerIbanCountry: (...args: unknown[]) => mockLookupSellerIbanCountry(...args),
}));
vi.mock('@/lib/services/wallet', () => ({
  debitWallet: (...args: unknown[]) => mockDebitWallet(...args),
  refundToWallet: (...args: unknown[]) => mockRefundToWallet(...args),
}));
vi.mock('@/lib/services/everypay/client', () => ({
  refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
}));
vi.mock('@/lib/email/cart-emails', () => ({
  sendCartOrderEmails: (...args: unknown[]) => mockSendCartOrderEmails(...args),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

// ---------------------------------------------------------------------------
// Supabase client mock (chainable query builder)
// ---------------------------------------------------------------------------

/**
 * `mockCartCheckoutGroupsUpdate` captures the flag-OFF direct-update path.
 * Set before each test via the table-aware factory below.
 */
const mockCartCheckoutGroupsUpdate = vi.fn();
const mockOrdersUpdate = vi.fn();
const mockOrderItemsUpdate = vi.fn();
const mockRpc = vi.fn();

/** A single `{ data, error }` resolution, or a queue of them consumed in call order. */
type Resolution = { data: unknown; error: unknown };

/**
 * Builds a chainable query-builder stub. `resolutions` may be a single
 * `{ data, error }` pair (every `.then()` resolves to it) or an array
 * consumed in call order — once exhausted, the last entry repeats. This lets
 * a single table mock answer several distinct `.select()`/`.update()` calls
 * across one rollback pass (e.g. orders: existing-check, pendingOrders
 * re-query, per-order claim-UPDATE, stillLiveOrders re-query) with different
 * responses per call.
 */
function makeQueryBuilder(resolutions: Resolution | Resolution[]) {
  const queue = Array.isArray(resolutions) ? resolutions : [resolutions];
  let callIndex = 0;
  const builder: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'neq', 'lt', 'gt', 'in', 'not', 'limit', 'returns', 'is', 'single'];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => void) => {
    const next = queue[Math.min(callIndex, queue.length - 1)];
    callIndex++;
    resolve(next);
  };
  return builder;
}

function ok(data: unknown = null): Resolution {
  return { data, error: null };
}
function fail(error: unknown): Resolution {
  return { data: null, error };
}

interface MakeClientOpts {
  /** listings.select() returns this set. */
  listings: ReadonlyArray<Record<string, unknown>>;
  /** Existing orders for the cart group (idempotency check). */
  existingOrders?: ReadonlyArray<{ id: string }>;
  /**
   * Sequential responses for the `orders` table, consumed in call order:
   * [0] existing-orders idempotency check (defaults to existingOrders/[]),
   * then one response per subsequent `.then()` on the orders builder
   * (pendingOrders re-query, each claim-UPDATE, each refund-status UPDATE,
   * stillLiveOrders re-query, ...). Tests that don't reach the mid-loop
   * catch only need [0].
   */
  ordersResponses?: Resolution[];
  /** order_items.select('listing_id').eq('order_id', ...) responses, keyed by call index. */
  orderItemsSelectResponses?: Resolution[];
  /** order_items.update({ active: false }) responses, keyed by call index. */
  orderItemsUpdateResponses?: Resolution[];
  /** rpc('unreserve_listings', ...) responses, keyed by call index. */
  rpcResponses?: Resolution[];
}

function makeClient(opts: MakeClientOpts) {
  // Shared across every `from('orders')` call on this client instance — a
  // fresh builder is constructed per call (existing-check, pendingOrders
  // re-query, each claim-UPDATE, each refund-status UPDATE, stillLiveOrders
  // re-query, ...), but they must all draw from the SAME response queue in
  // call order, not each restart at index 0.
  let ordersCallIndex = 0;
  let orderItemsSelectCallIndex = 0;
  let orderItemsUpdateCallIndex = 0;
  let rpcCallIndex = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        const ordersResponses = opts.ordersResponses ?? [ok(opts.existingOrders ?? [])];
        const builder: Record<string, unknown> = {};
        const chainMethods = ['select', 'eq', 'neq', 'lt', 'gt', 'in', 'not', 'limit', 'returns', 'is', 'single'];
        for (const m of chainMethods) {
          builder[m] = vi.fn(() => builder);
        }
        builder.update = (...args: unknown[]) => {
          mockOrdersUpdate(...args);
          return builder;
        };
        builder.then = (resolve: (v: unknown) => void) => {
          const idx = Math.min(ordersCallIndex, ordersResponses.length - 1);
          const resolved = ordersResponses[idx]!;
          ordersCallIndex++;
          resolve(resolved);
        };
        return builder;
      }
      if (table === 'order_items') {
        const selectResponses = opts.orderItemsSelectResponses ?? [ok([])];
        const updateResponses = opts.orderItemsUpdateResponses ?? [ok(null)];
        const builder: Record<string, unknown> = {
          select: vi.fn(() => {
            const idx = Math.min(orderItemsSelectCallIndex, selectResponses.length - 1);
            const resolved = selectResponses[idx]!;
            orderItemsSelectCallIndex++;
            const selectBuilder: Record<string, unknown> = { eq: vi.fn(() => selectBuilder) };
            selectBuilder.then = (resolve: (v: unknown) => void) => resolve(resolved);
            return selectBuilder;
          }),
          update: (...args: unknown[]) => {
            mockOrderItemsUpdate(...args);
            const idx = Math.min(orderItemsUpdateCallIndex, updateResponses.length - 1);
            const resolved = updateResponses[idx]!;
            orderItemsUpdateCallIndex++;
            const updateBuilder: Record<string, unknown> = { eq: vi.fn(() => updateBuilder) };
            updateBuilder.then = (resolve: (v: unknown) => void) => resolve(resolved);
            return updateBuilder;
          },
        };
        return builder;
      }
      if (table === 'listings') {
        return makeQueryBuilder(ok(opts.listings));
      }
      if (table === 'listing_expansions') {
        return makeQueryBuilder(ok([]));
      }
      if (table === 'cart_checkout_groups') {
        const builder: Record<string, unknown> = {
          ...makeQueryBuilder(ok(null)),
          update: (...args: unknown[]) => {
            mockCartCheckoutGroupsUpdate(...args);
            return builder;
          },
        };
        return builder;
      }
      return makeQueryBuilder(ok(null));
    }),
    rpc: (...args: unknown[]) => {
      mockRpc(...args);
      const responses = opts.rpcResponses ?? [ok(1)];
      const idx = Math.min(rpcCallIndex, responses.length - 1);
      const resolved = responses[idx]!;
      rpcCallIndex++;
      return Promise.resolve(resolved);
    },
  } as unknown as Parameters<typeof import('./payment-fulfillment').fulfillCartPayment>[3];
}

// ---------------------------------------------------------------------------
// Test fixture factories
// ---------------------------------------------------------------------------

function baseCartGroup(overrides: Partial<CartCheckoutGroup> = {}): CartCheckoutGroup {
  return {
    id: 'group-uuid-1',
    order_number: 'STG-2027-00001',
    callback_token: 'token-1',
    buyer_id: 'buyer-uuid-1',
    terminal_id: 'lv-omniva-001',
    terminal_name: 'Test terminal',
    terminal_address: null,
    terminal_city: null,
    terminal_postal_code: null,
    terminal_country: 'LV',
    buyer_phone: '+37120000000',
    total_amount_cents: 10000,
    wallet_debit_cents: 0,
    wallet_allocation: {},
    listing_ids: ['listing-1'],
    everypay_payment_reference: 'ep-ref-1',
    status: 'pending',
    // Default true so flag-ON tests exercise the wrap; flag-OFF tests assert
    // legacy path regardless of this flag (the outer flag check fires first).
    is_staff_test: true,
    created_at: '2027-01-15T00:00:00Z',
    ...overrides,
  };
}

function baseListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-1',
    seller_id: 'seller-uuid-1',
    price_cents: 9500,
    status: 'reserved',
    country: 'LV',
    game_name: 'Test Game',
    reserved_by: 'buyer-uuid-1',
    listing_type: 'fixed',
    highest_bidder_id: null,
    current_bid_cents: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fulfillCartPayment — ACCOUNTING_ENGINE_ENABLED wrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrder.mockResolvedValue({ id: 'order-uuid-1', order_number: 'STG-2027-00001' });
    mockCartFulfillmentWithGL.mockResolvedValue({
      cart_journal_entry_id: 'je_cart_1',
      partial_refund_journal_entry_id: null,
      idempotent_skip: false,
    });
  });

  describe('flag-OFF (byte-identical to pre-PR-C)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(false);
    });

    it('updates cart_checkout_groups.status directly and does NOT call cartFulfillmentWithGL', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');
      const result = await fulfillCartPayment(
        baseCartGroup(),
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'card',
      );

      expect(result.outcome).toBe('created');
      expect(mockCartFulfillmentWithGL).not.toHaveBeenCalled();
      expect(mockCartCheckoutGroupsUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });
  });

  describe('flag-ON (C.1 — card)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('delegates to cartFulfillmentWithGL with payment_method=card', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');
      const result = await fulfillCartPayment(
        baseCartGroup(),
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'card',
      );

      expect(result.outcome).toBe('created');
      expect(mockCartCheckoutGroupsUpdate).not.toHaveBeenCalled();
      expect(mockCartFulfillmentWithGL).toHaveBeenCalledTimes(1);

      const callArgs = mockCartFulfillmentWithGL.mock.calls[0]![1] as Record<string, unknown>;
      expect(callArgs).toMatchObject({
        cart_group_id: 'group-uuid-1',
        buyer_id: 'buyer-uuid-1',
        payment_method: 'card',
        gross_cart_cents: 10000,
        buyer_wallet_cents: 0,
        everypay_payment_reference: 'ep-ref-1',
      });
      expect(callArgs.partial_refund).toBeUndefined();
    });

    it('threads callback_payload through to the wrap when caller provides it', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');
      const callbackPayload = { payment_state: 'settled', amount: '100.00', card_type: 'visa' };

      await fulfillCartPayment(
        baseCartGroup(),
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'card',
        null,
        callbackPayload,
      );

      const callArgs = mockCartFulfillmentWithGL.mock.calls[0]![1] as { callback_payload: unknown };
      expect(callArgs.callback_payload).toEqual(callbackPayload);
    });

    it('reconstructs a minimal callback_payload when caller omits it (back-compat path)', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');

      await fulfillCartPayment(
        baseCartGroup(),
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'card',
      );

      const callArgs = mockCartFulfillmentWithGL.mock.calls[0]![1] as { callback_payload: Record<string, unknown> };
      expect(callArgs.callback_payload).toEqual({
        payment_reference: 'ep-ref-1',
        payment_state: 'settled',
      });
    });
  });

  describe('flag-ON (C.2 — bank_link / PIS)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('delegates with payment_method=bank_link', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');

      await fulfillCartPayment(
        baseCartGroup(),
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'bank_link',
      );

      const callArgs = mockCartFulfillmentWithGL.mock.calls[0]![1] as { payment_method: string };
      expect(callArgs.payment_method).toBe('bank_link');
    });
  });

  describe('flag-ON (buyer-wallet contribution)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('threads buyer_wallet_cents from group.wallet_debit_cents', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');
      const group = baseCartGroup({
        total_amount_cents: 10000,
        wallet_debit_cents: 3000,
        wallet_allocation: { 'listing-1': 3000 },
      });

      await fulfillCartPayment(
        group,
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'card',
      );

      const callArgs = mockCartFulfillmentWithGL.mock.calls[0]![1] as {
        gross_cart_cents: number;
        buyer_wallet_cents: number;
      };
      expect(callArgs.gross_cart_cents).toBe(10000);
      expect(callArgs.buyer_wallet_cents).toBe(3000);
    });
  });

  describe('flag-ON (partial refund — C.9 paired emit)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('populates partial_refund with EveryPay + wallet split when some listings unavailable', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');
      const group = baseCartGroup({
        total_amount_cents: 12000,
        wallet_debit_cents: 2000,
        wallet_allocation: { 'listing-1': 1000, 'listing-2': 1000 },
        listing_ids: ['listing-1', 'listing-2'],
      });

      // listing-1 available, listing-2 unavailable (different seller, fully gone)
      const listings = [
        baseListing({ id: 'listing-1', seller_id: 'seller-uuid-1', price_cents: 5000 }),
        baseListing({
          id: 'listing-2',
          seller_id: 'seller-uuid-2',
          price_cents: 5000,
          status: 'sold', // not reserved anymore
          reserved_by: null,
        }),
      ];

      await fulfillCartPayment(group, 'ep-ref-1', 'settled', makeClient({ listings }), 'card');

      const callArgs = mockCartFulfillmentWithGL.mock.calls[0]![1] as {
        partial_refund?: { refund_cents: number; buyer_wallet_refund_cents: number };
      };
      expect(callArgs.partial_refund).toBeDefined();
      expect(callArgs.partial_refund!.buyer_wallet_refund_cents).toBe(1000);
      // refund_cents = wallet (1000) + everypay portion of unavailable items
      expect(callArgs.partial_refund!.refund_cents).toBeGreaterThan(1000);
    });

    it('omits partial_refund when full cart fulfilled', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');

      await fulfillCartPayment(
        baseCartGroup(),
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'card',
      );

      const callArgs = mockCartFulfillmentWithGL.mock.calls[0]![1] as Record<string, unknown>;
      expect(callArgs.partial_refund).toBeUndefined();
    });
  });

  describe('flag-ON (idempotent retry — TS-side guard short-circuits before the wrap)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('returns already_exists without calling cartFulfillmentWithGL when orders already exist', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');
      const result = await fulfillCartPayment(
        baseCartGroup(),
        'ep-ref-1',
        'settled',
        makeClient({
          listings: [baseListing()],
          existingOrders: [{ id: 'existing-order-uuid' }],
        }),
        'card',
      );

      expect(result.outcome).toBe('already_exists');
      expect(mockCartFulfillmentWithGL).not.toHaveBeenCalled();
    });
  });

  describe('flag-ON + cart.is_staff_test=false (stage 2 customer traffic gate)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('takes legacy cart_checkout_groups.status update path; does NOT call cartFulfillmentWithGL', async () => {
      const { fulfillCartPayment } = await import('./payment-fulfillment');
      const result = await fulfillCartPayment(
        baseCartGroup({ is_staff_test: false }),
        'ep-ref-1',
        'settled',
        makeClient({ listings: [baseListing()] }),
        'card',
      );

      expect(result.outcome).toBe('created');
      expect(mockCartFulfillmentWithGL).not.toHaveBeenCalled();
      expect(mockCartCheckoutGroupsUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });
  });
});

// =============================================================================
// fulfillCartPayment — mid-loop rollback
// =============================================================================
//
// Production incident: order STG-20260606-UJRJ had its card payment refunded
// but the order itself was never cancelled (accept -> ship -> deliver ->
// complete with a refunded payment underneath it). Root cause: the old catch
// block refunded the card BEFORE cancelling orders, trusted an in-memory
// array that could miss orders createOrder() failed to report, never
// restored listings, never deactivated order_items, and never stamped
// refund_status.
//
// The fix is cancel-first: Phase 1 (claimAndCancelOrder + wallet-leg refund
// for every order found by re-querying the DB) completes BEFORE Phase 2 (the
// single aggregate card refund). Phase 3 upgrades refund_status once the
// card outcome is known. A crash between phases leaves cancelled orders, not
// live-and-refunded ones — the literal fix for the incident.

describe('fulfillCartPayment — mid-loop rollback', () => {
  const SELLER_1_ORDER = { id: 'order-seller-1', order_number: 'STG-20270115-AAAA' };

  function twoSellerListings() {
    return [
      baseListing({ id: 'listing-1', seller_id: 'seller-uuid-1', price_cents: 5000 }),
      baseListing({ id: 'listing-2', seller_id: 'seller-uuid-2', price_cents: 5000, reserved_by: 'buyer-uuid-1' }),
    ];
  }

  function twoSellerGroup(overrides: Partial<CartCheckoutGroup> = {}) {
    return baseCartGroup({
      listing_ids: ['listing-1', 'listing-2'],
      total_amount_cents: 10000,
      ...overrides,
    });
  }

  /** Pending order row shape returned by the catch block's re-query. */
  function pendingOrderRow(overrides: Record<string, unknown> = {}) {
    return {
      id: SELLER_1_ORDER.id,
      order_number: SELLER_1_ORDER.order_number,
      buyer_wallet_debit_cents: 0,
      total_amount_cents: 5000,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAccountingEngineEnabled.mockReturnValue(false);
    // Seller 1's createOrder resolves; seller 2's rejects, modeling the
    // routine non-leaking case where createOrder() self-deletes its own
    // order/order_items rows on the listings-mismatch path before throwing —
    // so seller 2's order never persists and must NOT appear in the
    // pendingOrders re-query result below.
    mockCreateOrder
      .mockResolvedValueOnce(SELLER_1_ORDER)
      .mockRejectedValueOnce(new Error('One or more listings are no longer available'));
  });

  it('1. cancels + restores + refunds the wallet leg BEFORE the aggregate card refund; stamps completed; fires audit event; no stranded-order or live-order alerts', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]), // existing-orders idempotency check
        ok([pendingOrderRow()]), // pendingOrders re-query — only seller 1's order persisted
        ok({ id: SELLER_1_ORDER.id }), // claimAndCancelOrder's claim-UPDATE
        ok(null), // Phase 1 stampRollbackRefundStatus UPDATE
        ok(null), // Phase 3 stampRollbackRefundStatus UPDATE
        ok([]), // stillLiveOrders re-query — empty, total rollback succeeded
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    const result = await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    expect(result.outcome).toBe('failed');

    // Ordering: the claim-UPDATE (orders) and the listings-restore /
    // order_items-deactivate calls must all fire before attemptAutoRefund.
    const claimCallOrder = mockOrdersUpdate.mock.invocationCallOrder[0]!;
    const rpcCallOrder = mockRpc.mock.invocationCallOrder[0]!;
    const orderItemsUpdateCallOrder = mockOrderItemsUpdate.mock.invocationCallOrder[0]!;
    const refundCallOrder = mockRefundPayment.mock.invocationCallOrder[0]!;
    expect(claimCallOrder).toBeLessThan(refundCallOrder);
    expect(rpcCallOrder).toBeLessThan(refundCallOrder);
    expect(orderItemsUpdateCallOrder).toBeLessThan(refundCallOrder);

    // Aggregate refund called once, with the full expected amount (no
    // pre-loop partial refund occurred in this scenario, so nothing to subtract).
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
    expect(mockRefundPayment).toHaveBeenCalledWith('ep-ref-1', 10000);

    // Final refund_status stamp is 'completed' (card + wallet both ok; wallet
    // leg is a no-op here since buyer_wallet_debit_cents=0).
    const finalStampCall = mockOrdersUpdate.mock.calls[mockOrdersUpdate.mock.calls.length - 1]![0];
    expect(finalStampCall).toMatchObject({ refund_status: 'completed' });

    // Audit event carries refundAmountCents.
    const auditCall = mockLogAuditEvent.mock.calls.find(
      (c) => (c[1] as { action?: string })?.action === 'order.auto_cancelled.system'
    );
    expect(auditCall).toBeDefined();
    expect((auditCall![1] as { metadata: { refundAmountCents: number } }).metadata.refundAmountCents).toBeDefined();

    // Sentry captured for the mid-loop phase.
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'cart_fulfillment_mid_loop' }) })
    );

    // Post-condition canary did NOT fire (stillLiveOrders was empty).
    expect(mockCaptureException).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'cart_rollback_live_order_survived' }) })
    );
  });

  it('2. does not fire the refund-incomplete Sentry alert on a fully successful rollback (alert-fatigue regression)', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]),
        ok({ id: SELLER_1_ORDER.id }),
        ok(null),
        ok(null),
        ok([]),
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    expect(mockCaptureException).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'cart_rollback_refund_incomplete' }) })
    );
  });

  it('3. cancels the sibling order BEFORE calling attemptAutoRefund, even when the refund itself fails (crash-ordering regression)', async () => {
    // The single most important assertion in this file: Phase 1 (cancel)
    // must complete before Phase 2 (card refund) starts, regardless of
    // whether the refund succeeds. This is the literal fix for the
    // production incident — refunding before cancelling reproduces it if the
    // process crashes in between.
    mockRefundPayment.mockRejectedValue(new Error('EveryPay unreachable'));
    mockRefundToWallet.mockResolvedValue(undefined);

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]),
        ok({ id: SELLER_1_ORDER.id }), // claim-UPDATE succeeds
        ok(null),
        ok(null),
        ok([{ id: SELLER_1_ORDER.id }]), // order still 'cancelled' so this should be empty in reality,
        // but we don't assert on this response in this test — ordering is the point.
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    expect(mockOrdersUpdate).toHaveBeenCalled();
    expect(mockRefundPayment).toHaveBeenCalled();

    // attemptAutoRefund swallows the rejection internally (its own try/catch)
    // and is invoked via refundPayment — assert refundPayment's invocation
    // index against the claim-UPDATE's invocation index directly.
    const claimCallOrder = mockOrdersUpdate.mock.invocationCallOrder[0]!;
    const refundCallOrder = mockRefundPayment.mock.invocationCallOrder[0]!;
    expect(claimCallOrder).toBeLessThan(refundCallOrder);
  });

  it('4. is idempotent when the claim-UPDATE finds no row (already cancelled by a concurrent retry)', async () => {
    mockRefundPayment.mockResolvedValue(undefined);

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]), // pendingOrders re-query finds a row
        ok(null), // ...but the claim-UPDATE returns no row (race lost)
        ok([]), // stillLiveOrders re-query
      ],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await expect(
      fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card')
    ).resolves.toMatchObject({ outcome: 'failed' });

    // No wallet refund, no listings/order_items steps for an order that
    // never got claimed.
    expect(mockRefundToWallet).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockOrderItemsUpdate).not.toHaveBeenCalled();
  });

  it('5. threads cardRefundOk=false through when attemptAutoRefund resolves false (EveryPay down)', async () => {
    // attemptAutoRefund's real contract: it never throws to its caller — it
    // catches internally and resolves false. Model that here, not a rejection.
    mockRefundPayment.mockRejectedValue(new Error('EveryPay 503'));
    mockRefundToWallet.mockResolvedValue(undefined);

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]),
        ok({ id: SELLER_1_ORDER.id }),
        ok(null),
        ok(null),
        ok([]),
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    // The order is still cancelled (Phase 1 ran unconditionally)...
    expect(mockOrdersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    );
    // ...but the final stamp is 'partial' (card refund failed; the wallet leg
    // was a no-op success since buyer_wallet_debit_cents=0 on this order —
    // 'failed' only applies when BOTH legs fail).
    const finalStampCall = mockOrdersUpdate.mock.calls[mockOrdersUpdate.mock.calls.length - 1]![0];
    expect(finalStampCall).toMatchObject({ refund_status: 'partial' });

    // Sentry captured for the incomplete-refund outcome (Phase 3 only).
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'cart_rollback_refund_incomplete' }) })
    );
  });

  it('6. stamps partial and captures Sentry when the wallet refund leg fails for an order with buyer_wallet_debit_cents > 0', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockRejectedValue(new Error('wallet_refund RPC failed'));

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow({ buyer_wallet_debit_cents: 1000 })]),
        ok({ id: SELLER_1_ORDER.id }),
        ok(null),
        ok(null),
        ok([]),
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    expect(mockRefundToWallet).toHaveBeenCalledWith(
      'buyer-uuid-1', 1000, SELLER_1_ORDER.id, expect.any(String)
    );

    const finalStampCall = mockOrdersUpdate.mock.calls[mockOrdersUpdate.mock.calls.length - 1]![0];
    expect(finalStampCall).toMatchObject({ refund_status: 'partial' });

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'cart_rollback_wallet_refund_failed' }) })
    );
  });

  it('7. captures Sentry for listings-restore and order_items-deactivate failures but still cancels the order and continues rollback', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    const unreserveError = { message: 'unreserve_listings RPC failed' };
    const deactivateError = { message: 'order_items update failed' };

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]),
        ok({ id: SELLER_1_ORDER.id }),
        ok(null),
        ok(null),
        ok([]),
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
      rpcResponses: [fail(unreserveError)],
      orderItemsUpdateResponses: [fail(deactivateError)],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    const result = await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    expect(result.outcome).toBe('failed');

    expect(mockCaptureException).toHaveBeenCalledWith(
      unreserveError,
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'cart_rollback_listings_restore_failed' }) })
    );
    expect(mockCaptureException).toHaveBeenCalledWith(
      deactivateError,
      expect.objectContaining({ tags: expect.objectContaining({ phase: 'cart_rollback_order_items_deactivate_failed' }) })
    );

    // The order was still claimed/cancelled — rollback continues despite these failures.
    expect(mockOrdersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    );
  });

  it('8. subtracts the pre-loop partial (unavailable-items) refund from the mid-loop aggregate refund amount (Finding A regression)', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    // listing-3 is unavailable (different seller, fully gone) — triggers the
    // pre-loop partial refund for refundCardCents before the seller loop runs.
    const listings = [
      baseListing({ id: 'listing-1', seller_id: 'seller-uuid-1', price_cents: 5000 }),
      baseListing({ id: 'listing-2', seller_id: 'seller-uuid-2', price_cents: 5000, reserved_by: 'buyer-uuid-1' }),
      baseListing({
        id: 'listing-3', seller_id: 'seller-uuid-3', price_cents: 3000,
        status: 'sold', reserved_by: null,
      }),
    ];

    const client = makeClient({
      listings,
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]),
        ok({ id: SELLER_1_ORDER.id }),
        ok(null),
        ok(null),
        ok([]),
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    // listing-3's seller is fully unavailable (no other listing from
    // seller-uuid-3 in the cart), so the pre-loop refund also includes the
    // LV->LV shipping cost (190 cents) on top of the item price (3000).
    const listing3RefundCents = 3000 + 190;

    const group = twoSellerGroup({
      listing_ids: ['listing-1', 'listing-2', 'listing-3'],
      total_amount_cents: 13000 + 190,
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(group, 'ep-ref-1', 'settled', client, 'card');

    // Two refundPayment calls: the pre-loop partial (listing-3 + its
    // shipping) and the mid-loop aggregate (expectedEverypayAmountCents -
    // refundCardCents).
    expect(mockRefundPayment).toHaveBeenCalledTimes(2);
    const [firstCallAmount] = [mockRefundPayment.mock.calls[0]![1]];
    const [secondCallAmount] = [mockRefundPayment.mock.calls[1]![1]];
    expect(firstCallAmount).toBe(listing3RefundCents);
    // expectedEverypayAmountCents (13190) - refundCardCents (3190) = 10000, NOT 13190.
    expect(secondCallAmount).toBe(10000);
  });

  it('9. refunds the unavailable item wallet portion via refundToWallet (not creditWallet) when the seller loop also fails (Finding B regression)', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    const listings = [
      baseListing({ id: 'listing-1', seller_id: 'seller-uuid-1', price_cents: 5000 }),
      baseListing({ id: 'listing-2', seller_id: 'seller-uuid-2', price_cents: 5000, reserved_by: 'buyer-uuid-1' }),
      baseListing({
        id: 'listing-3', seller_id: 'seller-uuid-3', price_cents: 3000,
        status: 'sold', reserved_by: null,
      }),
    ];

    const client = makeClient({
      listings,
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]),
        ok({ id: SELLER_1_ORDER.id }),
        ok(null),
        ok(null),
        ok([]),
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    const group = twoSellerGroup({
      listing_ids: ['listing-1', 'listing-2', 'listing-3'],
      total_amount_cents: 13500,
      wallet_debit_cents: 500,
      wallet_allocation: { 'listing-3': 500 },
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(group, 'ep-ref-1', 'settled', client, 'card');

    expect(mockRefundToWallet).toHaveBeenCalledWith(
      'buyer-uuid-1', 500, 'group-uuid-1', expect.stringContaining('unavailable')
    );
  });

  it('10. refunds the unavailable-items wallet leg via refundToWallet on the happy path (no mid-loop failure) — creditWallet no longer used (Finding C regression)', async () => {
    const listings = [
      baseListing({ id: 'listing-1', seller_id: 'seller-uuid-1', price_cents: 5000 }),
      baseListing({
        id: 'listing-2', seller_id: 'seller-uuid-2', price_cents: 3000,
        status: 'sold', reserved_by: null,
      }),
    ];

    mockCreateOrder.mockReset();
    mockCreateOrder.mockResolvedValue(SELLER_1_ORDER);

    const client = makeClient({ listings });

    const group = baseCartGroup({
      listing_ids: ['listing-1', 'listing-2'],
      total_amount_cents: 8500,
      wallet_debit_cents: 500,
      wallet_allocation: { 'listing-2': 500 },
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    const result = await fulfillCartPayment(group, 'ep-ref-1', 'settled', client, 'card');

    expect(result.outcome).toBe('created');
    expect(mockRefundToWallet).toHaveBeenCalledWith(
      'buyer-uuid-1', 500, 'group-uuid-1', expect.any(String)
    );
    // creditWallet is no longer imported/used by the module under test —
    // confirmed structurally: the wallet mock factory exports no creditWallet
    // and the source's import line was updated in the same change (Part C).
  });

  it('11. fires the stranded-order-detected Sentry alert when the orders re-query finds more rows than createdOrders tracked', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    // pendingOrders returns 2 rows even though createdOrders only tracked 1
    // (seller 1's) — models a stranded row createOrder() failed to report.
    const strandedOrderRow = pendingOrderRow({ id: 'order-stranded', order_number: 'STG-20270115-ZZZZ' });

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow(), strandedOrderRow]),
        ok({ id: SELLER_1_ORDER.id }), // claim for seller 1's order
        ok(null),
        ok({ id: 'order-stranded' }), // claim for the stranded order
        ok(null),
        ok(null),
        ok(null),
        ok([]),
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }]), ok([{ listing_id: 'listing-stranded' }])],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tags: expect.objectContaining({ phase: 'cart_fulfillment_stranded_order_detected' }),
      })
    );
    const call = mockCaptureException.mock.calls.find(
      (c) => (c[1] as { tags?: { phase?: string } })?.tags?.phase === 'cart_fulfillment_stranded_order_detected'
    );
    expect(call![1].extra.dbOrderIds).toEqual(['order-seller-1', 'order-stranded']);
    expect(call![1].extra.trackedOrderIds).toEqual(['order-seller-1']);
  });

  it('12. fires the live-order-survived Sentry alert when a live order remains after total rollback; does not fire on the clean two-seller rollback', async () => {
    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    const survivorRow = { id: 'order-survivor' };

    const client = makeClient({
      listings: twoSellerListings(),
      ordersResponses: [
        ok([]),
        ok([pendingOrderRow()]),
        ok({ id: SELLER_1_ORDER.id }),
        ok(null),
        ok(null),
        ok([survivorRow]), // stillLiveOrders re-query finds a survivor
      ],
      orderItemsSelectResponses: [ok([{ listing_id: 'listing-1' }])],
    });

    const { fulfillCartPayment } = await import('./payment-fulfillment');
    await fulfillCartPayment(twoSellerGroup(), 'ep-ref-1', 'settled', client, 'card');

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tags: expect.objectContaining({ phase: 'cart_rollback_live_order_survived' }),
      })
    );
    const call = mockCaptureException.mock.calls.find(
      (c) => (c[1] as { tags?: { phase?: string } })?.tags?.phase === 'cart_rollback_live_order_survived'
    );
    expect(call![1].extra.liveOrderIds).toEqual(['order-survivor']);

    // Negative case: test 1's clean two-seller setup returns empty and must
    // NOT fire this alert — covered by test 1's own assertion above; this
    // comment documents the pairing per the task's test-12 spec.
  });
});
