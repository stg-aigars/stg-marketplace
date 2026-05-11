/**
 * order-refund.ts wrap-branch tests.
 *
 * Covers `refundOrder`'s flag-check delegation:
 *   - Flag-OFF: byte-identical pre-PR-#5 behavior (status update + fire-and-
 *     forget issueCreditNote; no GL emit; no telemetry)
 *   - Flag-ON: delegates to `refundOrderWithGL` from
 *     `src/lib/accounting/lifecycle-wraps.ts` after EveryPay/wallet refunds
 *     resolve. Synchronously awaits `issueCreditNote` so the wrap can pass
 *     credit_note_number through (used as human-readable reference; O.7/O.8
 *     still use source_doc_id=order_id for retry idempotency)
 *
 * End-to-end coverage (antecedent lookup, dispatch routing, RPC composition,
 * orphan-path telemetry) lands via integration tests in PR C.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/accounting/feature-flag', () => ({
  isAccountingEngineEnabled: vi.fn(() => false)
}));

vi.mock('@/lib/accounting/lifecycle-wraps', () => ({
  refundOrderWithGL: vi.fn(async () => ({
    refund_entry_id: 'je_refund_uuid',
    cash_leg_entry_id: 'je_cash_leg_uuid',
    orphan: false,
    idempotent_skip: false
  }))
}));

vi.mock('@/lib/services/everypay/client', () => ({
  refundPayment: vi.fn(async () => undefined)
}));

vi.mock('@/lib/services/wallet', () => ({
  refundToWallet: vi.fn(async () => ({ id: 'wallet_txn_uuid' }))
}));

vi.mock('@/lib/services/invoicing', () => ({
  issueCreditNote: vi.fn(async () => 'STG-CN-2027-00001')
}));

vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: vi.fn(async () => undefined)
}));

const mockUpdate = vi.fn(() => ({
  eq: vi.fn(async () => ({ data: null, error: null }))
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate
    }))
  }))
}));

import { isAccountingEngineEnabled } from '@/lib/accounting/feature-flag';
import { refundOrderWithGL } from '@/lib/accounting/lifecycle-wraps';
import { refundPayment } from '@/lib/services/everypay/client';
import { issueCreditNote } from '@/lib/services/invoicing';
import { refundOrder } from './order-refund';

const cardOnlyOrder = {
  id: 'order_uuid_test',
  seller_id: 'seller_uuid_test',
  buyer_id: 'buyer_uuid_test',
  order_number: 'STG-2027-00001',
  invoice_number: 'INV-2027-00001',
  credit_note_number: null,
  total_amount_cents: 10500,
  items_total_cents: 10000,
  shipping_cost_cents: 500,
  buyer_wallet_debit_cents: 0,
  payment_method: 'card' as const,
  everypay_payment_reference: 'ep_pay_ref',
  refund_status: null,
  cart_group_id: 'cart_uuid_test'
};

describe('refundOrder — flag-branch contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flag-OFF: legacy update path; does NOT call refundOrderWithGL or await issueCreditNote', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(false);

    await refundOrder('order_uuid_test', cardOnlyOrder);

    // Card refund still happens (existing flow, before flag check)
    expect(refundPayment).toHaveBeenCalledTimes(1);
    expect(refundPayment).toHaveBeenCalledWith('ep_pay_ref', 10500);

    // Legacy update path runs
    expect(mockUpdate).toHaveBeenCalled();

    // Flag-ON wrap is NOT called
    expect(refundOrderWithGL).not.toHaveBeenCalled();

    // Credit note IS issued (flag-OFF path keeps the existing fire-and-forget call)
    expect(issueCreditNote).toHaveBeenCalledTimes(1);
  });

  it('flag-ON: calls refundOrderWithGL; awaits issueCreditNote synchronously', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);

    await refundOrder('order_uuid_test', cardOnlyOrder);

    // Card refund happened
    expect(refundPayment).toHaveBeenCalledTimes(1);

    // issueCreditNote synchronously awaited (flag-ON path) — return value
    // threaded through to the wrap as credit_note_number
    expect(issueCreditNote).toHaveBeenCalledWith('order_uuid_test');

    // Wrap called with the structured order shape + refund result
    expect(refundOrderWithGL).toHaveBeenCalledTimes(1);
    expect(refundOrderWithGL).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'order_uuid_test',
        seller_id: 'seller_uuid_test',
        order_number: 'STG-2027-00001',
        invoice_number: 'INV-2027-00001',
        credit_note_number: 'STG-CN-2027-00001', // resolved synchronously
        items_total_cents: 10000,
        shipping_cost_cents: 500,
        total_amount_cents: 10500,
        payment_method: 'card',
        cart_group_id: 'cart_uuid_test'
      }),
      expect.objectContaining({
        card_refunded: 10500,
        wallet_refunded: 0,
        total_refunded: 10500,
        refund_status: 'completed'
      })
    );

    // Legacy update path NOT used; the parent RPC owns state mutation under flag-ON
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('flag-ON without invoice_number: skips issueCreditNote; calls wrap with credit_note_number=null', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);
    const orderWithoutInvoice = { ...cardOnlyOrder, invoice_number: null };

    await refundOrder('order_uuid_test', orderWithoutInvoice);

    expect(issueCreditNote).not.toHaveBeenCalled();
    expect(refundOrderWithGL).toHaveBeenCalledTimes(1);
    expect(refundOrderWithGL).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ credit_note_number: null }),
      expect.anything()
    );
  });

  it('idempotent retry: refund_status=completed short-circuits both paths', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);
    const alreadyRefunded = { ...cardOnlyOrder, refund_status: 'completed' };

    const result = await refundOrder('order_uuid_test', alreadyRefunded);

    expect(result).toEqual({ cardRefunded: 0, walletRefunded: 0 });
    expect(refundPayment).not.toHaveBeenCalled();
    expect(refundOrderWithGL).not.toHaveBeenCalled();
    expect(issueCreditNote).not.toHaveBeenCalled();
  });
});
