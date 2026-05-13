/**
 * Shared order refund utility.
 * Handles card-only, wallet-only, and card+wallet split refunds.
 * Idempotent: checks refund_status before processing.
 */

import { createServiceClient } from '@/lib/supabase';
import { refundPayment } from '@/lib/services/everypay/client';
import { refundToWallet } from '@/lib/services/wallet';
import { logAuditEvent } from '@/lib/services/audit';
import { issueCreditNote } from '@/lib/services/invoicing';
import { isAccountingEngineEnabled } from '@/lib/accounting/feature-flag';
import { refundOrderWithGL } from '@/lib/accounting/lifecycle-wraps';
import type { PaymentMethod } from '@/lib/orders/types';

/** Refund status values written to orders.refund_status. */
export const REFUND_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial',
} as const;

export type RefundStatus = typeof REFUND_STATUS[keyof typeof REFUND_STATUS];

/**
 * Thrown when a refund could not be initiated at all — neither the card leg
 * nor the wallet leg moved any money. Callers that have already claimed
 * upstream state (e.g. dispute resolution) should roll that state back before
 * propagating this error.
 */
export class RefundInitiationError extends Error {
  constructor(
    message: string,
    public readonly orderId: string,
    public readonly orderNumber: string
  ) {
    super(message);
    this.name = 'RefundInitiationError';
  }
}

interface RefundableOrder {
  buyer_id: string;
  total_amount_cents: number;
  buyer_wallet_debit_cents: number;
  payment_method: PaymentMethod | null;
  everypay_payment_reference: string | null;
  order_number: string;
  refund_status: string | null;
  invoice_number: string | null;
  // PR #5 commit 7: flag-ON path needs additional fields for the GL emit.
  // Optional so callers that only have the legacy slice can still invoke
  // refundOrder under flag-OFF without breaking their type contracts.
  // Under flag-ON these are required (asserted at the wrap boundary).
  id?: string;
  seller_id?: string;
  items_total_cents?: number;
  shipping_cost_cents?: number;
  credit_note_number?: string | null;
  cart_group_id?: string | null;
  /** Stage-2 cutover gate marker. See lifecycle-cutover-runbook.md §3. */
  is_staff_test?: boolean;
}

/**
 * Refund a cancelled/declined order to the buyer.
 *
 * Three scenarios:
 * 1. Card only: refund full amount via EveryPay
 * 2. Card + wallet split: refund card portion via EveryPay + wallet portion via refundToWallet
 * 3. Wallet only: refund full amount via refundToWallet
 *
 * Partial failure: if one leg fails, logs for manual resolution. The order's
 * refund_amount_cents records what was actually refunded.
 */
/**
 * Mark an order's refund as failed. `refundOrder()` deliberately skips
 * writing `refund_status` on total failure so the deadline-enforcement
 * cron can retry non-dispute refunds, but that retry path doesn't apply
 * to dispute resolutions (which are triggered synchronously by staff or
 * seller action). Callers without a retry loop use this helper to make
 * the failure visible in the staff "Refund issues" queue.
 */
export async function markRefundFailed(orderId: string): Promise<void> {
  const serviceClient = createServiceClient();
  await serviceClient
    .from('orders')
    .update({ refund_status: REFUND_STATUS.FAILED })
    .eq('id', orderId);
}

export async function refundOrder(
  orderId: string,
  order: RefundableOrder
): Promise<{ cardRefunded: number; walletRefunded: number }> {
  // Idempotency: already refunded
  if (order.refund_status === REFUND_STATUS.COMPLETED) {
    return { cardRefunded: 0, walletRefunded: 0 };
  }

  const serviceClient = createServiceClient();
  const walletDebit = order.buyer_wallet_debit_cents ?? 0;
  const cardAmount = order.total_amount_cents - walletDebit;

  let cardRefunded = 0;
  let walletRefunded = 0;

  // Refund card portion
  if (cardAmount > 0 && order.everypay_payment_reference) {
    try {
      await refundPayment(order.everypay_payment_reference, cardAmount);
      cardRefunded = cardAmount;
    } catch (error) {
      console.error(
        `[Refund] MANUAL RESOLUTION NEEDED: Card refund failed for order ${orderId} (${order.order_number}), amount: ${cardAmount} cents:`,
        error
      );
    }
  }

  // Refund wallet portion
  if (walletDebit > 0) {
    try {
      await refundToWallet(
        order.buyer_id,
        walletDebit,
        orderId,
        `Refund: ${order.order_number}`
      );
      walletRefunded = walletDebit;
    } catch (error) {
      console.error(
        `[Refund] MANUAL RESOLUTION NEEDED: Wallet refund failed for order ${orderId} (${order.order_number}), amount: ${walletDebit} cents:`,
        error
      );
    }
  }

  // Update order refund status
  const totalRefunded = cardRefunded + walletRefunded;
  const expectedTotal = order.total_amount_cents;
  const refundStatus =
    totalRefunded === 0 ? REFUND_STATUS.FAILED :
    totalRefunded >= expectedTotal ? REFUND_STATUS.COMPLETED : REFUND_STATUS.PARTIAL;

  // Don't write refund status if nothing was refunded — allows retry on next cron run
  if (totalRefunded === 0) {
    console.error(`[Refund] Complete failure for order ${orderId} (${order.order_number}) — no refund processed, will retry`);
    return { cardRefunded, walletRefunded };
  }

  // Flag-ON path: parent RPC composes orders.refund_status/refund_amount_cents
  // update + GL emits (refund-side O.7/O.8 + C.5 cash leg) atomically.
  // Credit note is issued synchronously so the wrap can pass credit_note_number
  // through to the refund event payload (used as a human-readable reference;
  // O.7/O.8 still use source_doc_id=order_id for retry idempotency).
  // Flag-OFF: existing path runs byte-identical.
  // Two-level cutover gate; mirrors order-transitions.ts:creditSellerWallet.
  // Stage 3 transition: drop `&& order.is_staff_test` to make engine path
  // unconditional. See lifecycle-cutover-runbook.md §4.
  if (isAccountingEngineEnabled() && order.is_staff_test) {
    let creditNoteNumber: string | null = null;
    if (order.invoice_number) {
      try {
        creditNoteNumber = await issueCreditNote(orderId);
      } catch (err) {
        console.error('[Invoicing] Failed to issue credit note:', err);
      }
    }

    if (
      order.id !== undefined
      && order.seller_id !== undefined
      && order.items_total_cents !== undefined
      && order.shipping_cost_cents !== undefined
    ) {
      await refundOrderWithGL(
        serviceClient,
        {
          id: order.id,
          seller_id: order.seller_id,
          order_number: order.order_number,
          invoice_number: order.invoice_number,
          credit_note_number: creditNoteNumber ?? order.credit_note_number ?? null,
          items_total_cents: order.items_total_cents,
          shipping_cost_cents: order.shipping_cost_cents,
          total_amount_cents: order.total_amount_cents,
          payment_method: order.payment_method,
          cart_group_id: order.cart_group_id ?? null,
          is_staff_test: true,
        },
        {
          card_refunded: cardRefunded,
          wallet_refunded: walletRefunded,
          total_refunded: totalRefunded,
          refund_status: refundStatus as 'completed' | 'partial' | 'failed',
        }
      );
    } else {
      console.error(
        `[Refund] Flag-ON refund missing required fields on order ${orderId}; falling back to legacy update path. Caller must pass the full RefundableOrder shape under flag-ON.`
      );
      await serviceClient
        .from('orders')
        .update({
          refund_status: refundStatus,
          refund_amount_cents: totalRefunded,
          refunded_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    }
  } else {
    await serviceClient
      .from('orders')
      .update({
        refund_status: refundStatus,
        refund_amount_cents: totalRefunded,
        refunded_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // Issue credit note only if an invoice exists (completed orders refunded via dispute).
    // Cancelled orders (declined, timeout) never had an invoice — no credit note needed.
    if (order.invoice_number) {
      void issueCreditNote(orderId).catch((err) => console.error('[Invoicing] Failed to issue credit note:', err));
    }
  }

  void logAuditEvent(serviceClient, {
    actorType: 'system',
    action: 'order.refunded',
    resourceType: 'order',
    resourceId: orderId,
    metadata: {
      orderNumber: order.order_number,
      cardRefunded,
      walletRefunded,
      totalRefunded,
      expectedTotal,
      refundStatus,
    },
    retentionClass: 'regulatory',
  });

  return { cardRefunded, walletRefunded };
}
