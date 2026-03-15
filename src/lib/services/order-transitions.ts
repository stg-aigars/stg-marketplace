/**
 * Order status transition service
 * Handles all order state machine transitions with validation and side effects.
 */

import { createServiceClient } from '@/lib/supabase';
import { createAndShipParcel } from '@/lib/services/unisend/client';
import { UNISEND_DEFAULT_PARCEL_SIZE } from '@/lib/services/unisend/types';
import type { TerminalCountry } from '@/lib/services/unisend/types';
import type { CreateParcelRequest } from '@/lib/services/unisend/types';
import { VALID_TRANSITIONS, TRANSITION_ROLES, STATUS_TIMESTAMP_COLUMN } from '@/lib/orders/constants';
import type { OrderStatus, OrderRow } from '@/lib/orders/types';
import {
  sendOrderAcceptedToBuyer,
  sendOrderShippedToBuyer,
  sendOrderDeliveredToBuyer,
  sendOrderCompletedToSeller,
  sendOrderDeclinedToBuyer,
  sendOrderDisputedToSeller,
} from '@/lib/email/stubs';

/**
 * Load an order by ID using the service client (bypasses RLS).
 */
async function loadOrder(orderId: string): Promise<OrderRow> {
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

  return data as OrderRow & {
    listings: { game_name: string; seller_id: string };
    buyer_profile: { full_name: string | null; email: string | null; phone: string | null; country: string };
    seller_profile: { full_name: string | null; email: string | null; phone: string | null; country: string };
  };
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
  extraUpdates?: Record<string, unknown>
): Promise<OrderRow> {
  const order = await loadOrder(orderId);

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

  // Optimistic locking: only update if status hasn't changed
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

  return data;
}

/**
 * Seller accepts an order. Creates Unisend parcel and stores shipping data.
 */
export async function acceptOrder(
  orderId: string,
  userId: string,
  sellerPhone: string
): Promise<{ order: OrderRow; parcelId: number; barcode: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await loadOrder(orderId) as any;

  if (order.seller_id !== userId) {
    throw new Error('Only the seller can accept this order');
  }
  if (order.status !== 'pending_seller') {
    throw new Error(`Cannot accept order in ${order.status} status`);
  }

  // Create Unisend parcel
  const parcelRequest: CreateParcelRequest = {
    plan: { code: 'TERMINAL' },
    parcel: {
      type: 'T2T',
      size: UNISEND_DEFAULT_PARCEL_SIZE,
      weight: 2,
    },
    sender: {
      name: order.seller_profile?.full_name ?? 'Seller',
      address: { countryCode: (order.seller_profile?.country ?? order.seller_country) as TerminalCountry },
      contacts: { phone: sellerPhone },
    },
    receiver: {
      name: order.buyer_profile?.full_name ?? 'Buyer',
      address: {
        countryCode: order.terminal_country as TerminalCountry,
        terminalId: order.terminal_id!,
      },
      contacts: { phone: order.buyer_phone! },
    },
  };

  const { parcelId, barcode, trackingUrl } = await createAndShipParcel(parcelRequest);

  // Transition with shipping data
  const updatedOrder = await transitionOrder(orderId, 'accepted', userId, 'seller', {
    unisend_parcel_id: parcelId,
    barcode,
    tracking_url: trackingUrl ?? `https://www.post.lt/siuntu-sekimas/?parcels=${encodeURIComponent(barcode)}`,
    seller_phone: sellerPhone,
  });

  // Email stub (non-blocking)
  sendOrderAcceptedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    sellerName: order.seller_profile?.full_name ?? 'Seller',
  }).catch(() => {});

  return { order: updatedOrder, parcelId, barcode };
}

/**
 * Seller declines an order. Restores listing to active.
 */
export async function declineOrder(orderId: string, userId: string): Promise<OrderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await loadOrder(orderId) as any;

  const updatedOrder = await transitionOrder(orderId, 'cancelled', userId, 'seller');

  // Restore listing to active
  const supabase = createServiceClient();
  await supabase
    .from('listings')
    .update({ status: 'active' })
    .eq('id', order.listing_id)
    .eq('status', 'reserved');

  // Email stub (non-blocking)
  sendOrderDeclinedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
  }).catch(() => {});

  return updatedOrder;
}

/**
 * Seller marks order as shipped (dropped at terminal).
 */
export async function markShipped(orderId: string, userId: string): Promise<OrderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await loadOrder(orderId) as any;
  const updatedOrder = await transitionOrder(orderId, 'shipped', userId, 'seller');

  sendOrderShippedToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    barcode: order.barcode ?? undefined,
    trackingUrl: order.tracking_url ?? undefined,
  }).catch(() => {});

  return updatedOrder;
}

/**
 * Buyer marks order as delivered (picked up from terminal).
 */
export async function markDelivered(orderId: string, userId: string): Promise<OrderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await loadOrder(orderId) as any;
  const updatedOrder = await transitionOrder(orderId, 'delivered', userId, 'buyer');

  sendOrderDeliveredToBuyer({
    buyerName: order.buyer_profile?.full_name ?? 'Buyer',
    buyerEmail: order.buyer_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
  }).catch(() => {});

  return updatedOrder;
}

/**
 * Buyer completes the order (confirms everything is good).
 */
export async function completeOrder(orderId: string, userId: string): Promise<OrderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await loadOrder(orderId) as any;
  const updatedOrder = await transitionOrder(orderId, 'completed', userId, 'buyer');

  // TODO: credit seller wallet (Week 5)
  console.log(`TODO: credit seller wallet for order ${orderId}, amount: ${order.seller_wallet_credit_cents} cents`);

  sendOrderCompletedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
  }).catch(() => {});

  return updatedOrder;
}

/**
 * Buyer disputes the order.
 */
export async function disputeOrder(orderId: string, userId: string, reason?: string): Promise<OrderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await loadOrder(orderId) as any;
  const updatedOrder = await transitionOrder(orderId, 'disputed', userId, 'buyer');

  sendOrderDisputedToSeller({
    sellerName: order.seller_profile?.full_name ?? 'Seller',
    sellerEmail: order.seller_profile?.email ?? '',
    orderNumber: order.order_number,
    orderId,
    gameName: order.listings?.game_name ?? 'Game',
    reason,
  }).catch(() => {});

  return updatedOrder;
}
