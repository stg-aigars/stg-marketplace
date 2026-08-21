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

// Static import of `@/lib/email` reaches the Resend client, which needs an API
// key at module load. The refund gateway sends the operator alert from there.
vi.mock('@/lib/email', () => ({
  sendRefundOperatorAlert: vi.fn(async () => undefined),
  sendRefundManualPendingToBuyer: vi.fn(async () => undefined),
}));

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

vi.mock('@/lib/notifications', () => ({
  notifyStaff: vi.fn(async () => undefined)
}));

// Typed param so assertions can read the update payload off mock.calls.
const mockUpdate = vi.fn((_payload: Record<string, unknown>) => ({
  eq: vi.fn(async () => ({ data: null, error: null }))
}));

// The manual-required path re-reads the order for the buyer's email + game
// summary. Returns a buyer so the notice path runs end to end.
const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    single: vi.fn(async () => ({
      data: {
        buyer_profile: { full_name: 'Buyer One', email: 'buyer@example.com' },
        order_items: [{ listings: { game_name: 'Catan' } }]
      },
      error: null
    }))
  }))
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate,
      select: mockSelect
    }))
  }))
}));

import { isAccountingEngineEnabled } from '@/lib/accounting/feature-flag';
import { refundOrderWithGL } from '@/lib/accounting/lifecycle-wraps';
import { refundPayment } from '@/lib/services/everypay/client';
import { issueCreditNote } from '@/lib/services/invoicing';
import { logAuditEvent } from '@/lib/services/audit';
import { notifyStaff } from '@/lib/notifications';
import { sendRefundManualPendingToBuyer } from '@/lib/email';
import { refundOrder, REFUND_STATUS } from './order-refund';

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
  cart_group_id: 'cart_uuid_test',
  is_staff_test: true
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
        cart_group_id: 'cart_uuid_test',
        is_staff_test: true
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

    expect(result).toEqual({ cardRefunded: 0, walletRefunded: 0, blocked: false });
    expect(refundPayment).not.toHaveBeenCalled();
    expect(refundOrderWithGL).not.toHaveBeenCalled();
    expect(issueCreditNote).not.toHaveBeenCalled();
  });

  it('flag-ON + is_staff_test=false: runs the engine path unconditionally (stage 3 cutover — gate removed)', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);
    const customerOrder = { ...cardOnlyOrder, is_staff_test: false };

    await refundOrder('order_uuid_test', customerOrder);

    expect(refundPayment).toHaveBeenCalledTimes(1);
    expect(refundOrderWithGL).toHaveBeenCalledTimes(1);
    expect(refundOrderWithGL).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ is_staff_test: false }),
      expect.anything()
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('flag-ON + is_staff_test undefined: threads false through to the wrap (defensive default)', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);
    const { is_staff_test: _omit, ...orderWithoutFlag } = cardOnlyOrder;

    await refundOrder('order_uuid_test', orderWithoutFlag);

    expect(refundOrderWithGL).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ is_staff_test: false }),
      expect.anything()
    );
  });
});

/**
 * The bank-link case that produced order STG-20260816-HGBM: seller declined,
 * auto-refund fired, EveryPay answered 4037, and nothing was written or sent.
 */
describe('refundOrder — gateway cannot reverse the payment', () => {
  const bankLinkOrder = { ...cardOnlyOrder, payment_method: 'bank_link' as const };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(false);
  });

  it('does not call EveryPay for a bank-link payment', async () => {
    await refundOrder('order_uuid_test', bankLinkOrder);

    expect(refundPayment).not.toHaveBeenCalled();
  });

  it('reports blocked so callers do not treat it as a failed initiation', async () => {
    const result = await refundOrder('order_uuid_test', bankLinkOrder);

    expect(result).toEqual({ cardRefunded: 0, walletRefunded: 0, blocked: true });
  });

  it('writes manual_required with the reason, and leaves refunded_at unset', async () => {
    await refundOrder('order_uuid_test', bankLinkOrder);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.refund_status).toBe(REFUND_STATUS.MANUAL_REQUIRED);
    expect(payload.refund_blocked_reason).toBe('open_banking_not_refundable');
    expect(payload.refund_blocked_at).toEqual(expect.any(String));
    expect(payload).not.toHaveProperty('refunded_at');
  });

  it('does not run the GL wrap — no money has moved on the gateway leg', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);

    await refundOrder('order_uuid_test', bankLinkOrder);

    expect(refundOrderWithGL).not.toHaveBeenCalled();
  });

  it('fires the regulatory refund.manual_required audit event', async () => {
    await refundOrder('order_uuid_test', bankLinkOrder);

    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'refund.manual_required',
        actorType: 'system',
        resourceType: 'order',
        resourceId: 'order_uuid_test',
        retentionClass: 'regulatory',
        metadata: expect.objectContaining({
          orderNumber: 'STG-2027-00001',
          amountCents: 10500,
          paymentMethod: 'bank_link',
          blockedReason: 'open_banking_not_refundable',
          everypayPaymentReference: 'ep_pay_ref',
        }),
      })
    );
  });

  it('notifies staff so the queue is not discovered by chance', async () => {
    await refundOrder('order_uuid_test', bankLinkOrder);

    expect(notifyStaff).toHaveBeenCalledWith(
      'refund.manual_required',
      expect.objectContaining({ orderNumber: 'STG-2027-00001', amountCents: 10500 })
    );
  });

  it('tells the buyer their money is coming by bank transfer', async () => {
    await refundOrder('order_uuid_test', bankLinkOrder);
    await vi.waitFor(() => expect(sendRefundManualPendingToBuyer).toHaveBeenCalledTimes(1));

    expect(sendRefundManualPendingToBuyer).toHaveBeenCalledWith({
      buyerName: 'Buyer One',
      buyerEmail: 'buyer@example.com',
      orderNumber: 'STG-2027-00001',
      gameName: 'Catan',
      amountCents: 10500,
    });
  });

  it('records only the outstanding amount when the wallet leg already refunded part', async () => {
    await refundOrder('order_uuid_test', {
      ...bankLinkOrder,
      buyer_wallet_debit_cents: 4000,
    });

    const payload = mockUpdate.mock.calls[0][0];
    // 4000 moved to the wallet automatically; the human still owes 6500.
    expect(payload.refund_amount_cents).toBe(4000);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'refund.manual_required',
        metadata: expect.objectContaining({ amountCents: 6500, autoRefundedCents: 4000 }),
      })
    );
  });

  it('is idempotent — a re-run against an already-queued order does nothing', async () => {
    const result = await refundOrder('order_uuid_test', {
      ...bankLinkOrder,
      refund_status: REFUND_STATUS.MANUAL_REQUIRED,
    });

    expect(result).toEqual({ cardRefunded: 0, walletRefunded: 0, blocked: false });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(notifyStaff).not.toHaveBeenCalled();
  });

  it('card orders are untouched by this branch (regression guard)', async () => {
    await refundOrder('order_uuid_test', cardOnlyOrder);

    expect(refundPayment).toHaveBeenCalledWith('ep_pay_ref', 10500);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.refund_status).toBe(REFUND_STATUS.COMPLETED);
    expect(payload.refunded_at).toEqual(expect.any(String));
  });
});
