/**
 * fulfillCartPayment wrap tests (PR C commit 9).
 *
 * Covers the ACCOUNTING_ENGINE_ENABLED flag-check at the cart_checkout_groups
 * update point. Flag-OFF runs byte-identical to pre-PR-C behaviour (direct
 * UPDATE statement against the table); flag-ON delegates to
 * cartFulfillmentWithGL which composes the status flip + paid_at stamp +
 * C.1/C.2 GL emit through the cart_complete_payment_with_event_atomic
 * parent RPC, plus a paired C.9 emit when partial refunds fired upstream.
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
 * Scope here: the wrap-or-direct-update branch in fulfillCartPayment fires
 * the right call with the right inputs in every variant.
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
const mockCreditWallet = vi.fn().mockResolvedValue(undefined);
const mockRefundToWallet = vi.fn().mockResolvedValue(undefined);
const mockRefundPayment = vi.fn().mockResolvedValue(undefined);
const mockSendCartOrderEmails = vi.fn().mockResolvedValue(undefined);
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);

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
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
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

function makeQueryBuilder(resolvedData: unknown = null, resolvedError: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'neq', 'lt', 'gt', 'in', 'not', 'limit', 'returns', 'is'];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: resolvedData, error: resolvedError });
  return builder;
}

interface MakeClientOpts {
  /** listings.select() returns this set. */
  listings: ReadonlyArray<Record<string, unknown>>;
  /** Existing orders for the cart group (idempotency check). */
  existingOrders?: ReadonlyArray<{ id: string }>;
}

function makeClient(opts: MakeClientOpts) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        // First call: existing-orders check (lines 83-90). Second call (if any):
        // .update for the orders-table mid-loop rollback path; we route both to
        // the same chainable builder and let the test assert on its internals.
        const builder: Record<string, unknown> = {
          ...makeQueryBuilder(opts.existingOrders ?? [], null),
          update: (...args: unknown[]) => {
            mockOrdersUpdate(...args);
            return builder;
          },
        };
        return builder;
      }
      if (table === 'listings') {
        return makeQueryBuilder(opts.listings, null);
      }
      if (table === 'listing_expansions') {
        return makeQueryBuilder([], null);
      }
      if (table === 'cart_checkout_groups') {
        const builder: Record<string, unknown> = {
          ...makeQueryBuilder(null, null),
          update: (...args: unknown[]) => {
            mockCartCheckoutGroupsUpdate(...args);
            return builder;
          },
        };
        return builder;
      }
      return makeQueryBuilder(null, null);
    }),
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
