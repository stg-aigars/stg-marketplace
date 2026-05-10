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
  gross_cart_cents: number;
  callback_payload: Record<string, unknown>;
}

/**
 * Builds the C.1 (card) or C.2 (bank_link / PIS) cart-payment cash-leg event.
 * Fired at cart fulfillment time. No VAT recognition — that defers to O.1–O.5
 * at order completion.
 */
export function buildCartPaymentEvent(input: BuildCartPaymentEventInput): PostingEvent {
  return {
    event_type: 'everypay.payment_confirmed',
    source_doc_type: 'cart_payment',
    source_doc_id: input.cart_payment_id,
    posting_date: input.posting_date,
    accounting_period: input.accounting_period,
    tax_period: input.tax_period,
    narrative: `Cart payment confirmed (${input.payment_method}) — pre-completion suspense`,
    payload: {
      payment_method: input.payment_method,
      gross_cart_cents: input.gross_cart_cents,
      cart_payment_id: input.cart_payment_id,
      everypay_payment_id: input.everypay_payment_id,
      callback_payload: input.callback_payload
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
  /** Buyer's gross shipping payment (full pass-through; STG accrues unisend_cost separately). */
  shipping_value_cents: number;
  /** STG's anticipated cost owed to Unisend for this order's shipping. Accrued at completion via Cr 5410-UN. */
  unisend_cost_cents: number;
  invoice_number: string;
  /** Drives narrative + posting_context.completion_trigger; routing is by counterparty fields. */
  completion_source: 'delivery_confirmed' | 'auto_complete' | 'dispute_no_refund';
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
    counterparty_id: input.seller_counterparty_id,
    payload: {
      order_id: input.order_id,
      seller_id: input.seller_counterparty_id,
      item_value_cents: input.item_value_cents,
      shipping_value_cents: input.shipping_value_cents,
      unisend_cost_cents: input.unisend_cost_cents,
      invoice_number: input.invoice_number,
      completion_trigger: input.completion_source
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
        vat_account: input.vat_account
      },
      created_by: input.actor_id
    };
  }

  const tax_period_alignment = input.refund_type === 'full_current' ? 'current' : 'prior';
  return {
    event_type: 'order.refunded',
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
      lines: input.lines
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
}

/**
 * Builds the C.5 cash-leg event for a refund. Fires alongside buildRefundEvent
 * (the credit-note side). The two events combined record the full refund
 * transaction in the GL.
 */
export function buildRefundCashLegEvent(input: BuildRefundCashLegEventInput): PostingEvent {
  return {
    event_type: 'order.refund_initiated',
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
      funding_source: input.funding_source
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
      bank_confirmation_ref: input.bank_confirmation_ref
    },
    created_by: input.actor_id
  };
}
