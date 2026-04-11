/**
 * Dispute resolution service
 * Handles the full dispute lifecycle: open, withdraw, accept refund, escalate, staff resolve.
 * Pure validation functions live in dispute-validation.ts (safe to import in tests).
 */

import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase';
import { loadOrder, creditSellerWallet, markSoldAndSyncShelf } from '@/lib/services/order-transitions';
import { refundOrder, markRefundFailed, RefundInitiationError } from '@/lib/services/order-refund';
import { logAuditEvent } from '@/lib/services/audit';
import type { OrderRow, DisputeRow } from '@/lib/orders/types';
import {
  sendOrderDisputedToSeller,
  sendDisputeResolvedRefund,
  sendDisputeResolvedNoRefund,
  sendDisputeEscalated,
  sendDisputeWithdrawn,
} from '@/lib/email';
import { notify, notifyMany } from '@/lib/notifications';
import { getOrderGameSummary, getOrderListingIds } from '@/lib/orders/utils';
import { syncShelfOnListingRemoved } from '@/lib/listings/actions';

// Re-export pure validation functions for external use
export {
  canOpenDispute,
  canEscalateDispute,
  canWithdrawDispute,
} from './dispute-validation';

import {
  canOpenDispute,
  canEscalateDispute,
  canWithdrawDispute,
} from './dispute-validation';

/** Fetch the dispute for an order. Returns null if none exists. */
export async function getDispute(orderId: string): Promise<DisputeRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('disputes')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle<DisputeRow>();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Buyer opens a dispute on a delivered order.
 * Uses optimistic locking on order status to prevent race with auto-complete cron.
 */
export async function openDispute(
  orderId: string,
  userId: string,
  reason: string,
  photos: string[] = []
): Promise<{ order: OrderRow; dispute: DisputeRow }> {
  if (reason.length < 10) {
    throw new Error('Dispute reason must be at least 10 characters');
  }
  if (photos.length > 4) {
    throw new Error('Maximum 4 photos allowed');
  }

  const supabase = createServiceClient();
  const order = await loadOrder(orderId);

  const validation = canOpenDispute(order, userId);
  if (!validation.allowed) {
    throw new Error(validation.reason!);
  }

  // Optimistic lock prevents race with auto-complete cron
  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'disputed',
      disputed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'delivered')
    .select()
    .single<OrderRow>();

  if (updateError || !updatedOrder) {
    throw new Error('Order status has changed — the dispute window may have expired');
  }

  const { data: dispute, error: disputeError } = await supabase
    .from('disputes')
    .insert({
      order_id: orderId,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      reason,
      photos,
    })
    .select()
    .single<DisputeRow>();

  if (disputeError || !dispute) {
    // Attempt to rollback order status — best effort
    await supabase
      .from('orders')
      .update({ status: 'delivered', disputed_at: null })
      .eq('id', orderId)
      .eq('status', 'disputed');
    throw new Error(`Failed to create dispute: ${disputeError?.message}`);
  }

  void logAuditEvent({
    actorId: userId,
    actorType: 'user',
    action: 'dispute.opened',
    resourceType: 'dispute',
    resourceId: dispute.id,
    metadata: { orderId, reason: reason.substring(0, 100), photoCount: photos.length },
  });

  // Email seller (non-blocking)
  sendOrderDisputedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: getOrderGameSummary(order.order_items, order.listings),
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    reason,
  }).catch((err) => console.error('[Email] Failed to send dispute notification:', err));

  void notify(order.seller_id, 'dispute.opened', {
    gameName: getOrderGameSummary(order.order_items, order.listings),
    orderNumber: order.order_number,
    orderId,
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
  });

  return { order: updatedOrder, dispute };
}

/**
 * Buyer withdraws their dispute. Order completes normally.
 */
export async function withdrawDispute(orderId: string, userId: string): Promise<OrderRow> {
  const supabase = createServiceClient();
  const [order, dispute] = await Promise.all([loadOrder(orderId), getDispute(orderId)]);

  if (!dispute) throw new Error('No dispute found for this order');
  if (order.status !== 'disputed') throw new Error('Order is not in disputed status');

  const validation = canWithdrawDispute(dispute, userId);
  if (!validation.allowed) throw new Error(validation.reason!);

  const { error: resolveError } = await supabase
    .from('disputes')
    .update({
      resolution: 'resolved_no_refund',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', dispute.id)
    .is('resolved_at', null);

  if (resolveError) throw new Error(`Failed to resolve dispute: ${resolveError.message}`);
  const { data: updatedOrder, error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'disputed')
    .select()
    .single<OrderRow>();

  if (orderError || !updatedOrder) {
    throw new Error('Failed to complete order after dispute withdrawal');
  }

  // Credit seller wallet (same as normal completion — shared helper)
  await creditSellerWallet(orderId, order);

  markSoldAndSyncShelf(order);

  void logAuditEvent({
    actorId: userId,
    actorType: 'user',
    action: 'dispute.withdrawn',
    resourceType: 'dispute',
    resourceId: dispute.id,
    metadata: { orderId },
  });

  // Email seller (non-blocking)
  sendDisputeWithdrawn({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: getOrderGameSummary(order.order_items, order.listings),
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    earningsCents: order.seller_wallet_credit_cents ?? 0,
  }).catch((err) => console.error('[Email] Failed to send dispute withdrawn email:', err));

  void notify(order.seller_id, 'dispute.withdrawn', {
    gameName: getOrderGameSummary(order.order_items, order.listings),
    orderNumber: order.order_number,
    orderId,
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
  });

  return updatedOrder;
}

/**
 * Seller accepts responsibility and agrees to a full refund.
 */
export async function sellerAcceptRefund(orderId: string, userId: string): Promise<OrderRow> {
  const supabase = createServiceClient();
  const [order, dispute] = await Promise.all([loadOrder(orderId), getDispute(orderId)]);

  if (!dispute) throw new Error('No dispute found for this order');
  if (order.status !== 'disputed') throw new Error('Order is not in disputed status');
  if (order.seller_id !== userId) throw new Error('Only the seller can accept a refund');
  if (dispute.resolved_at) throw new Error('Dispute is already resolved');
  if (dispute.escalated_at) throw new Error('Cannot accept refund after escalation — staff will resolve this dispute');

  // Claim the dispute atomically. `.select().single()` turns a zero-row
  // update into PGRST116 — without it, a concurrent loser would fall
  // through to refundOrder with a stale `refund_status` snapshot.
  const { data: claimedDispute, error: resolveError } = await supabase
    .from('disputes')
    .update({
      resolution: 'refunded',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      refund_amount_cents: order.total_amount_cents,
    })
    .eq('id', dispute.id)
    .is('resolved_at', null)
    .select('id')
    .single();

  if (resolveError || !claimedDispute) {
    throw new Error('Dispute is already resolved');
  }

  const { cardRefunded, walletRefunded } = await refundOrder(orderId, order);

  if (cardRefunded + walletRefunded === 0) {
    await handleRefundInitiationFailure(supabase, dispute.id, userId, orderId, order, 'dispute.seller_accepted_refund');
  }

  const { data: updatedOrder, error: orderError } = await supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', orderId)
    .eq('status', 'disputed')
    .select()
    .single<OrderRow>();

  if (orderError || !updatedOrder) {
    throw new Error('Failed to refund order');
  }

  // Mark order_items as inactive (frees partial unique index for re-listing)
  await supabase
    .from('order_items')
    .update({ active: false })
    .eq('order_id', orderId);

  const totalRefunded = cardRefunded + walletRefunded;
  void logAuditEvent({
    actorId: userId,
    actorType: 'user',
    action: 'dispute.seller_accepted_refund',
    resourceType: 'dispute',
    resourceId: dispute.id,
    metadata: { orderId, refundAmountCents: totalRefunded, cardRefunded, walletRefunded },
  });

  // Email both parties (non-blocking)
  sendDisputeResolvedRefund({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: getOrderGameSummary(order.order_items, order.listings),
    refundAmountCents: totalRefunded,
  }).catch((err) => console.error('[Email] Failed to send refund emails:', err));

  void notifyMany([
    { userId: order.buyer_id, type: 'dispute.resolved', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
    { userId: order.seller_id, type: 'dispute.resolved', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
  ]);

  return updatedOrder;
}

/**
 * Handle a total-failure return from refundOrder inside a dispute resolution
 * flow. Writes `refund_status='failed'` for staff visibility, rolls back the
 * caller's dispute claim so retry-via-UI works, captures Sentry with tagged
 * context, and throws RefundInitiationError. Never returns (marked `never`)
 * so callers can use it as a terminator without unreachable-code warnings.
 *
 * The claim is rolled back rather than documented as a manual runbook: the
 * alternative would be a subsequent retry hitting the `resolved_at IS NULL`
 * guard and reporting "already resolved" misleadingly.
 */
async function handleRefundInitiationFailure(
  supabase: ReturnType<typeof createServiceClient>,
  disputeId: string,
  claimedBy: string,
  orderId: string,
  order: Pick<OrderRow, 'buyer_id' | 'order_number'>,
  phase: string
): Promise<never> {
  await markRefundFailed(orderId);

  // Rollback is gated on `resolved_by = claimedBy` as defense in depth: a
  // losing caller (shouldn't reach here now that the claim uses .select().single(),
  // but belt-and-braces) can only ever roll back its own row.
  const { error: rollbackError } = await supabase
    .from('disputes')
    .update({
      resolution: null,
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      refund_amount_cents: null,
    })
    .eq('id', disputeId)
    .eq('resolved_by', claimedBy);

  if (rollbackError) {
    Sentry.captureException(rollbackError, {
      tags: { orderId, orderNumber: order.order_number, phase: 'dispute.rollback_failed' },
    });
  }

  const err = new RefundInitiationError(
    'Refund could not be processed — support has been notified',
    orderId,
    order.order_number
  );
  Sentry.captureException(err, {
    tags: { orderId, orderNumber: order.order_number, buyerId: order.buyer_id, phase },
  });
  throw err;
}

/**
 * Either party escalates the dispute to staff review.
 */
export async function escalateDispute(orderId: string, userId: string): Promise<DisputeRow> {
  const supabase = createServiceClient();
  const [order, dispute] = await Promise.all([loadOrder(orderId), getDispute(orderId)]);

  if (!dispute) throw new Error('No dispute found for this order');
  if (order.status !== 'disputed') throw new Error('Order is not in disputed status');

  const validation = canEscalateDispute(dispute, userId);
  if (!validation.allowed) throw new Error(validation.reason!);

  const { data: updatedDispute, error } = await supabase
    .from('disputes')
    .update({
      escalated_at: new Date().toISOString(),
      escalated_by: userId,
    })
    .eq('id', dispute.id)
    .is('escalated_at', null) // Only escalate if not already escalated
    .select()
    .single<DisputeRow>();

  if (error || !updatedDispute) {
    throw new Error('Failed to escalate dispute');
  }

  void logAuditEvent({
    actorId: userId,
    actorType: 'user',
    action: 'dispute.escalated',
    resourceType: 'dispute',
    resourceId: dispute.id,
    metadata: { orderId, escalatedBy: userId },
  });

  // Email both parties (non-blocking)
  sendDisputeEscalated({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: getOrderGameSummary(order.order_items, order.listings),
  }).catch((err) => console.error('[Email] Failed to send escalation emails:', err));

  void notifyMany([
    { userId: order.buyer_id, type: 'dispute.escalated', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
    { userId: order.seller_id, type: 'dispute.escalated', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
  ]);

  return updatedDispute;
}

/**
 * Staff resolves a dispute.
 * Can resolve any open dispute (escalation is not a prerequisite).
 */
export async function staffResolveDispute(
  orderId: string,
  staffUserId: string,
  decision: 'refund' | 'no_refund',
  notes?: string
): Promise<OrderRow> {
  const supabase = createServiceClient();
  const [order, dispute] = await Promise.all([loadOrder(orderId), getDispute(orderId)]);

  if (!dispute) throw new Error('No dispute found for this order');
  if (order.status !== 'disputed') throw new Error('Order is not in disputed status');
  if (dispute.resolved_at) throw new Error('Dispute is already resolved');

  if (decision === 'refund') {
    // Claim dispute resolution atomically (see sellerAcceptRefund for rationale).
    const { data: claimedDispute, error: resolveError } = await supabase
      .from('disputes')
      .update({
        resolution: 'refunded',
        resolved_at: new Date().toISOString(),
        resolved_by: staffUserId,
        resolution_notes: notes ?? null,
        refund_amount_cents: order.total_amount_cents,
      })
      .eq('id', dispute.id)
      .is('resolved_at', null)
      .select('id')
      .single();

    if (resolveError || !claimedDispute) {
      throw new Error('Dispute is already resolved');
    }

    const { cardRefunded, walletRefunded } = await refundOrder(orderId, order);

    if (cardRefunded + walletRefunded === 0) {
      await handleRefundInitiationFailure(supabase, dispute.id, staffUserId, orderId, order, 'dispute.staff_resolved');
    }

    const { data: updatedOrder, error: orderError } = await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', orderId)
      .eq('status', 'disputed')
      .select()
      .single<OrderRow>();

    if (orderError || !updatedOrder) throw new Error('Failed to refund order');

    // Mark order_items as inactive (frees partial unique index for re-listing)
    await supabase
      .from('order_items')
      .update({ active: false })
      .eq('order_id', orderId);

    // Restore listings to active so seller can re-list after refund
    const listingIds = getOrderListingIds(order.order_items, order.listing_id);
    if (listingIds.length > 0) {
      await supabase
        .from('listings')
        .update({ status: 'active' as const, reserved_at: null, reserved_by: null })
        .in('id', listingIds)
        .eq('status', 'reserved');

      // Shelf sync: revert items to open_to_offers (inverse of syncShelfOnListingSold)
      for (const listingId of listingIds) {
        void syncShelfOnListingRemoved(order.seller_id, listingId)
          .catch((err) => console.error('[Shelf] Failed to sync on refund:', err));
      }
    }

    const totalRefunded = cardRefunded + walletRefunded;
    void logAuditEvent({
      actorId: staffUserId,
      actorType: 'user',
      action: 'dispute.staff_resolved',
      resourceType: 'dispute',
      resourceId: dispute.id,
      metadata: { orderId, decision: 'refund', refundAmountCents: totalRefunded, cardRefunded, walletRefunded, notes },
    });

    sendDisputeResolvedRefund({
      buyerName: order.buyer_profile?.full_name ?? 'Buyer',
      buyerEmail: order.buyer_profile?.email ?? '',
      sellerName: order.seller_profile?.full_name ?? 'Seller',
      sellerEmail: order.seller_profile?.email ?? '',
      orderNumber: order.order_number,
      orderId,
      gameName: getOrderGameSummary(order.order_items, order.listings),
      refundAmountCents: totalRefunded,
      staffNotes: notes,
    }).catch((err) => console.error('[Email] Failed to send staff refund emails:', err));

    void notifyMany([
      { userId: order.buyer_id, type: 'dispute.resolved', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
      { userId: order.seller_id, type: 'dispute.resolved', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
    ]);

    return updatedOrder;
  }

  const { error: resolveError } = await supabase
    .from('disputes')
    .update({
      resolution: 'resolved_no_refund',
      resolved_at: new Date().toISOString(),
      resolved_by: staffUserId,
      resolution_notes: notes ?? null,
    })
    .eq('id', dispute.id)
    .is('resolved_at', null);

  if (resolveError) throw new Error(`Failed to resolve dispute: ${resolveError.message}`);

  // Transition order to completed
  const { data: updatedOrder, error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'disputed')
    .select()
    .single<OrderRow>();

  if (orderError || !updatedOrder) throw new Error('Failed to complete order');

  // Credit seller wallet (shared helper)
  await creditSellerWallet(orderId, order);

  markSoldAndSyncShelf(order);

  void logAuditEvent({
    actorId: staffUserId,
    actorType: 'user',
    action: 'dispute.staff_resolved',
    resourceType: 'dispute',
    resourceId: dispute.id,
    metadata: { orderId, decision: 'no_refund', notes },
  });

  sendDisputeResolvedNoRefund({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: getOrderGameSummary(order.order_items, order.listings),
    earningsCents: order.seller_wallet_credit_cents ?? 0,
    staffNotes: notes,
  }).catch((err) => console.error('[Email] Failed to send staff resolution emails:', err));

  void notifyMany([
    { userId: order.buyer_id, type: 'dispute.resolved', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
    { userId: order.seller_id, type: 'dispute.resolved', context: { gameName: getOrderGameSummary(order.order_items, order.listings), orderNumber: order.order_number, orderId } },
  ]);

  return updatedOrder;
}
