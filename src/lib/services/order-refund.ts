/**
 * Shared order refund utility.
 * Handles card-only, wallet-only, and card+wallet split refunds.
 * Idempotent: checks refund_status before processing.
 */

import { createServiceClient } from '@/lib/supabase';
import { refundPayment } from '@/lib/services/everypay/client';
import { refundToWallet } from '@/lib/services/wallet';
import { logAuditEvent } from '@/lib/services/audit';
import type { PaymentMethod } from '@/lib/orders/types';

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
export async function refundOrder(
  orderId: string,
  order: RefundableOrder
): Promise<{ cardRefunded: number; walletRefunded: number }> {
  // Idempotency: already refunded
  if (order.refund_status === 'completed') {
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
    totalRefunded === 0 ? 'failed' :
    totalRefunded >= expectedTotal ? 'completed' : 'partial';

  // Don't write refund status if nothing was refunded — allows retry on next cron run
  if (totalRefunded === 0) {
    console.error(`[Refund] Complete failure for order ${orderId} (${order.order_number}) — no refund processed, will retry`);
    return { cardRefunded, walletRefunded };
  }

  await serviceClient
    .from('orders')
    .update({
      refund_status: refundStatus,
      refund_amount_cents: totalRefunded,
      refunded_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  void logAuditEvent({
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
  });

  return { cardRefunded, walletRefunded };
}
