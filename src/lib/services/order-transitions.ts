/**
 * Order status transition service
 * Handles all order state machine transitions with validation and side effects.
 */

import { createServiceClient } from '@/lib/supabase';
import { createOrderShipping, cancelOrderShipment } from '@/lib/services/unisend/shipping';
import { creditWallet } from '@/lib/services/wallet';
import { refundOrder } from '@/lib/services/order-refund';
import { issueInvoice } from '@/lib/services/invoicing';
import { notify } from '@/lib/notifications';
import { VALID_TRANSITIONS, TRANSITION_ROLES, STATUS_TIMESTAMP_COLUMN } from '@/lib/orders/constants';
import type { OrderStatus, OrderRow, OrderWithRelations } from '@/lib/orders/types';
import {
  sendOrderAcceptedToBuyer,
  sendOrderShippedToBuyer,
  sendOrderDeliveredToBuyer,
  sendOrderDeliveredToSeller,
  sendOrderCompletedToSeller,
  sendOrderDeclinedToBuyer,
} from '@/lib/email';
import { logAuditEvent } from '@/lib/services/audit';
import { updateDac7StatsOnCompletion } from '@/lib/dac7/service';
import { getOrderGameSummary, getOrderListingIds } from '@/lib/orders/utils';

/**
 * Load an order by ID using the service client (bypasses RLS).
 * Shared by order-transitions and dispute services.
 */
export async function loadOrder(orderId: string): Promise<OrderWithRelations> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(listing_id, price_cents, listings(game_name, seller_id)),
      listings(game_name, seller_id),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email, phone, country),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name, email, phone, country)
    `)
    .eq('id', orderId)
    .single();

  if (error || !data) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return data as OrderWithRelations;
}

/**
 * Core transition function with optimistic locking.
 * Validates role + state machine, updates status + timestamp.
 */
async function transitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  userId: string,
  role: 'buyer' | 'seller',
  extraUpdates?: Record<string, unknown>,
  preloadedOrder?: OrderWithRelations
): Promise<OrderRow> {
  const order = preloadedOrder ?? await loadOrder(orderId);

  // Verify role
  if (role === 'seller' && order.seller_id !== userId) {
    throw new Error('Only the seller can perform this action');
  }
  if (role === 'buyer' && order.buyer_id !== userId) {
    throw new Error('Only the buyer can perform this action');
  }

  // Verify transition is valid
  const currentStatus = order.status as OrderStatus;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowedTransitions.includes(toStatus)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${toStatus}`);
  }

  // Verify correct role for this transition
  const requiredRole = TRANSITION_ROLES[toStatus];
  if (requiredRole && requiredRole !== role) {
    throw new Error(`This action requires the ${requiredRole}`);
  }

  // Build update payload
  const timestampCol = STATUS_TIMESTAMP_COLUMN[toStatus];
  const updates: Record<string, unknown> = {
    status: toStatus,
    ...(timestampCol ? { [timestampCol]: new Date().toISOString() } : {}),
    ...extraUpdates,
  };

  const supabase = createServiceClient();

  // Optimistic locking: only update if status hasn't changed in the database.
  // This is essential even when using a preloaded order — the DB check at update
  // time is what prevents races, not the in-memory status read.
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .eq('status', currentStatus)
    .select()
    .single<OrderRow>();

  if (error || !data) {
    throw new Error(`Failed to update order status: ${error?.message ?? 'Order status has changed'}`);
  }

  void logAuditEvent({
    actorId: userId,
    actorType: 'user',
    action: 'order.status_changed',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { from: currentStatus, to: toStatus, role },
  });

  return data;
}

/**
 * Seller accepts an order. Transitions to 'accepted' first, then attempts
 * Unisend parcel creation. If shipping fails, the order remains accepted
 * and the seller can retry via the retry-shipping route.
 */
export async function acceptOrder(
  orderId: string,
  userId: string,
  sellerPhone: string
): Promise<{
  order: OrderRow;
  parcelId: number | null;
  barcode: string | null;
  shippingError?: string;
}> {
  const order = await loadOrder(orderId);

  if (order.seller_id !== userId) {
    throw new Error('Only the seller can accept this order');
  }
  if (order.status !== 'pending_seller') {
    throw new Error(`Cannot accept order in ${order.status} status`);
  }

  // 1. Transition to accepted FIRST — seller intent shouldn't be blocked by Unisend
  // Reset deadline_reminder_sent_at so the shipping phase reminder can fire
  const updatedOrder = await transitionOrder(orderId, 'accepted', userId, 'seller', {
    seller_phone: sellerPhone,
    deadline_reminder_sent_at: null,
  }, order);

  // Mark listings as sold early — also called at completeOrder, idempotent
  markOrderListingsSold(order);

  // 2. Attempt shipping — failure won't roll back the accept
  const items = order.order_items && order.order_items.length > 0
    ? order.order_items.map((i) => ({ gameName: i.listings?.game_name ?? null, priceCents: i.price_cents }))
    : [{ gameName: order.listings?.game_name ?? null, priceCents: order.items_total_cents }];

  const shippingResult = await createOrderShipping({
    orderId,
    orderNumber: order.order_number,
    sellerId: order.seller_id,
    seller: {
      fullName: order.seller_profile?.full_name ?? 'Seller',
      phone: sellerPhone,
      email: order.seller_profile?.email ?? '',
      country: order.seller_profile?.country ?? order.seller_country,
    },
    buyer: {
      fullName: order.buyer_profile?.full_name ?? 'Buyer',
      email: order.buyer_profile?.email ?? '',
    },
    receiver: {
      name: order.buyer_profile?.full_name ?? 'Buyer',
      phone: order.buyer_phone ?? '',
    },
    destination: {
      country: order.terminal_country,
      terminalId: order.terminal_id ?? '',
      terminalName: order.terminal_name ?? '',
      terminalAddress: order.terminal_address ?? '',
    },
    parcelSize: null,
    items,
  });

  // 3. Email buyer about acceptance (non-blocking)
  const gameSummary = getOrderGameSummary(order.order_items, order.listings);
  sendOrderAcceptedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: gameSummary,
    sellerName: order.seller_profile?.full_name ?? 'Seller',
  }).catch((err) => console.error('[Email] Failed to send order-accepted to buyer:', err));
  void notify(order.buyer_id, 'order.accepted', { gameName: gameSummary, orderNumber: order.order_number, orderId });

  if (shippingResult.success) {
    return {
      order: updatedOrder,
      parcelId: shippingResult.parcelId,
      barcode: shippingResult.barcode,
    };
  }

  return {
    order: updatedOrder,
    parcelId: null,
    barcode: null,
    shippingError: shippingResult.error,
  };
}

/**
 * Seller declines an order. Restores listing to active.
 */
export async function declineOrder(orderId: string, userId: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);

  const updatedOrder = await transitionOrder(orderId, 'cancelled', userId, 'seller', { cancellation_reason: 'declined' }, order);

  // Restore all listings to active and clear reservation fields
  const supabase = createServiceClient();
  const listingIds = getOrderListingIds(order.order_items, order.listing_id);
  if (listingIds.length > 0) {
    await supabase
      .from('listings')
      .update({ status: 'active', reserved_at: null, reserved_by: null })
      .in('id', listingIds)
      .eq('status', 'reserved');

    // Mark order_items as inactive (frees partial unique index for re-listing)
    await supabase
      .from('order_items')
      .update({ active: false })
      .eq('order_id', orderId);
  }

  // Cancel Unisend shipment if one was created (helper no-ops if no parcel, never throws)
  void cancelOrderShipment(orderId).catch(() => {});

  // Refund buyer (card, wallet, or both)
  await refundOrder(orderId, order);

  // Email (non-blocking)
  const gameSummary = getOrderGameSummary(order.order_items, order.listings);
  sendOrderDeclinedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: gameSummary,
    paymentMethod: order.payment_method,
  }).catch((err) => console.error('[Email] Failed to send order-declined to buyer:', err));
  void notify(order.buyer_id, 'order.declined', { gameName: gameSummary, orderNumber: order.order_number, orderId });

  return updatedOrder;
}

/**
 * Seller marks order as shipped (dropped at terminal).
 */
export async function markShipped(orderId: string, userId: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  // Reset deadline_reminder_sent_at so the delivery phase reminder can fire
  const updatedOrder = await transitionOrder(orderId, 'shipped', userId, 'seller', {
    deadline_reminder_sent_at: null,
  }, order);

  const gameSummary = getOrderGameSummary(order.order_items, order.listings);
  sendOrderShippedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: gameSummary,
    barcode: order.barcode ?? undefined,
    trackingUrl: order.tracking_url ?? undefined,
  }).catch((err) => console.error('[Email] Failed to send order-shipped to buyer:', err));
  void notify(order.buyer_id, 'order.shipped', { gameName: gameSummary, orderNumber: order.order_number, orderId });

  return updatedOrder;
}

/**
 * Buyer marks order as delivered (picked up from terminal).
 */
export async function markDelivered(orderId: string, userId: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  const updatedOrder = await transitionOrder(orderId, 'delivered', userId, 'buyer', undefined, order);

  const gameSummary = getOrderGameSummary(order.order_items, order.listings);
  const buyerEmail = order.buyer_profile?.email;
  const sellerEmail = order.seller_profile?.email;

  if (buyerEmail) {
    void sendOrderDeliveredToBuyer({
      buyerName: order.buyer_profile?.full_name ?? 'Buyer',
      buyerEmail,
      orderNumber: order.order_number,
      orderId,
      gameName: gameSummary,
    }).catch((err) => console.error('[Email] Failed to send order-delivered to buyer:', err));
  }
  if (sellerEmail) {
    void sendOrderDeliveredToSeller({
      sellerName: order.seller_profile?.full_name ?? 'Seller',
      sellerEmail,
      orderNumber: order.order_number,
      orderId,
      gameName: gameSummary,
      buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    }).catch((err) => console.error('[Email] Failed to send order-delivered to seller:', err));
  }
  void notify(order.buyer_id, 'order.delivered', { gameName: gameSummary, orderNumber: order.order_number, orderId });
  void notify(order.seller_id, 'order.delivered_seller', { gameName: gameSummary, orderNumber: order.order_number, orderId, buyerName: order.buyer_profile?.full_name ?? undefined });

  return updatedOrder;
}

/**
 * Buyer completes the order (confirms everything is good).
 */
export async function completeOrder(orderId: string, userId: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  const updatedOrder = await transitionOrder(orderId, 'completed', userId, 'buyer', undefined, order);

  // Credit seller wallet with earnings (idempotent — safe to retry)
  await creditSellerWallet(orderId, order);

  // Issue invoice — after wallet credit so the financial operation isn't blocked.
  // If this fails, the order is complete with wallet credited; reconciliation cron retries.
  void issueInvoice(orderId).catch((err) => console.error('[Invoicing] Failed to issue invoice:', err));

  // DAC7: track seller stats for tax reporting thresholds (fire-and-forget)
  void updateDac7StatsOnCompletion(
    order.seller_id,
    order.items_total_cents,
    order.platform_commission_cents ?? 0
  ).catch((err) => console.error('[DAC7] Failed to update stats:', err));

  markOrderListingsSold(order);

  const gameSummary = getOrderGameSummary(order.order_items, order.listings);
  sendOrderCompletedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: gameSummary,
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    earningsCents: order.seller_wallet_credit_cents ?? 0,
  }).catch((err) => console.error('[Email] Failed to send order-completed to seller:', err));
  void notify(order.seller_id, 'order.completed', { gameName: gameSummary, orderNumber: order.order_number, orderId });

  return updatedOrder;
}

/**
 * System auto-completes an order after the dispute window expires.
 * Called by the escrow cron — no buyer role check needed.
 * Idempotent: early-bail if already completed, plus creditWallet idempotency.
 */
export async function autoCompleteOrder(orderId: string): Promise<OrderRow | null> {
  const order = await loadOrder(orderId);

  // Early bail if already completed (guards against cron + manual race)
  if (order.status === 'completed') return order;

  if (order.status !== 'delivered') {
    throw new Error(`Cannot auto-complete order in ${order.status} status`);
  }

  const supabase = createServiceClient();

  // Transition to completed (optimistic lock on delivered status)
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'delivered')
    .select()
    .single<OrderRow>();

  if (error || !data) {
    // Status changed between load and update — another process handled it
    return null;
  }

  void logAuditEvent({
    actorType: 'cron',
    action: 'order.status_changed',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { from: 'delivered', to: 'completed', role: 'cron' },
  });

  // Credit seller wallet (idempotent)
  await creditSellerWallet(orderId, order);

  // Issue invoice (fire-and-forget — reconciliation cron retries if this fails)
  void issueInvoice(orderId).catch((err) => console.error('[Invoicing] Failed to issue invoice:', err));

  // DAC7: track seller stats for tax reporting thresholds (fire-and-forget)
  void updateDac7StatsOnCompletion(
    order.seller_id,
    order.items_total_cents,
    order.platform_commission_cents ?? 0
  ).catch((err) => console.error('[DAC7] Failed to update stats:', err));

  markOrderListingsSold(order);

  // Email seller about completion (non-blocking)
  const gameSummary = getOrderGameSummary(order.order_items, order.listings);
  sendOrderCompletedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: gameSummary,
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    earningsCents: order.seller_wallet_credit_cents ?? 0,
  }).catch((err) => console.error('[Email] Failed to send auto-complete email to seller:', err));
  void notify(order.seller_id, 'order.completed', { gameName: gameSummary, orderNumber: order.order_number, orderId });

  return data;
}

/**
 * Guards with status IN ('reserved', 'active') to avoid touching cancelled listings;
 * 'active' catches the edge case where the expire cron already wrongly reverted the reservation.
 */
async function markListingsAsSold(
  orderItems: { listing_id: string }[] | undefined,
  legacyListingId: string | null | undefined
): Promise<void> {
  const listingIds = getOrderListingIds(orderItems, legacyListingId);
  if (listingIds.length === 0) return;

  const supabase = createServiceClient();
  await supabase
    .from('listings')
    .update({ status: 'sold' as const, reserved_at: null, reserved_by: null })
    .in('id', listingIds)
    .in('status', ['reserved', 'active']);
}

/**
 * Mark listings as sold + sync shelf items to not_for_sale. Fire-and-forget:
 * listing status is cosmetic and must not delay wallet credit or block completion.
 * Shared by acceptOrder, completeOrder, autoCompleteOrder, withdrawDispute, and staffResolveDispute (no_refund).
 * Called early at acceptance and again at completion — idempotent (.in('status', ['reserved', 'active']) guard).
 */
export function markOrderListingsSold(order: Pick<OrderWithRelations, 'order_items' | 'listing_id' | 'seller_id'>): void {
  void markListingsAsSold(order.order_items, order.listing_id)
    .catch((err) => console.error('[Listings] Failed to mark as sold:', err));
}

/**
 * Credit seller wallet on order completion.
 * Shared by completeOrder, autoCompleteOrder, withdrawDispute, and staffResolveDispute (no_refund).
 * Idempotent via creditWallet's order_id + type='credit' check.
 */
export async function creditSellerWallet(orderId: string, order: Pick<OrderWithRelations, 'seller_id' | 'seller_wallet_credit_cents' | 'listings' | 'order_number'>): Promise<void> {
  if (!order.seller_wallet_credit_cents || order.seller_wallet_credit_cents <= 0) return;

  const gameSummary = getOrderGameSummary(
    'order_items' in order ? (order as OrderWithRelations).order_items : undefined,
    order.listings
  );

  await creditWallet(
    order.seller_id,
    order.seller_wallet_credit_cents,
    orderId,
    `Sale: ${gameSummary} — ${order.order_number}`
  );

  // Mark wallet_credited_at on the order
  const supabase = createServiceClient();
  await supabase
    .from('orders')
    .update({ wallet_credited_at: new Date().toISOString() })
    .eq('id', orderId);
}