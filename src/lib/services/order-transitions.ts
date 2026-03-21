/**
 * Order status transition service
 * Handles all order state machine transitions with validation and side effects.
 */

import { createServiceClient } from '@/lib/supabase';
import { createOrderShipping } from '@/lib/services/unisend/shipping';
import { creditWallet } from '@/lib/services/wallet';
import { VALID_TRANSITIONS, TRANSITION_ROLES, STATUS_TIMESTAMP_COLUMN } from '@/lib/orders/constants';
import type { OrderStatus, OrderRow, OrderWithRelations } from '@/lib/orders/types';
import {
  sendOrderAcceptedToBuyer,
  sendOrderShippedToBuyer,
  sendOrderDeliveredToBuyer,
  sendOrderCompletedToSeller,
  sendOrderDeclinedToBuyer,
  sendOrderDisputedToSeller,
} from '@/lib/email';
import { logAuditEvent } from '@/lib/services/audit';

/**
 * Load an order by ID using the service client (bypasses RLS).
 */
async function loadOrder(orderId: string): Promise<OrderWithRelations> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
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
  const updatedOrder = await transitionOrder(orderId, 'accepted', userId, 'seller', {
    seller_phone: sellerPhone,
  }, order);

  // 2. Attempt shipping — failure won't roll back the accept
  const shippingResult = await createOrderShipping({
    orderId,
    orderNumber: order.order_number,
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
      terminalAddress: '',
    },
    parcelSize: null,
  });

  // 3. Email buyer about acceptance (non-blocking)
  sendOrderAcceptedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    sellerName: order.seller_profile?.full_name ?? 'Seller',
  }).catch((err) => console.error('[Email] Failed to send order-accepted to buyer:', err));

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

  const updatedOrder = await transitionOrder(orderId, 'cancelled', userId, 'seller', undefined, order);

  // Restore listing to active and clear reservation fields
  const supabase = createServiceClient();
  await supabase
    .from('listings')
    .update({ status: 'active', reserved_at: null, reserved_by: null })
    .eq('id', order.listing_id)
    .eq('status', 'reserved');

  // Email stub (non-blocking)
  sendOrderDeclinedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
  }).catch((err) => console.error('[Email] Failed to send order-declined to buyer:', err));

  return updatedOrder;
}

/**
 * Seller marks order as shipped (dropped at terminal).
 */
export async function markShipped(orderId: string, userId: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  const updatedOrder = await transitionOrder(orderId, 'shipped', userId, 'seller', undefined, order);

  sendOrderShippedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    barcode: order.barcode ?? undefined,
    trackingUrl: order.tracking_url ?? undefined,
  }).catch((err) => console.error('[Email] Failed to send order-shipped to buyer:', err));

  return updatedOrder;
}

/**
 * Buyer marks order as delivered (picked up from terminal).
 */
export async function markDelivered(orderId: string, userId: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  const updatedOrder = await transitionOrder(orderId, 'delivered', userId, 'buyer', undefined, order);

  sendOrderDeliveredToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
  }).catch((err) => console.error('[Email] Failed to send order-delivered to buyer:', err));

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

  sendOrderCompletedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    earningsCents: order.seller_wallet_credit_cents ?? 0,
  }).catch((err) => console.error('[Email] Failed to send order-completed to seller:', err));

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

  // Credit seller wallet (idempotent)
  await creditSellerWallet(orderId, order);

  // Email seller about completion (non-blocking)
  sendOrderCompletedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    earningsCents: order.seller_wallet_credit_cents ?? 0,
  }).catch((err) => console.error('[Email] Failed to send auto-complete email to seller:', err));

  return data;
}

/**
 * Credit seller wallet on order completion.
 * Shared by completeOrder (buyer-initiated) and autoCompleteOrder (cron).
 * Idempotent via creditWallet's order_id + type='credit' check.
 */
async function creditSellerWallet(orderId: string, order: OrderWithRelations): Promise<void> {
  if (!order.seller_wallet_credit_cents || order.seller_wallet_credit_cents <= 0) return;

  await creditWallet(
    order.seller_id,
    order.seller_wallet_credit_cents,
    orderId,
    `Sale: ${order.listings?.game_name ?? 'Game'} — ${order.order_number}`
  );

  // Mark wallet_credited_at on the order
  const supabase = createServiceClient();
  await supabase
    .from('orders')
    .update({ wallet_credited_at: new Date().toISOString() })
    .eq('id', orderId);
}

/**
 * Buyer disputes the order.
 */
export async function disputeOrder(orderId: string, userId: string, reason?: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  const updatedOrder = await transitionOrder(orderId, 'disputed', userId, 'buyer', undefined, order);

  sendOrderDisputedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    reason,
  }).catch((err) => console.error('[Email] Failed to send order-disputed to seller:', err));

  return updatedOrder;
}
