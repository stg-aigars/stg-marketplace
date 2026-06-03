/**
 * Event-builder helpers for marketplace lifecycle integration.
 *
 * Each function takes pre-loaded marketplace data (orders, counterparties,
 * payment intents — fetched by the caller) and produces a PostingEvent shape
 * ready to pass to engine.emit() or to a parent RPC's payload.
 *
 * Coverage map (event_type → which v3 mapping entry catches it):
 *
 *   buildCartPaymentEvent          → 'everypay.payment_confirmed' → C.1 / C.2
 *                                    by payload.payment_method
 *   buildOrderCompletionEvent      → 'order.completed'            → O.1–O.5
 *                                    by counterparty country/tax_status
 *   buildRefundEvent (full)        → 'order.refunded'             → O.7 / O.8
 *                                    by payload.tax_period_alignment
 *   buildRefundEvent (partial)     → 'order.partial_refunded'     → O.9
 *   buildRefundCashLegEvent        → 'order.refund_initiated'     → C.5
 *   buildWithdrawalCompletionEvent → 'seller.withdrawal_requested' → C.4
 *                                    (Shape 2 timing: fires at staff
 *                                     completion, not at request — STG's
 *                                     manual-SEPA reality has days-long lag
 *                                     between request and bank send. The
 *                                     event_type still matches v3 catalog
 *                                     routing for C.4; the wrap site decides
 *                                     timing.)
 */

import { SYSTEM_COUNTERPARTY } from './system-counterparties';
import type { PostingEvent } from './types';

/**
 * Shared temporal/audit fields every PostingEvent builder needs. Extending
 * Build*EventInput from this drops 5× duplication and keeps all builders in
 * sync if PostingEvent grows another required temporal key.
 */
interface PostingPeriodInput {
  posting_date: string;
  accounting_period: string;
  tax_period: string;
  actor_id?: string;
}

// ---------------------------------------------------------------------------
// buildCartPaymentEvent — C.1 (card) / C.2 (PIS)
// ---------------------------------------------------------------------------

export interface BuildCartPaymentEventInput extends PostingPeriodInput {
  cart_payment_id: string;
  everypay_payment_id: string;
  payment_method: 'card' | 'bank_link';
  /** Total cart price (item + shipping); becomes the Cr 5590 suspense amount. */
  gross_cart_cents: number;
  /**
   * Portion paid from buyer's wallet balance. Defaults to 0 when buyer paid
   * entirely via EveryPay. When > 0, the compute() emits a 3-line entry with
   * Dr 5351 (buyer counterparty) for the wallet portion + Dr 2630/2610 for
   * the EveryPay portion + Cr 5590 for the gross. PR C commit 9 / Q3 Option α.
   */
  buyer_wallet_cents?: number;
  /**
   * Buyer's auth.users.id. Required when `buyer_wallet_cents > 0` — stamped
   * into posting_context so the wallet-integrity dashboard can attribute the
   * Dr 5351 line back to a user (journal_lines.counterparty_id stays null
   * because the counterparties.type CHECK doesn't include 'buyer' today;
   * counterparty_type='buyer' marks the role and buyer_id carries the
   * attribution). Omitted when buyer paid entirely via EveryPay.
   */
  buyer_id?: string;
  callback_payload: Record<string, unknown>;
  /**
   * Staff-test marker — propagated to posting_context so PR #4 reporting
   * views can filter stage-2 cutover burn-in entries out of customer-traffic
   * dashboards. Caller derives from `cart_checkout_groups.is_staff_test`.
   * Defaults to false (real customer traffic).
   */
  is_staff_test?: boolean;
  /**
   * Bank-rail override for the C.2 (bank_link) cash leg. When set, the gross
   * (or EveryPay portion) debits this account instead of the C.2 default 2610.
   * The cart wrap passes '2620' for bank-link receipts (they land directly in
   * the e-commerce settlement account). Omitted for card (C.1), which always
   * uses the 2630 EveryPay clearing default until C.3 settles.
   */
  bank_account?: string;
}

/**
 * Builds the C.1 (card) or C.2 (bank_link / PIS) cart-payment cash-leg event.
 * Fired at cart fulfillment time. No VAT recognition — that defers to O.1–O.5
 * at order completion.
 */
export function buildCartPaymentEvent(input: BuildCartPaymentEventInput): PostingEvent {
  const buyer_wallet_cents = input.buyer_wallet_cents ?? 0;
  return {
    event_type: 'everypay.payment_confirmed',
    source_doc_type: 'cart_payment',
    source_doc_id: input.cart_payment_id,
    posting_date: input.posting_date,
    accounting_period: input.accounting_period,
    tax_period: input.tax_period,
    narrative: `Cart payment confirmed (${input.payment_method}) — pre-completion suspense`,
    emission_source: 'lifecycle',
    payload: {
      payment_method: input.payment_method,
      gross_cart_cents: input.gross_cart_cents,
      buyer_wallet_cents,
      ...(input.buyer_id !== undefined ? { buyer_id: input.buyer_id } : {}),
      ...(input.bank_account !== undefined ? { bank_account: input.bank_account } : {}),
      cart_payment_id: input.cart_payment_id,
      everypay_payment_id: input.everypay_payment_id,
      callback_payload: input.callback_payload,
      is_staff_test: input.is_staff_test ?? false
    },
    created_by: input.actor_id
  };
}

// ---------------------------------------------------------------------------
// buildCartPartialRefundCashLegEvent — C.9
// ---------------------------------------------------------------------------

export interface BuildCartPartialRefundCashLegEventInput extends PostingPeriodInput {
  cart_payment_id: string;
  everypay_payment_id: string;
  payment_method: 'card' | 'bank_link';
  /** Total refund amount in cents (EveryPay leg + buyer-wallet leg). */
  refund_cents: number;
  /**
   * Portion of the refund credited back to buyer wallet (defaults to 0 when
   * unavailable items were paid entirely via EveryPay). Compute emits a 3-line
   * entry when > 0: Dr 5590 / Cr bank_rail (EveryPay portion) / Cr 5351-buyer
   * (wallet portion). When 0, the entry stays 2 lines.
   */
  buyer_wallet_refund_cents?: number;
  /**
   * Buyer's auth.users.id. Required when `buyer_wallet_refund_cents > 0`;
   * stamped into posting_context for wallet-integrity attribution.
   */
  buyer_id?: string;
  /**
   * Stable per-refund identifier for idempotency. Using cart_payment_id alone
   * would collide on (source_doc_type, source_doc_id, type_id) UNIQUE if a
   * cart ever ends up with two partial-refund emits — unlikely in practice
   * (the partial-refund step fires once during fulfillCartPayment), but the
   * defensive shape mirrors the credit_note_number pattern for O.9.
   */
  refund_reference: string;
  /** Inherits from the parent cart's is_staff_test. Defaults to false. */
  is_staff_test?: boolean;
}

/**
 * Builds the C.9 cart-time partial-refund cash-leg event. Fires alongside
 * C.1/C.2 when fulfillCartPayment auto-refunds part of a cart because one or
 * more listings became unavailable. Pairs with the C.1/C.2 emission in the
 * same atomic transaction (both PERFORM'd by the cart parent RPC, or both
 * emitted in sequence by the wrap when the partial-refund discriminator
 * branches at the wrap layer — see lifecycle-wraps.ts).
 */
export function buildCartPartialRefundCashLegEvent(
  input: BuildCartPartialRefundCashLegEventInput
): PostingEvent {
  const buyer_wallet_refund_cents = input.buyer_wallet_refund_cents ?? 0;
  return {
    event_type: 'cart.partial_refund_cash_leg',
    source_doc_type: 'cart_partial_refund',
    source_doc_id: input.refund_reference,
    posting_date: input.posting_date,
    accounting_period: input.accounting_period,
    tax_period: input.tax_period,
    narrative: `Cart partial refund (${input.payment_method}) — ${input.refund_reference}`,
    emission_source: 'lifecycle',
    payload: {
      cart_payment_id: input.cart_payment_id,
      everypay_payment_id: input.everypay_payment_id,
      payment_method: input.payment_method,
      refund_cents: input.refund_cents,
      buyer_wallet_refund_cents,
      ...(input.buyer_id !== undefined ? { buyer_id: input.buyer_id } : {}),
      refund_reference: input.refund_reference,
      is_staff_test: input.is_staff_test ?? false
    },
    created_by: input.actor_id
  };
}

// ---------------------------------------------------------------------------
// buildOrderCompletionEvent — O.1 / O.2 / O.3 / O.4 / O.5
// ---------------------------------------------------------------------------

export interface BuildOrderCompletionEventInput extends PostingPeriodInput {
  order_id: string;
  seller_counterparty_id: string;
  /** Buyer's gross item value (excludes shipping). */
  item_value_cents: number;
  /** Buyer's gross shipping payment. STG records the matching Unisend expense at I.1 vendor invoice receipt time, not at completion (per v1.4 signoff doc). */
  shipping_value_cents: number;
  invoice_number: string;
  /**
   * Seller's domicile country. Drives the OSS `consumption_ms` payload key
   * required by mapping rows O.3 (LT B2C OSS) and O.5 (EE B2C OSS) — both
   * declare `consumption_ms` in `posting_context_required_keys`. STG's
   * compute hardcodes `oss_consumption_ms` to the seller's country in the
   * resulting posting_context_extras; passing it here satisfies the
   * presence-check at `validateRequiredKeys`. Harmless on non-OSS routes
   * (O.1 / O.2 / O.4) where the key isn't required.
   */
  seller_country: 'LV' | 'LT' | 'EE';
  /** Drives narrative + posting_context.completion_trigger; routing is by counterparty fields. */
  completion_source: 'delivery_confirmed' | 'auto_complete' | 'dispute_no_refund';
  /**
   * Staff-test marker — propagated to posting_context for stage-2 cutover
   * burn-in entry tagging. Caller derives from `orders.is_staff_test`.
   * Defaults to false (real customer traffic).
   */
  is_staff_test?: boolean;
}

/**
 * Builds the O.1–O.5 order-completion event. Dispatcher routes to the
 * specific O.x by the seller's country + tax_status (loaded by the engine
 * from `counterparty_id` before dispatch).
 *
 * The 6-line completion entry shape is per
 * `docs/legal_audit/accountant-completion-entry-signoff.md` v1.2 (VAT-inclusive
 * decomposition). Engine produces the full entry via `buildOrderRevenueLines`.
 */
export function buildOrderCompletionEvent(input: BuildOrderCompletionEventInput): PostingEvent {
  return {
    event_type: 'order.completed',
    source_doc_type: 'order',
    source_doc_id: input.order_id,
    posting_date: input.posting_date,
    accounting_period: input.accounting_period,
    tax_period: input.tax_period,
    narrative: `Order completion — invoice ${input.invoice_number} (${input.completion_source})`,
    emission_source: 'lifecycle',
    counterparty_id: input.seller_counterparty_id,
    payload: {
      order_id: input.order_id,
      seller_id: input.seller_counterparty_id,
      item_value_cents: input.item_value_cents,
      shipping_value_cents: input.shipping_value_cents,
      invoice_number: input.invoice_number,
      consumption_ms: input.seller_country,
      completion_trigger: input.completion_source,
      is_staff_test: input.is_staff_test ?? false
    },
    created_by: input.actor_id
  };
}

// ---------------------------------------------------------------------------
// buildRefundEvent — O.7 / O.8 (full) or O.9 (partial)
// ---------------------------------------------------------------------------

export type RefundType = 'full_current' | 'full_prior' | 'partial';

export interface BuildRefundEventInput extends PostingPeriodInput {
  order_id: string;
  seller_counterparty_id: string;
  refund_type: RefundType;
  original_invoice_number: string;
  credit_note_number: string;
  /** Required for partial refunds. */
  original_item_value_cents?: number;
  original_commission_gross_cents?: number;
  original_shipping_value_cents?: number;
  refund_item_cents?: number;
  refund_shipping_cents?: number;
  vat_rate?: number;
  vat_country?: 'LV' | 'LT' | 'EE';
  vat_account?: string | null;
  /** Required for cross-period refunds (O.8). */
  original_invoice_id?: string;
  original_period?: string;
  /** Pre-computed reversal lines for full refunds (O.7 / O.8). */
  lines?: ReadonlyArray<unknown>;
  /** Inherits from the parent order's is_staff_test. Defaults to false. */
  is_staff_test?: boolean;
}

/**
 * Builds the refund-side credit-note event. Discriminates on `refund_type`:
 *
 *   - 'full_current' → event_type='order.refunded',
 *                      payload.tax_period_alignment='current'  (→ O.7)
 *   - 'full_prior'   → event_type='order.refunded',
 *                      payload.tax_period_alignment='prior'    (→ O.8)
 *   - 'partial'      → event_type='order.partial_refunded'     (→ O.9)
 *
 * Full refunds use pre-computed reversal lines (caller reads original O.x
 * entry and passes the lines via payload). Partial refunds rely on O.9's
 * proportional split compute() — caller passes original totals + refund
 * amounts via payload (no pre-computed lines).
 *
 * The cash leg of the refund (Dr 2351 / Cr 2630|2610) emits separately via
 * buildRefundCashLegEvent → C.5.
 */
export function buildRefundEvent(input: BuildRefundEventInput): PostingEvent {
  if (input.refund_type === 'partial') {
    return {
      event_type: 'order.partial_refunded',
      emission_source: 'lifecycle',
      source_doc_type: 'order',
      // Per-credit-note idempotency: a single order can have multiple partial
      // refunds over time (e.g., €30 today, €20 next week). Each must produce
      // its own O.9 journal entry. Using order_id as source_doc_id would
      // collide on the (source_doc_type, source_doc_id, type_id) UNIQUE index
      // (migration 097) and the engine would silently return the first refund
      // on the second call. credit_note_number is unique per refund event by
      // construction. (Full refunds O.7/O.8 below correctly keep source_doc_id
      // = order_id — an order is fully refunded only once; retries of the same
      // call should idempotency-skip.)
      source_doc_id: input.credit_note_number,
      posting_date: input.posting_date,
      accounting_period: input.accounting_period,
      tax_period: input.tax_period,
      narrative: `Partial refund — credit note ${input.credit_note_number} for ${input.original_invoice_number}`,
      counterparty_id: input.seller_counterparty_id,
      payload: {
        order_id: input.order_id,
        original_invoice_number: input.original_invoice_number,
        credit_note_number: input.credit_note_number,
        original_item_value_cents: input.original_item_value_cents,
        original_commission_gross_cents: input.original_commission_gross_cents,
        original_shipping_value_cents: input.original_shipping_value_cents,
        refund_item_cents: input.refund_item_cents,
        refund_shipping_cents: input.refund_shipping_cents,
        vat_rate: input.vat_rate,
        vat_country: input.vat_country,
        vat_account: input.vat_account,
        is_staff_test: input.is_staff_test ?? false
      },
      created_by: input.actor_id
    };
  }

  const tax_period_alignment = input.refund_type === 'full_current' ? 'current' : 'prior';
  return {
    event_type: 'order.refunded',
    emission_source: 'lifecycle',
    source_doc_type: 'order',
    source_doc_id: input.order_id,
    posting_date: input.posting_date,
    accounting_period: input.accounting_period,
    tax_period: input.tax_period,
    narrative: `Full refund (${tax_period_alignment} period) — credit note ${input.credit_note_number} for ${input.original_invoice_number}`,
    counterparty_id: input.seller_counterparty_id,
    payload: {
      order_id: input.order_id,
      original_invoice_number: input.original_invoice_number,
      credit_note_number: input.credit_note_number,
      tax_period_alignment,
      original_invoice_id: input.original_invoice_id,
      original_period: input.original_period,
      lines: input.lines,
      is_staff_test: input.is_staff_test ?? false
    },
    created_by: input.actor_id
  };
}

// ---------------------------------------------------------------------------
// buildRefundCashLegEvent — C.5
// ---------------------------------------------------------------------------

export interface BuildRefundCashLegEventInput extends PostingPeriodInput {
  order_id: string;
  refund_reference: string;
  refund_cents: number;
  funding_source: 'everypay' | 'bank';
  /** Inherits from the parent order's is_staff_test. Defaults to false. */
  is_staff_test?: boolean;
}

/**
 * Builds the C.5 cash-leg event for a refund. Fires alongside buildRefundEvent
 * (the credit-note side). The two events combined record the full refund
 * transaction in the GL.
 */
export function buildRefundCashLegEvent(input: BuildRefundCashLegEventInput): PostingEvent {
  return {
    event_type: 'order.refund_initiated',
    emission_source: 'lifecycle',
    source_doc_type: 'refund',
    source_doc_id: input.refund_reference,
    posting_date: input.posting_date,
    accounting_period: input.accounting_period,
    tax_period: input.tax_period,
    narrative: `Refund cash leg (${input.funding_source}) — ${input.refund_reference}`,
    payload: {
      order_id: input.order_id,
      refund_reference: input.refund_reference,
      refund_cents: input.refund_cents,
      funding_source: input.funding_source,
      is_staff_test: input.is_staff_test ?? false
    },
    created_by: input.actor_id
  };
}

// ---------------------------------------------------------------------------
// buildWithdrawalCompletionEvent — C.4 (Shape 2 timing)
// ---------------------------------------------------------------------------

export interface BuildWithdrawalCompletionEventInput extends PostingPeriodInput {
  withdrawal_request_id: string;
  seller_counterparty_id: string;
  withdrawal_cents: number;
  withdrawal_ref: string;
  seller_iban: string;
  bank_confirmation_ref?: string;
  /**
   * Staff-test marker — propagated to posting_context for stage-2 cutover
   * burn-in entry tagging. Caller derives from `withdrawal_requests.is_staff_test`.
   * Defaults to false (real seller withdrawal).
   */
  is_staff_test?: boolean;
}

/**
 * Builds the C.4 wallet-withdrawal event. Per Shape 2 (manual-SEPA-friendly,
 * round-2 brief §3.3), this fires at staff-marked completion time, not at
 * request time — STG diverges from v3 C.4's eager-firing prescription
 * because manual SEPA has days-long lag.
 *
 * The event_type is still 'seller.withdrawal_requested' (matches v3 catalog
 * routing for C.4); the wrap site decides timing.
 */
export function buildWithdrawalCompletionEvent(input: BuildWithdrawalCompletionEventInput): PostingEvent {
  return {
    event_type: 'seller.withdrawal_requested',
    emission_source: 'lifecycle',
    source_doc_type: 'withdrawal_request',
    source_doc_id: input.withdrawal_request_id,
    posting_date: input.posting_date,
    accounting_period: input.accounting_period,
    tax_period: input.tax_period,
    narrative: `Wallet withdrawal completion — ${input.withdrawal_ref}`,
    counterparty_id: input.seller_counterparty_id,
    payload: {
      seller_id: input.seller_counterparty_id,
      withdrawal_request_id: input.withdrawal_request_id,
      withdrawal_cents: input.withdrawal_cents,
      withdrawal_ref: input.withdrawal_ref,
      seller_iban: input.seller_iban,
      bank_confirmation_ref: input.bank_confirmation_ref,
      is_staff_test: input.is_staff_test ?? false
    },
    created_by: input.actor_id
  };
}

// ---------------------------------------------------------------------------
// buildEverypaySettlementEvent — C.3 (staff-manual emission)
// ---------------------------------------------------------------------------

export interface BuildEverypaySettlementEventInput {
  /**
   * Bank statement reference for this settlement. Doubles as both the
   * source_doc_id (idempotency key) AND the payload's everypay_settlement_id.
   * Bank statement references are unique per settlement event by issuance,
   * so the natural-key shape is correct for engine UNIQUE dedup.
   */
  bank_statement_reference: string;
  settlement_cents: number;
  /** YYYY-MM-DD; EveryPay batch identifier. */
  batch_date: string;
  /** YYYY-MM-DD; date Swedbank credited STG (drives posting_date + period). */
  settlement_value_date: string;
  /** Cart-payment refs included in this batch. Empty array is acceptable. */
  included_txn_refs: string[];
  /** Optional staff freeform note; absent when whitespace-only. */
  posting_context_notes?: string;
  /** auth.users.id of the staff member emitting (audit attribution). */
  actor_id?: string;
}

/**
 * Builds the C.3 EveryPay daily settlement event. Fired by the staff
 * settlement page (PR C commit 11a) — NOT a marketplace lifecycle event,
 * so the wrap layer calls `emit()` directly instead of routing through a
 * parent RPC. `emission_source='staff_manual'` discriminates this from
 * `'lifecycle'` (marketplace flows), `'cron'` (depreciation / P.1), and
 * `'backfill'` (historical reconstruction).
 *
 * The posting_date + accounting_period + tax_period all derive from
 * `settlement_value_date` — the date Swedbank actually credited STG, which
 * is what the bank reconciliation gate (checklist item 2) checks against.
 * If staff records a settlement with a value_date in a hard-locked period,
 * the engine's enforce_period_status trigger rejects the emit; the staff
 * page surfaces the error.
 */
export function buildEverypaySettlementEvent(
  input: BuildEverypaySettlementEventInput
): PostingEvent {
  const period = input.settlement_value_date.substring(0, 7);
  return {
    event_type: 'everypay.daily_settlement_received',
    source_doc_type: 'everypay_settlement',
    source_doc_id: input.bank_statement_reference,
    posting_date: input.settlement_value_date,
    accounting_period: period,
    tax_period: period,
    narrative:
      `EveryPay daily settlement — ${input.bank_statement_reference}` +
      ` (${input.included_txn_refs.length} txn${input.included_txn_refs.length === 1 ? '' : 's'})`,
    emission_source: 'staff_manual',
    payload: {
      everypay_settlement_id: input.bank_statement_reference,
      settlement_cents: input.settlement_cents,
      batch_date: input.batch_date,
      settlement_value_date: input.settlement_value_date,
      included_txn_refs: input.included_txn_refs,
      // EveryPay settles card batches into the e-commerce settlement account
      // (2620), not the operating account. Overrides the C.3 default (2610).
      settlement_bank_account: '2620',
      ...(input.posting_context_notes ? { staff_notes: input.posting_context_notes } : {})
    },
    created_by: input.actor_id
  };
}

// ---------------------------------------------------------------------------
// buildVatClosingEvent — P.1 (monthly-vat-close cron emission)
// ---------------------------------------------------------------------------

/**
 * Pre-computed P.1 line as it appears in the event payload. The cron's
 * net-VAT-position helper produces these; the engine's
 * buildPreComputedLines projects them verbatim into ComputedLine[].
 */
export interface VatClosingLine {
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  narrative: string;
}

export interface BuildVatClosingEventInput {
  /** YYYY-MM — the period being closed. Drives source_doc_id + period fields. */
  closing_period: string;
  /** YYYY-MM-DD — typically the last day of `closing_period`. */
  posting_date: string;
  /**
   * Net direction in cents:
   *   positive = refund position (VID owes STG; net VAT receivable on 2380)
   *   negative = payable position (STG owes VID; net VAT clearing on 5710-09)
   *   zero     = both LV-IN and LV-OUT nonzero but equal (2-line clear-only entry)
   *
   * Sign convention: kept legacy-compatible with the April backfill's
   * `net_refund_cents` key. Positive=refund, negative=payable mirrors the
   * historical entries. The sibling `net_payable_to_vid_cents` field below
   * gives the direction-explicit representation for new queries.
   * (PR C commit 12 Q12-7a: kept legacy key for queryable consistency with
   * historical entries.)
   */
  net_refund_cents: number;
  /**
   * Direction-explicit sibling: positive = payable to VID, negative = refund
   * from VID. Negation of `net_refund_cents`. Surfaced so new queries can
   * read direction without knowing the sign-flip convention.
   */
  net_payable_to_vid_cents: number;
  /** Pre-computed P.1 lines (refund / payable / zero-net shape). Engine emits verbatim. */
  lines: ReadonlyArray<VatClosingLine>;
  /** Optional human-readable narrative override; cron defaults are usually sufficient. */
  narrative?: string;
  actor_id?: string;
}

/**
 * Builds the P.1 monthly VAT consolidation event for the
 * /api/cron/monthly-vat-close cron route (PR C commit 12).
 *
 * `emission_source='cron'` discriminates from `'backfill'` (Phase 0
 * close_2026_01, April close_2026_04 — both emitted with the legacy
 * `event_type='period_close.monthly_refund'`; routing predicate renamed to
 * `period_close.monthly_vat` in commit 12 to support both directions).
 *
 * Counterparty is the pinned STG_INTERNAL system counterparty (matches the
 * April backfill convention — period-close consolidations have no external
 * counterparty).
 *
 * Idempotency: `source_doc_id = close_<YYYY-MM>`; engine UNIQUE on
 * (source_doc_type='period_close', source_doc_id, type_id='P.1'). Re-firing
 * the cron returns idempotent_skip.
 */
export function buildVatClosingEvent(input: BuildVatClosingEventInput): PostingEvent {
  const direction =
    input.net_refund_cents > 0 ? 'refund' :
    input.net_refund_cents < 0 ? 'payable' : 'zero-net';
  const defaultNarrative =
    direction === 'refund'
      ? `${input.closing_period} VAT consolidation — €${(input.net_refund_cents / 100).toFixed(2)} refund due from VID`
      : direction === 'payable'
        ? `${input.closing_period} VAT consolidation — €${(Math.abs(input.net_refund_cents) / 100).toFixed(2)} payable to VID`
        : `${input.closing_period} VAT consolidation — net-zero close (LV-IN/OUT clearing)`;

  // source_doc_id uses underscore separator (close_YYYY_MM) to match the
  // April backfill `close_2026_04` and Phase 0 `close_2026_01` convention.
  // closing_period arrives as YYYY-MM (hyphen); normalize for the doc id.
  const sourceDocId = `close_${input.closing_period.replace('-', '_')}`;

  return {
    event_type: 'period_close.monthly_vat',
    source_doc_type: 'period_close',
    source_doc_id: sourceDocId,
    posting_date: input.posting_date,
    accounting_period: input.closing_period,
    tax_period: input.closing_period,
    narrative: input.narrative ?? defaultNarrative,
    emission_source: 'cron',
    counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
    payload: {
      closing_period: input.closing_period,
      net_refund_cents: input.net_refund_cents,
      net_payable_to_vid_cents: input.net_payable_to_vid_cents,
      lines: input.lines
    },
    created_by: input.actor_id
  };
}
