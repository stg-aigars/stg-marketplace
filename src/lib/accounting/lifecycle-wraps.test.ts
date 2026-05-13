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
import { cartFulfillmentWithGL, completeOrderWithGL, refundOrderWithGL } from './lifecycle-wraps';

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

// ---------------------------------------------------------------------------
// cartFulfillmentWithGL — paired C.9 partial-refund branch (scenario 12 surface)
// ---------------------------------------------------------------------------
//
// The wrap's partial_refund branch (lifecycle-wraps.ts:639-682) fires alongside
// the C.1/C.2 emit when fulfillCartPayment auto-refunds unavailable listings.
// Production traffic exercises this branch when a cart hits the fulfillment
// callback with one or more listings that became unavailable between cart
// creation and Swedbank confirmation. The C.9 goes through a direct
// `insert_journal_entry` RPC, NOT the parent cart RPC (which only knows
// about a single event/lines payload).
//
// Integration test deferred per commit-13 scope-evaluation (heavy synthetic
// unavailable-listing setup); this unit test covers the wrap-layer dispatch
// + payload shape.

describe('cartFulfillmentWithGL — paired C.9 partial-refund branch', () => {
  /**
   * Mock supabase that dispatches `rpc()` by name — cart parent RPC returns
   * a journal_entry_id; insert_journal_entry returns the C.9 entry_id.
   */
  function makeCartSupabase(opts: {
    cartRpcResponse: { data: unknown; error: { code?: string; message: string } | null };
    insertJournalEntryResponse: { data: unknown; error: { code?: string; message: string } | null };
  }) {
    return {
      from: vi.fn(() => {
        const builder: Record<string, unknown> = {};
        const chainable = () => builder;
        builder.select = vi.fn(chainable);
        builder.eq = vi.fn(chainable);
        builder.in = vi.fn(chainable);
        builder.insert = vi.fn(chainable);
        builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
        builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
        return builder;
      }),
      rpc: vi.fn((rpcName: string) => {
        if (rpcName === 'cart_complete_payment_with_event_atomic') {
          return Promise.resolve(opts.cartRpcResponse);
        }
        if (rpcName === 'insert_journal_entry') {
          return Promise.resolve(opts.insertJournalEntryResponse);
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };
  }

  const CART_INPUT_PARTIAL = {
    cart_group_id: 'cart-test-1',
    buyer_id: 'buyer-1',
    payment_method: 'card' as const,
    gross_cart_cents: 10000,
    buyer_wallet_cents: 0,
    everypay_payment_reference: 'ep-test-1',
    callback_payload: { test_artifact: true },
    partial_refund: {
      refund_cents: 1500,
      buyer_wallet_refund_cents: 0,
    },
  };

  beforeEach(() => {
    // Two assembleEntryForRpc calls — first for the C.1 cart event, second for the C.9.
    mockAssembleEntryForRpc.mockReset();
    mockAssembleEntryForRpc
      .mockResolvedValueOnce({
        rpcEntry: { type_id: 'C.1', source_doc_type: 'cart_payment', source_doc_id: 'cart-test-1' },
        rpcLines: [],
        type_id: 'C.1',
      })
      .mockResolvedValueOnce({
        rpcEntry: {
          type_id: 'C.9',
          source_doc_type: 'cart_partial_refund',
          source_doc_id: 'cart_partial_cart-test-1_ep-test-1',
        },
        rpcLines: [],
        type_id: 'C.9',
      });
  });

  it('fires paired C.9 emit alongside the C.1; both journal_entry_ids returned; both audits fire', async () => {
    const supabase = makeCartSupabase({
      cartRpcResponse: {
        data: { journal_entry_id: 'je-c1-1', idempotent_skip: false },
        error: null,
      },
      insertJournalEntryResponse: { data: 'je-c9-1', error: null },
    });

    const result = await cartFulfillmentWithGL(supabase as never, CART_INPUT_PARTIAL);

    expect(result.cart_journal_entry_id).toBe('je-c1-1');
    expect(result.partial_refund_journal_entry_id).toBe('je-c9-1');
    expect(result.idempotent_skip).toBe(false);

    // Two assembles: one for the cart event, one for the C.9 refund event.
    expect(mockAssembleEntryForRpc).toHaveBeenCalledTimes(2);

    // Verify the C.9 event shape (second assembleEntryForRpc call's event arg)
    const c9EventArg = mockAssembleEntryForRpc.mock.calls[1][1] as Record<string, unknown>;
    expect(c9EventArg.source_doc_type).toBe('cart_partial_refund');
    expect(c9EventArg.source_doc_id).toBe('cart_partial_cart-test-1_ep-test-1');
    const payload = c9EventArg.payload as Record<string, unknown>;
    expect(payload.refund_cents).toBe(1500);
    expect(payload.payment_method).toBe('card');

    // Two audit fires: one for the cart C.1, one for the C.9
    expect(mockFireAccountingPostedAudit).toHaveBeenCalledTimes(2);
  });

  it('handles C.9 idempotent retry via 23505 recovery — re-SELECTs winner entry', async () => {
    let fromCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        const builder: Record<string, unknown> = {};
        const chainable = () => builder;
        builder.select = vi.fn(chainable);
        builder.eq = vi.fn(chainable);
        builder.in = vi.fn(chainable);
        builder.insert = vi.fn(chainable);
        // After the 23505 error, the wrap re-SELECTs journal_entries for the C.9 winner row.
        if (table === 'journal_entries') {
          fromCallCount++;
          builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: 'je-c9-recovered' }, error: null }));
        } else {
          builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
          builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
        }
        return builder;
      }),
      rpc: vi.fn((rpcName: string) => {
        if (rpcName === 'cart_complete_payment_with_event_atomic') {
          return Promise.resolve({ data: { journal_entry_id: 'je-c1-1', idempotent_skip: false }, error: null });
        }
        if (rpcName === 'insert_journal_entry') {
          // Simulate UNIQUE collision on the C.9 idempotency index
          return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    const result = await cartFulfillmentWithGL(supabase as never, CART_INPUT_PARTIAL);

    expect(result.cart_journal_entry_id).toBe('je-c1-1');
    expect(result.partial_refund_journal_entry_id).toBe('je-c9-recovered');
    expect(fromCallCount).toBeGreaterThan(0);

    // Recovery path skips audit (only one audit — for the C.1 cart entry).
    expect(mockFireAccountingPostedAudit).toHaveBeenCalledTimes(1);
  });

  it('skips C.9 emit when partial_refund.refund_cents === 0', async () => {
    mockAssembleEntryForRpc.mockReset();
    mockAssembleEntryForRpc.mockResolvedValueOnce({
      rpcEntry: { type_id: 'C.1', source_doc_type: 'cart_payment', source_doc_id: 'cart-test-1' },
      rpcLines: [],
      type_id: 'C.1',
    });

    const supabase = makeCartSupabase({
      cartRpcResponse: {
        data: { journal_entry_id: 'je-c1-1', idempotent_skip: false },
        error: null,
      },
      insertJournalEntryResponse: { data: null, error: null },
    });

    const result = await cartFulfillmentWithGL(supabase as never, {
      ...CART_INPUT_PARTIAL,
      partial_refund: { refund_cents: 0, buyer_wallet_refund_cents: 0 },
    });

    expect(result.cart_journal_entry_id).toBe('je-c1-1');
    expect(result.partial_refund_journal_entry_id).toBeNull();

    // Only ONE assembleEntryForRpc call (no C.9 event built)
    expect(mockAssembleEntryForRpc).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// refundOrderWithGL — cross-period (full_prior) branch (scenario 4 surface)
// ---------------------------------------------------------------------------
//
// When the antecedent O.x lives in a different `tax_period` from today's
// period, refundType discriminates to `'full_prior'` → routes to O.8 (vs
// `'full_current'` → O.7). The branch lives in lifecycle-wraps.ts:436-466.
// Integration test deferred per commit-13 scope-evaluation (multi-period
// state setup including prior-period P.1); this unit test covers the
// wrap-layer dispatch by inspecting the event passed to assembleEntryForRpc.

describe('refundOrderWithGL — cross-period (full_prior) branch', () => {
  const REFUND_ORDER_FOR_CROSS_PERIOD = {
    id: 'order-refund-cross-1',
    seller_id: 'user-seller-2',
    order_number: 'STG-2027-XP-1',
    invoice_number: 'STG-2027-INV-XP-1',
    credit_note_number: 'STG-CN-XP-1',
    items_total_cents: 5000,
    shipping_cost_cents: 350,
    total_amount_cents: 5350,
    payment_method: 'card' as const,
    cart_group_id: 'cart-xp-1',
  };

  const REFUND_EXECUTION_FULL = {
    card_refunded: 5350,
    wallet_refunded: 0,
    total_refunded: 5350,
    refund_status: 'completed' as const,
  };

  beforeEach(() => {
    // Fix system time so wrap's `period = today.substring(0,7)` is '2027-02'.
    // Antecedent's tax_period below is '2027-01' → mismatch → full_prior.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 1, 15, 12, 0, 0)));

    mockAssembleEntryForRpc.mockReset();
    mockAssembleEntryForRpc
      .mockResolvedValueOnce({
        rpcEntry: { type_id: 'O.8', source_doc_type: 'order', source_doc_id: REFUND_ORDER_FOR_CROSS_PERIOD.id },
        rpcLines: [],
        type_id: 'O.8',
      })
      .mockResolvedValueOnce({
        rpcEntry: {
          type_id: 'C.5',
          source_doc_type: 'refund',
          source_doc_id: `STG-RF-2027-02-${REFUND_ORDER_FOR_CROSS_PERIOD.order_number}`,
        },
        rpcLines: [],
        type_id: 'C.5',
      });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes to O.8 (full_prior) when antecedent.tax_period !== current period; threads original_invoice_id + original_period', async () => {
    const ANTECEDENT_CROSS = {
      id: 'je-o1-prior-period',
      type_id: 'O.1',
      tax_period: '2027-01',  // earlier than wrap's computed '2027-02'
    };

    const supabase = makeSupabase({
      counterpartyRow: SELLER_COUNTERPARTY,
      antecedentRow: ANTECEDENT_CROSS,
      rpcResponse: {
        data: {
          refund_entry_id: 'je-o8-1',
          cash_leg_entry_id: 'je-c5-1',
          orphan: false,
          idempotent_skip: false,
        },
        error: null,
      },
    });

    const result = await refundOrderWithGL(
      supabase as never,
      REFUND_ORDER_FOR_CROSS_PERIOD,
      REFUND_EXECUTION_FULL
    );

    expect(result.orphan).toBe(false);
    expect(result.refund_entry_id).toBe('je-o8-1');
    expect(result.cash_leg_entry_id).toBe('je-c5-1');

    // First assembleEntryForRpc call carries the refund event with the
    // full_prior shape. Inspect the event arg directly.
    expect(mockAssembleEntryForRpc).toHaveBeenCalled();
    const refundEventArg = mockAssembleEntryForRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(refundEventArg.event_type).toBe('order.refunded');
    const payload = refundEventArg.payload as Record<string, unknown>;
    expect(payload.tax_period_alignment).toBe('prior');
    expect(payload.original_invoice_id).toBe(ANTECEDENT_CROSS.id);
    expect(payload.original_period).toBe(ANTECEDENT_CROSS.tax_period);
  });

  it('routes to O.7 (full_current) when antecedent.tax_period === current period; no original_invoice_id', async () => {
    // Override the first assemble to reflect the O.7 path
    mockAssembleEntryForRpc.mockReset();
    mockAssembleEntryForRpc
      .mockResolvedValueOnce({
        rpcEntry: { type_id: 'O.7', source_doc_type: 'order', source_doc_id: REFUND_ORDER_FOR_CROSS_PERIOD.id },
        rpcLines: [],
        type_id: 'O.7',
      })
      .mockResolvedValueOnce({
        rpcEntry: {
          type_id: 'C.5',
          source_doc_type: 'refund',
          source_doc_id: `STG-RF-2027-02-${REFUND_ORDER_FOR_CROSS_PERIOD.order_number}`,
        },
        rpcLines: [],
        type_id: 'C.5',
      });

    const ANTECEDENT_SAME = {
      id: 'je-o1-same-period',
      type_id: 'O.1',
      tax_period: '2027-02',  // matches wrap's computed period
    };

    const supabase = makeSupabase({
      counterpartyRow: SELLER_COUNTERPARTY,
      antecedentRow: ANTECEDENT_SAME,
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

    await refundOrderWithGL(supabase as never, REFUND_ORDER_FOR_CROSS_PERIOD, REFUND_EXECUTION_FULL);

    const refundEventArg = mockAssembleEntryForRpc.mock.calls[0][1] as Record<string, unknown>;
    const payload = refundEventArg.payload as Record<string, unknown>;
    expect(payload.tax_period_alignment).toBe('current');
    // For full_current, original_invoice_id + original_period are not threaded
    expect(payload.original_invoice_id).toBeUndefined();
    expect(payload.original_period).toBeUndefined();
  });
});
