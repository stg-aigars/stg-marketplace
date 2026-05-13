/**
 * Unit tests for lifecycle-events.ts builders.
 *
 * Each builder produces a PostingEvent that should route through the dispatcher
 * to the correct VatMappingEntry. Tests assert:
 *   - event_type is correct (drives dispatcher routing)
 *   - source_doc_type / source_doc_id populated for idempotency uniqueness
 *   - payload contains the keys the routing predicate or compute() needs
 *   - counterparty_id is set when the routing/compute requires it
 *
 * Round-trip dispatch check: each builder's output is fed to dispatch() to
 * verify it routes to the expected type ID. This is the load-bearing
 * integration test between builders and the mapping table.
 */

import { describe, it, expect } from 'vitest';

import { dispatch } from './dispatcher';
import {
  buildCartPartialRefundCashLegEvent,
  buildCartPaymentEvent,
  buildEverypaySettlementEvent,
  buildOrderCompletionEvent,
  buildRefundEvent,
  buildRefundCashLegEvent,
  buildVatClosingEvent,
  buildWithdrawalCompletionEvent
} from './lifecycle-events';
import { SYSTEM_COUNTERPARTY } from './system-counterparties';
import type { CounterpartyRow, DispatchContext, PostingEvent } from './types';

// ---------------------------------------------------------------------------
// Synthetic counterparty fixtures (mirror dispatcher.test.ts factories)
// ---------------------------------------------------------------------------

function lvSeller(): CounterpartyRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'seller',
    user_id: null,
    full_name: 'LV Seller',
    country: 'LV',
    tax_status: 'private',
    tin: null,
    vat_number: null,
    vies_verified_at: null,
    iban: null,
    iban_validated_at: null,
    legal_compliance_status: 'ok',
    kyc_status: 'not_required',
    kyc_verified_at: null,
    vendor_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };
}

function ltSellerB2B(): CounterpartyRow {
  return {
    ...lvSeller(),
    id: '22222222-2222-2222-2222-222222222222',
    country: 'LT',
    tax_status: 'vat_registered',
    vat_number: 'LT123456789',
    vies_verified_at: '2026-01-01T00:00:00Z'
  };
}

function ltSellerB2C(): CounterpartyRow {
  return { ...lvSeller(), id: '33333333-3333-3333-3333-333333333333', country: 'LT' };
}

function eeSellerB2C(): CounterpartyRow {
  return { ...lvSeller(), id: '99999999-9999-9999-9999-999999999999', country: 'EE' };
}

function ctxFromEvent(event: PostingEvent, counterparty: CounterpartyRow | null): DispatchContext {
  return {
    event_type: event.event_type,
    counterparty,
    payload: event.payload
  };
}

// ---------------------------------------------------------------------------
// buildCartPaymentEvent
// ---------------------------------------------------------------------------

describe('buildCartPaymentEvent', () => {
  it('card payment routes to C.1', () => {
    const event = buildCartPaymentEvent({
      cart_payment_id: 'cart_pay_abc123',
      everypay_payment_id: 'ep_xyz789',
      payment_method: 'card',
      gross_cart_cents: 10500,
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      callback_payload: { foo: 'bar' }
    });
    expect(event.event_type).toBe('everypay.payment_confirmed');
    expect(event.source_doc_type).toBe('cart_payment');
    expect(event.source_doc_id).toBe('cart_pay_abc123');
    expect(event.payload.payment_method).toBe('card');
    expect(event.payload.gross_cart_cents).toBe(10500);
    const matched = dispatch(ctxFromEvent(event, null));
    expect(matched.id).toBe('C.1');
  });

  it('bank_link (PIS) payment routes to C.2', () => {
    const event = buildCartPaymentEvent({
      cart_payment_id: 'cart_pay_pis456',
      everypay_payment_id: 'ep_pis789',
      payment_method: 'bank_link',
      gross_cart_cents: 5000,
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      callback_payload: {}
    });
    expect(event.event_type).toBe('everypay.payment_confirmed');
    expect(event.payload.payment_method).toBe('bank_link');
    const matched = dispatch(ctxFromEvent(event, null));
    expect(matched.id).toBe('C.2');
  });

  it('passes actor_id through to created_by', () => {
    const event = buildCartPaymentEvent({
      cart_payment_id: 'c', everypay_payment_id: 'e', payment_method: 'card',
      gross_cart_cents: 100, posting_date: '2027-01-15',
      accounting_period: '2027-01', tax_period: '2027-01', callback_payload: {},
      actor_id: 'actor_uuid_1'
    });
    expect(event.created_by).toBe('actor_uuid_1');
  });

  it('stamps emission_source=lifecycle on the event', () => {
    const event = buildCartPaymentEvent({
      cart_payment_id: 'c', everypay_payment_id: 'e', payment_method: 'card',
      gross_cart_cents: 100, posting_date: '2027-01-15',
      accounting_period: '2027-01', tax_period: '2027-01', callback_payload: {}
    });
    expect(event.emission_source).toBe('lifecycle');
  });

  it('defaults buyer_wallet_cents to 0 when omitted', () => {
    const event = buildCartPaymentEvent({
      cart_payment_id: 'c', everypay_payment_id: 'e', payment_method: 'card',
      gross_cart_cents: 5000, posting_date: '2027-01-15',
      accounting_period: '2027-01', tax_period: '2027-01', callback_payload: {}
    });
    expect(event.payload.buyer_wallet_cents).toBe(0);
    expect(event.payload.buyer_id).toBeUndefined();
  });

  it('threads buyer_wallet_cents + buyer_id into payload when provided', () => {
    const event = buildCartPaymentEvent({
      cart_payment_id: 'c', everypay_payment_id: 'e', payment_method: 'card',
      gross_cart_cents: 10000, buyer_wallet_cents: 3000,
      buyer_id: 'b0000000-0000-0000-0000-000000000001',
      posting_date: '2027-01-15', accounting_period: '2027-01', tax_period: '2027-01',
      callback_payload: {}
    });
    expect(event.payload.buyer_wallet_cents).toBe(3000);
    expect(event.payload.buyer_id).toBe('b0000000-0000-0000-0000-000000000001');
  });
});

// ---------------------------------------------------------------------------
// buildCartPartialRefundCashLegEvent
// ---------------------------------------------------------------------------

describe('buildCartPartialRefundCashLegEvent', () => {
  const base = {
    cart_payment_id: 'cart_pay_abc',
    everypay_payment_id: 'ep_xyz',
    refund_reference: 'cart_partial_abc_ep_xyz',
    posting_date: '2027-01-15',
    accounting_period: '2027-01',
    tax_period: '2027-01'
  };

  it('routes to C.9 with emission_source=lifecycle', () => {
    const event = buildCartPartialRefundCashLegEvent({
      ...base,
      payment_method: 'card',
      refund_cents: 3000
    });
    expect(event.event_type).toBe('cart.partial_refund_cash_leg');
    expect(event.source_doc_type).toBe('cart_partial_refund');
    expect(event.source_doc_id).toBe('cart_partial_abc_ep_xyz');
    expect(event.emission_source).toBe('lifecycle');
    const matched = dispatch(ctxFromEvent(event, null));
    expect(matched.id).toBe('C.9');
  });

  it('defaults buyer_wallet_refund_cents to 0 when omitted', () => {
    const event = buildCartPartialRefundCashLegEvent({
      ...base, payment_method: 'bank_link', refund_cents: 1500
    });
    expect(event.payload.buyer_wallet_refund_cents).toBe(0);
    expect(event.payload.buyer_id).toBeUndefined();
  });

  it('threads buyer_wallet_refund_cents + buyer_id when wallet was refunded', () => {
    const event = buildCartPartialRefundCashLegEvent({
      ...base,
      payment_method: 'card',
      refund_cents: 4000,
      buyer_wallet_refund_cents: 1000,
      buyer_id: 'b0000000-0000-0000-0000-000000000004'
    });
    expect(event.payload.buyer_wallet_refund_cents).toBe(1000);
    expect(event.payload.buyer_id).toBe('b0000000-0000-0000-0000-000000000004');
  });
});

// ---------------------------------------------------------------------------
// buildOrderCompletionEvent
// ---------------------------------------------------------------------------

describe('buildOrderCompletionEvent', () => {
  const baseInput = {
    order_id: 'order_abc',
    seller_counterparty_id: '11111111-1111-1111-1111-111111111111',
    item_value_cents: 10000,
    shipping_value_cents: 500,
    invoice_number: 'STG-2027-00001',
    seller_country: 'LV' as const,
    posting_date: '2027-01-15',
    accounting_period: '2027-01',
    tax_period: '2027-01',
    completion_source: 'delivery_confirmed' as const
  };

  it('LV seller routes to O.1', () => {
    const event = buildOrderCompletionEvent(baseInput);
    expect(event.event_type).toBe('order.completed');
    expect(event.source_doc_type).toBe('order');
    expect(event.source_doc_id).toBe('order_abc');
    expect(event.counterparty_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(event.payload.item_value_cents).toBe(10000);
    expect(event.payload.shipping_value_cents).toBe(500);
    expect(event.payload.unisend_cost_cents).toBeUndefined();
    expect(event.payload.invoice_number).toBe('STG-2027-00001');
    expect(event.payload.completion_trigger).toBe('delivery_confirmed');
    expect(event.payload.consumption_ms).toBe('LV');
    const matched = dispatch(ctxFromEvent(event, lvSeller()));
    expect(matched.id).toBe('O.1');
  });

  it('LT B2B vat_registered + VIES routes to O.2', () => {
    const event = buildOrderCompletionEvent({ ...baseInput, seller_counterparty_id: ltSellerB2B().id, seller_country: 'LT' });
    const matched = dispatch(ctxFromEvent(event, ltSellerB2B()));
    expect(matched.id).toBe('O.2');
  });

  it('LT B2C private routes to O.3; payload.consumption_ms=LT satisfies OSS required-key check', () => {
    const event = buildOrderCompletionEvent({ ...baseInput, seller_counterparty_id: ltSellerB2C().id, seller_country: 'LT' });
    expect(event.payload.consumption_ms).toBe('LT');
    const matched = dispatch(ctxFromEvent(event, ltSellerB2C()));
    expect(matched.id).toBe('O.3');
  });

  it('EE B2C private routes to O.5; payload.consumption_ms=EE satisfies OSS required-key check', () => {
    const event = buildOrderCompletionEvent({ ...baseInput, seller_counterparty_id: eeSellerB2C().id, seller_country: 'EE' });
    expect(event.payload.consumption_ms).toBe('EE');
    const matched = dispatch(ctxFromEvent(event, eeSellerB2C()));
    expect(matched.id).toBe('O.5');
  });

  it('completion_source threads through narrative + payload', () => {
    const event = buildOrderCompletionEvent({ ...baseInput, completion_source: 'auto_complete' });
    expect(event.payload.completion_trigger).toBe('auto_complete');
    expect(event.narrative).toContain('auto_complete');
  });
});

// ---------------------------------------------------------------------------
// buildRefundEvent — full (O.7 / O.8) and partial (O.9)
// ---------------------------------------------------------------------------

describe('buildRefundEvent', () => {
  const baseFullRefund = {
    order_id: 'order_xyz',
    seller_counterparty_id: lvSeller().id,
    original_invoice_number: 'STG-2027-00001',
    credit_note_number: 'STG-CN-2027-00001',
    posting_date: '2027-01-20',
    accounting_period: '2027-01',
    tax_period: '2027-01',
    lines: [{ account_code: '6310-C', debit_cents: 826, credit_cents: 0 }]
  };

  it('full_current refund routes to O.7 (current period credit note)', () => {
    const event = buildRefundEvent({ ...baseFullRefund, refund_type: 'full_current' });
    expect(event.event_type).toBe('order.refunded');
    expect(event.payload.tax_period_alignment).toBe('current');
    expect(event.payload.lines).toBeDefined();
    const matched = dispatch(ctxFromEvent(event, lvSeller()));
    expect(matched.id).toBe('O.7');
  });

  it('full_prior refund routes to O.8 (cross-period credit note)', () => {
    const event = buildRefundEvent({
      ...baseFullRefund,
      refund_type: 'full_prior',
      original_invoice_id: 'je_uuid_old',
      original_period: '2026-12'
    });
    expect(event.event_type).toBe('order.refunded');
    expect(event.payload.tax_period_alignment).toBe('prior');
    expect(event.payload.original_invoice_id).toBe('je_uuid_old');
    expect(event.payload.original_period).toBe('2026-12');
    const matched = dispatch(ctxFromEvent(event, lvSeller()));
    expect(matched.id).toBe('O.8');
  });

  it('partial refund routes to O.9 with proportional-split inputs', () => {
    const event = buildRefundEvent({
      order_id: 'order_xyz',
      seller_counterparty_id: lvSeller().id,
      original_invoice_number: 'STG-2027-00002',
      credit_note_number: 'STG-CN-2027-00002',
      refund_type: 'partial',
      original_item_value_cents: 10000,
      original_commission_gross_cents: 1000,
      original_shipping_value_cents: 0,
      refund_item_cents: 3333,
      refund_shipping_cents: 0,
      vat_rate: 0.21,
      vat_country: 'LV',
      vat_account: '5710-LV-OUT',
      posting_date: '2027-01-20',
      accounting_period: '2027-01',
      tax_period: '2027-01'
    });
    expect(event.event_type).toBe('order.partial_refunded');
    expect(event.payload.original_item_value_cents).toBe(10000);
    expect(event.payload.refund_item_cents).toBe(3333);
    expect(event.payload.vat_rate).toBe(0.21);
    expect(event.payload.vat_account).toBe('5710-LV-OUT');
    const matched = dispatch(ctxFromEvent(event, lvSeller()));
    expect(matched.id).toBe('O.9');
  });

  it('partial refund source_doc_id is credit_note_number (per-refund idempotency, not per-order)', () => {
    // Two partial refunds of the same order produce DISTINCT source_doc_id values.
    // Without this, the journal_entries (source_doc_type, source_doc_id, type_id)
    // UNIQUE index from migration 097 would collide and silently suppress the
    // second refund. Lock the shape to prevent regression — the parent RPC at
    // commit 7 depends on this.
    const baseInput = {
      order_id: 'order_repeat',
      seller_counterparty_id: lvSeller().id,
      original_invoice_number: 'STG-2027-00010',
      refund_type: 'partial' as const,
      original_item_value_cents: 10000,
      original_commission_gross_cents: 1000,
      original_shipping_value_cents: 0,
      refund_shipping_cents: 0,
      vat_rate: 0.21,
      vat_country: 'LV' as const,
      vat_account: '5710-LV-OUT',
      posting_date: '2027-01-20',
      accounting_period: '2027-01',
      tax_period: '2027-01'
    };
    const refund_a = buildRefundEvent({
      ...baseInput,
      credit_note_number: 'STG-CN-2027-00010-A',
      refund_item_cents: 3000
    });
    const refund_b = buildRefundEvent({
      ...baseInput,
      credit_note_number: 'STG-CN-2027-00010-B',
      refund_item_cents: 2000
    });
    expect(refund_a.source_doc_id).toBe('STG-CN-2027-00010-A');
    expect(refund_b.source_doc_id).toBe('STG-CN-2027-00010-B');
    expect(refund_a.source_doc_id).not.toBe(refund_b.source_doc_id);
  });

  it('full refund source_doc_id stays order_id (single full refund per order; retry idempotency)', () => {
    // O.7/O.8 keep source_doc_id=order_id intentionally — an order is fully
    // refunded only once; idempotency on retry returns the original entry.
    const event = buildRefundEvent({
      order_id: 'order_full',
      seller_counterparty_id: lvSeller().id,
      original_invoice_number: 'STG-2027-00011',
      credit_note_number: 'STG-CN-2027-00011',
      refund_type: 'full_current',
      posting_date: '2027-01-20',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      lines: [{ account_code: '6310-C', debit_cents: 826, credit_cents: 0 }]
    });
    expect(event.source_doc_id).toBe('order_full');
  });
});

// ---------------------------------------------------------------------------
// buildRefundCashLegEvent — C.5
// ---------------------------------------------------------------------------

describe('buildRefundCashLegEvent', () => {
  it('everypay funding source routes to C.5', () => {
    const event = buildRefundCashLegEvent({
      order_id: 'order_xyz',
      refund_reference: 'STG-RF-2027-00001',
      refund_cents: 5000,
      funding_source: 'everypay',
      posting_date: '2027-01-20',
      accounting_period: '2027-01',
      tax_period: '2027-01'
    });
    expect(event.event_type).toBe('order.refund_initiated');
    expect(event.source_doc_type).toBe('refund');
    expect(event.payload.funding_source).toBe('everypay');
    const matched = dispatch(ctxFromEvent(event, null));
    expect(matched.id).toBe('C.5');
  });

  it('bank funding source also routes to C.5', () => {
    const event = buildRefundCashLegEvent({
      order_id: 'order_xyz',
      refund_reference: 'STG-RF-2027-00002',
      refund_cents: 5000,
      funding_source: 'bank',
      posting_date: '2027-01-20',
      accounting_period: '2027-01',
      tax_period: '2027-01'
    });
    expect(event.payload.funding_source).toBe('bank');
    const matched = dispatch(ctxFromEvent(event, null));
    expect(matched.id).toBe('C.5');
  });
});

// ---------------------------------------------------------------------------
// buildWithdrawalCompletionEvent — C.4 (Shape 2)
// ---------------------------------------------------------------------------

describe('buildWithdrawalCompletionEvent', () => {
  it('routes to C.4 with seller.withdrawal_requested event_type (v3 catalog routing)', () => {
    const event = buildWithdrawalCompletionEvent({
      withdrawal_request_id: 'wd_abc',
      seller_counterparty_id: lvSeller().id,
      withdrawal_cents: 8350,
      withdrawal_ref: 'STG WD-2026-00001',
      seller_iban: 'LV80BANK0000435195001',
      bank_confirmation_ref: 'SEPA-REF-12345',
      posting_date: '2027-01-25',
      accounting_period: '2027-01',
      tax_period: '2027-01'
    });
    expect(event.event_type).toBe('seller.withdrawal_requested');
    expect(event.source_doc_type).toBe('withdrawal_request');
    expect(event.source_doc_id).toBe('wd_abc');
    expect(event.counterparty_id).toBe(lvSeller().id);
    expect(event.payload.withdrawal_cents).toBe(8350);
    expect(event.payload.withdrawal_ref).toBe('STG WD-2026-00001');
    expect(event.payload.bank_confirmation_ref).toBe('SEPA-REF-12345');
    const matched = dispatch(ctxFromEvent(event, lvSeller()));
    expect(matched.id).toBe('C.4');
  });

  it('bank_confirmation_ref is optional (some completions land without one)', () => {
    const event = buildWithdrawalCompletionEvent({
      withdrawal_request_id: 'wd_abc',
      seller_counterparty_id: lvSeller().id,
      withdrawal_cents: 1000,
      withdrawal_ref: 'STG WD-2026-00002',
      seller_iban: 'LV80BANK0000435195001',
      posting_date: '2027-01-25',
      accounting_period: '2027-01',
      tax_period: '2027-01'
    });
    expect(event.payload.bank_confirmation_ref).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildEverypaySettlementEvent — C.3 (staff-manual emission)
// ---------------------------------------------------------------------------

describe('buildEverypaySettlementEvent', () => {
  const baseInput = {
    bank_statement_reference: 'SWB-2027-01-15-001',
    settlement_cents: 12500,
    batch_date: '2027-01-14',
    settlement_value_date: '2027-01-15',
    included_txn_refs: ['ep-1', 'ep-2', 'ep-3'],
  };

  it('routes to C.3 via the dispatcher', () => {
    const event = buildEverypaySettlementEvent(baseInput);
    expect(event.event_type).toBe('everypay.daily_settlement_received');
    expect(event.source_doc_type).toBe('everypay_settlement');
    expect(event.source_doc_id).toBe('SWB-2027-01-15-001');
    const matched = dispatch(ctxFromEvent(event, null));
    expect(matched.id).toBe('C.3');
  });

  it('stamps emission_source=staff_manual on the event', () => {
    const event = buildEverypaySettlementEvent(baseInput);
    expect(event.emission_source).toBe('staff_manual');
  });

  it('derives posting_date + accounting_period + tax_period from settlement_value_date', () => {
    const event = buildEverypaySettlementEvent({
      ...baseInput,
      settlement_value_date: '2027-03-20',
    });
    expect(event.posting_date).toBe('2027-03-20');
    expect(event.accounting_period).toBe('2027-03');
    expect(event.tax_period).toBe('2027-03');
  });

  it('threads all C.3 required payload keys', () => {
    const event = buildEverypaySettlementEvent(baseInput);
    expect(event.payload).toMatchObject({
      everypay_settlement_id: 'SWB-2027-01-15-001',
      settlement_cents: 12500,
      batch_date: '2027-01-14',
      settlement_value_date: '2027-01-15',
      included_txn_refs: ['ep-1', 'ep-2', 'ep-3'],
    });
  });

  it('includes staff_notes only when posting_context_notes is provided (commit-10 normalization)', () => {
    const withNotes = buildEverypaySettlementEvent({
      ...baseInput,
      posting_context_notes: 'Reconciled against Swedbank statement #4521',
    });
    expect(withNotes.payload.staff_notes).toBe('Reconciled against Swedbank statement #4521');

    const withoutNotes = buildEverypaySettlementEvent(baseInput);
    expect(withoutNotes.payload.staff_notes).toBeUndefined();
  });

  it('threads actor_id through to created_by for audit attribution', () => {
    const event = buildEverypaySettlementEvent({
      ...baseInput,
      actor_id: '00000000-0000-4000-8000-000000000001',
    });
    expect(event.created_by).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('accepts empty included_txn_refs (staff records before reconciling refs)', () => {
    const event = buildEverypaySettlementEvent({
      ...baseInput,
      included_txn_refs: [],
    });
    expect(event.payload.included_txn_refs).toEqual([]);
    expect(event.narrative).toContain('(0 txns)');
  });

  it('pluralises narrative correctly for one ref', () => {
    const event = buildEverypaySettlementEvent({
      ...baseInput,
      included_txn_refs: ['only-one'],
    });
    expect(event.narrative).toContain('(1 txn)');
    expect(event.narrative).not.toContain('(1 txns)');
  });
});

// ---------------------------------------------------------------------------
// buildVatClosingEvent — P.1 (monthly-vat-close cron, PR C commit 12)
// ---------------------------------------------------------------------------

describe('buildVatClosingEvent', () => {
  const refundShape = {
    closing_period: '2026-05',
    posting_date: '2026-05-31',
    net_refund_cents: 30,
    net_payable_to_vid_cents: -30,
    lines: [
      { account_code: '5710-LV-OUT', debit_cents: 38, credit_cents: 0, narrative: 'Clear LV output VAT' },
      { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 68, narrative: 'Clear LV input VAT' },
      { account_code: '2380', debit_cents: 30, credit_cents: 0, narrative: 'VID receivable' }
    ]
  };

  const payableShape = {
    closing_period: '2026-07',
    posting_date: '2026-07-31',
    net_refund_cents: -13000,
    net_payable_to_vid_cents: 13000,
    lines: [
      { account_code: '5710-LV-OUT', debit_cents: 15000, credit_cents: 0, narrative: 'Clear LV output VAT' },
      { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 2000, narrative: 'Clear LV input VAT' },
      { account_code: '5710-09', debit_cents: 0, credit_cents: 13000, narrative: 'PVN klīringa konts — net payable' }
    ]
  };

  it('routes to P.1 via the renamed event_type', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.event_type).toBe('period_close.monthly_vat');
    const matched = dispatch(ctxFromEvent(event, null));
    expect(matched.id).toBe('P.1');
  });

  it('stamps emission_source=cron on the event', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.emission_source).toBe('cron');
  });

  it('uses STG_INTERNAL system counterparty (matches April backfill convention)', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.counterparty_id).toBe(SYSTEM_COUNTERPARTY.STG_INTERNAL);
  });

  it('derives source_doc_id from closing_period (close_<YYYY-MM> pattern)', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.source_doc_id).toBe('close_2026_05');
    expect(event.source_doc_type).toBe('period_close');
  });

  it('threads accounting_period + tax_period from closing_period', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.accounting_period).toBe('2026-05');
    expect(event.tax_period).toBe('2026-05');
  });

  it('threads BOTH net_refund_cents (legacy) AND net_payable_to_vid_cents (sibling) into payload (Q12-7a)', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.payload.net_refund_cents).toBe(30);
    expect(event.payload.net_payable_to_vid_cents).toBe(-30);

    const payableEvent = buildVatClosingEvent(payableShape);
    expect(payableEvent.payload.net_refund_cents).toBe(-13000);
    expect(payableEvent.payload.net_payable_to_vid_cents).toBe(13000);
  });

  it('threads payload.lines verbatim from input', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.payload.lines).toEqual(refundShape.lines);
  });

  it('default narrative reads "refund due from VID" for refund position', () => {
    const event = buildVatClosingEvent(refundShape);
    expect(event.narrative).toContain('refund due from VID');
    expect(event.narrative).toContain('€0.30');
  });

  it('default narrative reads "payable to VID" for payable position', () => {
    const event = buildVatClosingEvent(payableShape);
    expect(event.narrative).toContain('payable to VID');
    expect(event.narrative).toContain('€130.00');
  });

  it('default narrative reads "net-zero close" for zero-net (both nonzero, equal)', () => {
    const event = buildVatClosingEvent({
      closing_period: '2026-08',
      posting_date: '2026-08-31',
      net_refund_cents: 0,
      net_payable_to_vid_cents: 0,
      lines: [
        { account_code: '5710-LV-OUT', debit_cents: 500, credit_cents: 0, narrative: 'A' },
        { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 500, narrative: 'B' }
      ]
    });
    expect(event.narrative).toContain('net-zero close');
  });

  it('accepts a caller-supplied narrative override', () => {
    const event = buildVatClosingEvent({ ...refundShape, narrative: 'Custom audit narrative' });
    expect(event.narrative).toBe('Custom audit narrative');
  });

  it('threads actor_id through to created_by for audit attribution', () => {
    const event = buildVatClosingEvent({ ...refundShape, actor_id: 'cron' });
    expect(event.created_by).toBe('cron');
  });
});
