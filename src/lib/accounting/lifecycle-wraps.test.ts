/**
 * Unit tests for `lifecycle-wraps.ts` orphan-emit telemetry (PR C commit 13).
 *
 * Scoped to the orphan-path PostHog telemetry calls that integration tests
 * can't verify (PostHog is fire-and-forget; the audit_log query approach
 * used elsewhere doesn't apply). Per the commit-13 preamble Q13-3 + the
 * user's Flag #2 sign-off, these unit tests cover the gap.
 *
 * The wraps mock supabase.rpc to return `orphan: true` synthetically, then
 * assert `trackServer` was called with the expected event_type + payload
 * shape. Mocks: trackServer, assembleEntryForRpc, fireAccountingPostedAudit,
 * resolveSellerCounterparty (via supabase mock).
 *
 * Two surfaces:
 *   1. `completeOrderWithGL` — cutover-window orphan (order has no
 *      C.1/C.2 antecedent). RPC returns `orphan: true`; wallet credit
 *      still happens; no GL emit; telemetry fires.
 *   2. `refundOrderWithGL` — refund of an order without an O.x antecedent
 *      (synthetic or cancelled-pre-cutover order). RPC returns
 *      `orphan: true`; refund-side O.x emit skipped; C.5 cash leg still
 *      fires when card_refunded > 0; telemetry fires.
 *
 * The "happy path" (orphan: false) is NOT re-tested here — that's covered
 * by `payment-fulfillment.test.ts`, `order-transitions.test.ts`, and
 * `order-refund.test.ts` which mock the wraps at their service-layer
 * boundary. This file specifically targets the wrap-internal telemetry
 * branch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockTrackServer,
  mockAssembleEntryForRpc,
  mockFireAccountingPostedAudit,
  mockLookupVatRate,
} = vi.hoisted(() => ({
  mockTrackServer: vi.fn(),
  mockAssembleEntryForRpc: vi.fn(),
  mockFireAccountingPostedAudit: vi.fn(),
  mockLookupVatRate: vi.fn(),
}));

vi.mock('@/lib/analytics/track-server', () => ({
  trackServer: mockTrackServer,
}));

vi.mock('./posting-engine', () => ({
  assembleEntryForRpc: mockAssembleEntryForRpc,
  fireAccountingPostedAudit: mockFireAccountingPostedAudit,
}));

vi.mock('./computer', async () => {
  const actual = await vi.importActual<typeof import('./computer')>('./computer');
  return {
    ...actual,
    lookupVatRate: mockLookupVatRate,
  };
});

// Import AFTER mocks so module-load-time references pick up the mocks.
import { completeOrderWithGL, refundOrderWithGL } from './lifecycle-wraps';

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

interface MockSupabaseOpts {
  /** Response to .rpc() — the parent RPC return shape. */
  rpcResponse: { data: unknown; error: { code?: string; message: string } | null };
  /** Counterparty row returned from .from('counterparties').select(...).maybeSingle(). */
  counterpartyRow?: Record<string, unknown> | null;
  /** Profile row returned from .from('user_profiles').select(...).single() during lazy-init. */
  profileRow?: Record<string, unknown> | null;
  /** Antecedent journal-entry lookup for refundOrderWithGL — .from('journal_entries').select(...).maybeSingle(). */
  antecedentRow?: { id: string; type_id: string; tax_period: string } | null;
}

function makeSupabase(opts: MockSupabaseOpts) {
  const cpResponse = { data: opts.counterpartyRow ?? null, error: null };
  const profileResponse = { data: opts.profileRow ?? null, error: null };
  const antecedentResponse = { data: opts.antecedentRow ?? null, error: null };

  return {
    from: vi.fn((table: string) => {
      // counterparties: select → eq(user_id) → eq(type) → maybeSingle
      //                 OR insert → select → single
      // user_profiles: select → eq → single
      // journal_entries: select → eq → eq → in → maybeSingle
      const builder: Record<string, unknown> = {};
      const chainable = () => builder;
      builder.select = vi.fn(chainable);
      builder.eq = vi.fn(chainable);
      builder.in = vi.fn(chainable);
      builder.insert = vi.fn(chainable);

      if (table === 'counterparties') {
        builder.maybeSingle = vi.fn(() => Promise.resolve(cpResponse));
        // Insert path during lazy-init (only fires when counterparty doesn't exist).
        // For these tests we always preload the counterparty, so insert is not called.
        builder.single = vi.fn(() => Promise.resolve(cpResponse));
      } else if (table === 'user_profiles') {
        builder.single = vi.fn(() => Promise.resolve(profileResponse));
      } else if (table === 'journal_entries') {
        builder.maybeSingle = vi.fn(() => Promise.resolve(antecedentResponse));
      } else {
        builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
        builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
      }
      return builder;
    }),
    rpc: vi.fn(() => Promise.resolve(opts.rpcResponse)),
  };
}

const SELLER_COUNTERPARTY = {
  id: '00000000-0000-4000-8000-aaaa11110001',
  type: 'seller',
  country: 'LV',
  tax_status: 'private',
  vies_verified_at: null,
  vendor_code: null,
  legal_compliance_status: 'ok',
};

const ORDER_FIXTURE = {
  id: 'order-test-1',
  seller_id: 'user-seller-1',
  seller_country: 'LV' as const,
  items_total_cents: 5000,
  shipping_cost_cents: 350,
  order_number: 'STG-2027-TEST-1',
  cart_group_id: 'cart-test-1',
};

beforeEach(() => {
  mockAssembleEntryForRpc.mockResolvedValue({
    rpcEntry: { type_id: 'O.1', source_doc_type: 'order', source_doc_id: 'order-test-1' },
    rpcLines: [],
    type_id: 'O.1',
  });
  mockLookupVatRate.mockResolvedValue(0.21);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// completeOrderWithGL — orphan-path telemetry
// ---------------------------------------------------------------------------

describe('completeOrderWithGL — orphan-path PostHog telemetry', () => {
  it('fires accounting.orphan_emit_skipped when parent RPC returns orphan=true', async () => {
    const supabase = makeSupabase({
      counterpartyRow: SELLER_COUNTERPARTY,
      rpcResponse: {
        data: {
          wallet_txn_id: 'wallet-txn-1',
          journal_entry_id: null,  // orphan = no GL emit
          orphan: true,
          idempotent_skip: false,
        },
        error: null,
      },
    });

    const result = await completeOrderWithGL(supabase as never, ORDER_FIXTURE);

    expect(result.orphan).toBe(true);
    expect(result.journal_entry_id).toBeNull();

    expect(mockTrackServer).toHaveBeenCalledTimes(1);
    expect(mockTrackServer).toHaveBeenCalledWith(
      'accounting.orphan_emit_skipped',
      ORDER_FIXTURE.seller_id,
      expect.objectContaining({
        orphan_type: 'completion',
        order_id: ORDER_FIXTURE.id,
        cart_payment_id: ORDER_FIXTURE.cart_group_id,
        expected_antecedent_type_ids: ['C.1', 'C.2'],
        service_file: 'order-transitions.ts',
      })
    );

    // Audit fires ONLY when journal_entry_id is non-null; orphan path skips it.
    expect(mockFireAccountingPostedAudit).not.toHaveBeenCalled();
  });

  it('does NOT fire orphan telemetry when RPC returns a journal_entry_id (happy path)', async () => {
    const supabase = makeSupabase({
      counterpartyRow: SELLER_COUNTERPARTY,
      rpcResponse: {
        data: {
          wallet_txn_id: 'wallet-txn-1',
          journal_entry_id: 'je-o1-1',
          orphan: false,
          idempotent_skip: false,
        },
        error: null,
      },
    });

    await completeOrderWithGL(supabase as never, ORDER_FIXTURE);

    expect(mockTrackServer).not.toHaveBeenCalled();
    expect(mockFireAccountingPostedAudit).toHaveBeenCalledTimes(1);
  });

  it('threads order.cart_group_id (nullable) into telemetry payload', async () => {
    // Orphan + null cart_group_id (wallet-only-cart-completed-post-cutover edge case)
    const supabase = makeSupabase({
      counterpartyRow: SELLER_COUNTERPARTY,
      rpcResponse: {
        data: { wallet_txn_id: null, journal_entry_id: null, orphan: true, idempotent_skip: false },
        error: null,
      },
    });

    await completeOrderWithGL(supabase as never, { ...ORDER_FIXTURE, cart_group_id: null });

    expect(mockTrackServer).toHaveBeenCalledWith(
      'accounting.orphan_emit_skipped',
      ORDER_FIXTURE.seller_id,
      expect.objectContaining({
        orphan_type: 'completion',
        cart_payment_id: null,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// refundOrderWithGL — orphan-path telemetry
// ---------------------------------------------------------------------------

describe('refundOrderWithGL — orphan-path PostHog telemetry', () => {
  const REFUND_ORDER = {
    id: 'order-refund-1',
    seller_id: 'user-seller-1',
    order_number: 'STG-2027-RF-1',
    invoice_number: 'STG-2027-INV-1',
    credit_note_number: null,
    items_total_cents: 5000,
    shipping_cost_cents: 350,
    total_amount_cents: 5350,
    payment_method: 'card' as const,
    cart_group_id: 'cart-test-1',
  };

  const REFUND_EXECUTION = {
    card_refunded: 5350,
    wallet_refunded: 0,
    total_refunded: 5350,
    refund_status: 'completed' as const,
  };

  it('fires accounting.orphan_emit_skipped when refund RPC returns orphan=true', async () => {
    const supabase = makeSupabase({
      counterpartyRow: SELLER_COUNTERPARTY,
      antecedentRow: null,  // no O.x antecedent → orphan
      rpcResponse: {
        data: {
          refund_entry_id: null,
          cash_leg_entry_id: 'je-c5-1',  // C.5 still fires (cash actually moved)
          orphan: true,
          idempotent_skip: false,
        },
        error: null,
      },
    });

    const result = await refundOrderWithGL(supabase as never, REFUND_ORDER, REFUND_EXECUTION);

    expect(result.orphan).toBe(true);
    expect(result.refund_entry_id).toBeNull();
    expect(result.cash_leg_entry_id).toBe('je-c5-1');

    expect(mockTrackServer).toHaveBeenCalledTimes(1);
    expect(mockTrackServer).toHaveBeenCalledWith(
      'accounting.orphan_emit_skipped',
      REFUND_ORDER.seller_id,
      expect.objectContaining({
        orphan_type: 'refund',
        order_id: REFUND_ORDER.id,
        cart_payment_id: REFUND_ORDER.cart_group_id,
        expected_antecedent_type_ids: ['O.1', 'O.2', 'O.3', 'O.4', 'O.5'],
        service_file: 'order-refund.ts',
      })
    );

    // C.5 audit fires (cash leg entry exists); refund-side audit doesn't (entry is null).
    expect(mockFireAccountingPostedAudit).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire orphan telemetry when antecedent exists (happy refund path)', async () => {
    const supabase = makeSupabase({
      counterpartyRow: SELLER_COUNTERPARTY,
      antecedentRow: {
        id: 'je-o1-original',
        type_id: 'O.1',
        tax_period: '2027-01',
      },
      rpcResponse: {
        data: {
          refund_entry_id: 'je-o7-1',
          cash_leg_entry_id: 'je-c5-1',
          orphan: false,
          idempotent_skip: false,
        },
        error: null,
      },
    });

    await refundOrderWithGL(supabase as never, REFUND_ORDER, REFUND_EXECUTION);

    expect(mockTrackServer).not.toHaveBeenCalled();
    expect(mockFireAccountingPostedAudit).toHaveBeenCalledTimes(2);  // both refund + cash leg
  });
});
