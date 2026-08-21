/**
 * Shared order refund utility.
 * Handles card-only, wallet-only, and card+wallet split refunds.
 * Idempotent: checks refund_status before processing.
 */

import { createServiceClient } from '@/lib/supabase';
import { attemptGatewayRefund } from '@/lib/payments/refund-gateway';
import type { RefundBlockedReason } from '@/lib/payments/refundability';
import { refundToWallet } from '@/lib/services/wallet';
import { logAuditEvent } from '@/lib/services/audit';
import { issueCreditNote } from '@/lib/services/invoicing';
import { notifyStaff } from '@/lib/notifications';
import { sendRefundManualPendingToBuyer } from '@/lib/email';
import { orderGameSummary } from '@/lib/orders/utils';
import { isAccountingEngineEnabled } from '@/lib/accounting/feature-flag';
import { refundOrderWithGL } from '@/lib/accounting/lifecycle-wraps';
import type { PaymentMethod } from '@/lib/orders/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Refund status values written to orders.refund_status. */
export const REFUND_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial',
  /**
   * The gateway cannot reverse this payment — a human must send the money.
   * Distinct from FAILED, which is retryable: retrying an open-banking refund
   * gets error 4037 forever. Drives the /staff/refunds queue.
   *
   * orders.refund_status has no CHECK constraint, so this needs no migration
   * of its own; the columns it travels with are added in migration 133.
   */
  MANUAL_REQUIRED: 'manual_required',
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
  /** Threaded to posting_context for reporting-view filtering; no longer gates emission post-stage-3. See lifecycle-cutover-runbook.md §4. */
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

export interface RefundOrderResult {
  cardRefunded: number;
  walletRefunded: number;
  /**
   * True when the gateway leg could not be reversed and a manual bank transfer
   * is queued. Callers must NOT treat this as an initiation failure: the refund
   * obligation is recorded and surfaced, it just settles out-of-band.
   */
  blocked: boolean;
}

export async function refundOrder(
  orderId: string,
  order: RefundableOrder
): Promise<RefundOrderResult> {
  // Idempotency: already refunded
  if (order.refund_status === REFUND_STATUS.COMPLETED
      || order.refund_status === REFUND_STATUS.MANUAL_REQUIRED) {
    return { cardRefunded: 0, walletRefunded: 0, blocked: false };
  }

  const serviceClient = createServiceClient();
  const walletDebit = order.buyer_wallet_debit_cents ?? 0;
  const cardAmount = order.total_amount_cents - walletDebit;

  let cardRefunded = 0;
  let walletRefunded = 0;
  let blockedReason: RefundBlockedReason | null = null;

  // Refund the gateway portion. attemptGatewayRefund is the choke point: it
  // decides refundability, maps EveryPay's 4037 rejection, and sends the
  // operator email for every outcome.
  if (cardAmount > 0 && order.everypay_payment_reference) {
    const outcome = await attemptGatewayRefund({
      paymentReference: order.everypay_payment_reference,
      amountCents: cardAmount,
      paymentMethod: order.payment_method,
      reason: `refund of order ${order.order_number}`,
      order: { id: orderId, orderNumber: order.order_number },
    });

    if (outcome.status === 'refunded') {
      cardRefunded = cardAmount;
    } else if (outcome.status === 'manual_required') {
      blockedReason = outcome.reason;
    } else {
      console.error(
        `[Refund] MANUAL RESOLUTION NEEDED: Card refund failed for order ${orderId} (${order.order_number}), amount: ${cardAmount} cents: ${outcome.failureMessage}`
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

  // Gateway leg is irreversible — a human sends the transfer. Terminal for the
  // automated path: unlike FAILED, retrying gets error 4037 forever, so this
  // writes refund_status instead of leaving it null for the cron to pick up.
  //
  // The GL wrap is deliberately skipped here. Under flag-ON it stamps
  // refunded_at and emits the O.7/O.8 reversal + C.5 cash leg, all of which
  // assert money that has not moved yet. Both are recorded when staff mark the
  // transfer sent (see recordManualRefund in staff/refunds/actions.ts).
  if (blockedReason) {
    await markRefundManualRequired({
      serviceClient,
      orderId,
      order,
      blockedReason,
      autoRefundedCents: totalRefunded,
      outstandingCents: expectedTotal - totalRefunded,
    });
    return { cardRefunded, walletRefunded, blocked: true };
  }

  // Don't write refund status if nothing was refunded — allows retry on next cron run
  if (totalRefunded === 0) {
    console.error(`[Refund] Complete failure for order ${orderId} (${order.order_number}) — no refund processed, will retry`);
    return { cardRefunded, walletRefunded, blocked: false };
  }

  // Flag-ON path: parent RPC composes orders.refund_status/refund_amount_cents
  // update + GL emits (refund-side O.7/O.8 + C.5 cash leg) atomically.
  // Credit note is issued synchronously so the wrap can pass credit_note_number
  // through to the refund event payload (used as a human-readable reference;
  // O.7/O.8 still use source_doc_id=order_id for retry idempotency).
  // Flag-OFF: existing path runs byte-identical.
  // Stage 3 cutover (lifecycle-cutover-runbook.md §4): engine path runs
  // unconditionally for all orders once ACCOUNTING_ENGINE_ENABLED=true.
  if (isAccountingEngineEnabled()) {
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
          is_staff_test: order.is_staff_test ?? false,
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

  return { cardRefunded, walletRefunded, blocked: false };
}

/**
 * Record a refund that the gateway cannot execute, and make it visible.
 *
 * The code failure here is recoverable — money can always be sent by transfer.
 * The invisibility was not: before this existed, a blocked refund wrote nothing,
 * notified nobody, and was discoverable only by opening the EveryPay dashboard,
 * which is how a buyer ended up waiting four days for €29.70.
 *
 * So this writes three surfaces, all of them non-blocking except the DB write:
 * the staff queue row, the staff bell, and a note to the buyer.
 */
async function markRefundManualRequired(params: {
  serviceClient: SupabaseClient;
  orderId: string;
  order: RefundableOrder;
  blockedReason: RefundBlockedReason;
  /** What the automated legs (wallet) did manage to refund. */
  autoRefundedCents: number;
  /** What the human still needs to send. */
  outstandingCents: number;
}): Promise<void> {
  const { serviceClient, orderId, order, blockedReason, autoRefundedCents, outstandingCents } = params;

  console.warn(
    `[Refund] MANUAL TRANSFER REQUIRED for order ${orderId} (${order.order_number}): ${blockedReason}, outstanding ${outstandingCents} cents`
  );

  const { error } = await serviceClient
    .from('orders')
    .update({
      refund_status: REFUND_STATUS.MANUAL_REQUIRED,
      refund_amount_cents: autoRefundedCents,
      refund_blocked_reason: blockedReason,
      refund_blocked_at: new Date().toISOString(),
      // refunded_at stays null on purpose — the refund isn't complete until the
      // transfer is sent, and the staff resolve action stamps it then.
    })
    .eq('id', orderId);

  if (error) {
    // The queue row is the only durable record that money is owed. Losing it
    // silently would recreate the exact failure this function exists to stop.
    console.error(
      `[Refund] CRITICAL: could not mark order ${orderId} (${order.order_number}) as manual_required:`,
      error.message
    );
  }

  void logAuditEvent(serviceClient, {
    actorType: 'system',
    action: 'refund.manual_required',
    resourceType: 'order',
    resourceId: orderId,
    metadata: {
      orderNumber: order.order_number,
      amountCents: outstandingCents,
      autoRefundedCents,
      paymentMethod: order.payment_method,
      blockedReason,
      everypayPaymentReference: order.everypay_payment_reference,
    },
    retentionClass: 'regulatory',
  });

  void notifyStaff('refund.manual_required', {
    orderId,
    orderNumber: order.order_number,
    amountCents: outstandingCents,
    blockedReason,
  });

  void notifyBuyerOfManualRefund(serviceClient, orderId, order, outstandingCents).catch((err) =>
    console.error('[Refund] Failed to send manual-refund notice to buyer:', err)
  );
}

/**
 * Tell the buyer their money is coming by bank transfer. Needs a round-trip for
 * the buyer's name/email and the game summary — `RefundableOrder` is the narrow
 * slice every refund caller can supply, and widening it would push the join
 * onto four call sites for a branch that fires on a small minority of refunds.
 *
 * Exported because the cart-rollback path in payment-fulfillment.ts stamps
 * manual_required through its own phased flow rather than through refundOrder,
 * and a buyer whose cart failed is owed the same notice as one whose seller
 * declined.
 */
export async function notifyBuyerOfManualRefund(
  serviceClient: SupabaseClient,
  orderId: string,
  order: { order_number: string },
  amountCents: number
): Promise<void> {
  const { data } = await serviceClient
    .from('orders')
    .select('buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email), order_items(listings(game_name))')
    .eq('id', orderId)
    .single();

  // PostgREST types embedded relations as arrays; both are to-one here.
  const profile = (Array.isArray(data?.buyer_profile) ? data?.buyer_profile[0] : data?.buyer_profile) as
    | { full_name: string | null; email: string | null }
    | undefined;

  if (!profile?.email) {
    console.error(`[Refund] No buyer email for order ${orderId} — manual-refund notice not sent`);
    return;
  }

  const items = (data?.order_items ?? []) as Array<{ listings: { game_name: string } | { game_name: string }[] | null }>;
  const gameName = orderGameSummary(
    items.map((i) => ({
      gameName: (Array.isArray(i.listings) ? i.listings[0]?.game_name : i.listings?.game_name) ?? 'Game',
    }))
  );

  await sendRefundManualPendingToBuyer({
    buyerName: profile.full_name ?? 'there',
    buyerEmail: profile.email,
    orderNumber: order.order_number,
    gameName,
    amountCents,
  });
}
