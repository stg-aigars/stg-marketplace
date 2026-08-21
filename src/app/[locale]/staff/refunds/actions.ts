'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';
import { REFUND_STATUS } from '@/lib/services/order-refund';

type ActionResult = { success: true } | { error: string };

/**
 * Record that a blocked refund was settled by manual bank transfer.
 *
 * This is the same sequence that was performed by hand for order
 * STG-20260816-HGBM on 2026-08-21 — status, amount, timestamp, regulatory
 * audit event — with the hand-editing removed.
 *
 * `refunded_at` is stamped at recording time. When the transfer actually left
 * the bank on an earlier date, that's what `transferredAt` is for; correcting
 * it afterwards means another hand edit, which is exactly what this replaces.
 */
export async function recordManualRefund(
  orderId: string,
  options?: { transferredAt?: string | null }
): Promise<ActionResult> {
  const { isStaff, user } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  const service = createServiceClient();

  const { data: order, error: loadError } = await service
    .from('orders')
    .select('id, order_number, status, total_amount_cents, refund_status, refund_amount_cents, payment_method, everypay_payment_reference, refund_blocked_reason')
    .eq('id', orderId)
    .single();

  if (loadError || !order) {
    console.error('[staff/refunds] recordManualRefund load failed:', loadError?.message);
    return { error: 'Could not load that order. Please try again.' };
  }

  if (order.refund_status !== REFUND_STATUS.MANUAL_REQUIRED) {
    // Idempotent under a double-click; a genuine mismatch is worth surfacing.
    return order.refund_status === REFUND_STATUS.COMPLETED
      ? { success: true }
      : { error: `This order is not awaiting a manual refund (status: ${order.refund_status ?? 'none'}).` };
  }

  const transferredAt = options?.transferredAt
    ? new Date(options.transferredAt).toISOString()
    : new Date().toISOString();

  // Guarded on refund_status so two staff resolving the same row concurrently
  // can't both write — the loser gets zero rows and reports the conflict.
  const { data: updated, error: updateError } = await service
    .from('orders')
    .update({
      refund_status: REFUND_STATUS.COMPLETED,
      refund_amount_cents: order.total_amount_cents,
      refunded_at: transferredAt,
      // refund_blocked_reason / refund_blocked_at are left in place — they are
      // the historical record of why this needed a human, and the queue filters
      // on refund_status, not on them.
      //
      // orders.status is deliberately untouched. A declined or timed-out order
      // stays `cancelled`; the dispute flows set `refunded` themselves. This
      // mirrors exactly what was recorded by hand for STG-20260816-HGBM.
    })
    .eq('id', orderId)
    .eq('refund_status', REFUND_STATUS.MANUAL_REQUIRED)
    .select('id')
    .single();

  if (updateError || !updated) {
    console.error('[staff/refunds] recordManualRefund update failed:', updateError?.message);
    return { error: 'Could not record the refund. It may have just been resolved by someone else.' };
  }

  void logAuditEvent(service, {
    actorId: user.id,
    actorType: 'user',
    action: 'refund.manually_completed',
    resourceType: 'order',
    resourceId: orderId,
    metadata: {
      orderNumber: order.order_number,
      amountCents: order.total_amount_cents,
      autoRefundedCents: order.refund_amount_cents ?? 0,
      refundChannel: 'bank_transfer',
      paymentMethod: order.payment_method,
      blockedReason: order.refund_blocked_reason,
      everypayPaymentReference: order.everypay_payment_reference,
      transferredAt,
    },
    retentionClass: 'regulatory',
  });

  revalidatePath('/staff/refunds');
  revalidatePath('/staff/orders');
  return { success: true };
}
