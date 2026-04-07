/**
 * Order service
 * Handles order creation, retrieval, and number generation.
 * Orders are only created AFTER payment is confirmed.
 */

import { createServiceClient } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { calculateOrderPricing, getVatRate, calculateVatSplit } from '@/lib/services/pricing';
import { ORDER_NUMBER_PREFIX } from '@/lib/orders/constants';
import type { CreateOrderParams, OrderRow, OrderWithDetails } from '@/lib/orders/types';

/**
 * Generate a unique order number: STG-YYYYMMDD-XXXX
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 for readability
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${ORDER_NUMBER_PREFIX}-${date}-${random}`;
}

/**
 * Create an order after payment has been verified.
 * Uses service client to bypass RLS (no INSERT policy on orders).
 * Supports multi-item orders (same seller) via the `items` array.
 * Also updates all listing statuses to 'reserved'.
 */
export async function createOrder(params: CreateOrderParams): Promise<OrderRow> {
  const serviceClient = createServiceClient();

  const itemsTotalCents = params.items.reduce((sum, i) => sum + i.priceCents, 0);
  const pricing = calculateOrderPricing(itemsTotalCents, params.shippingCostCents);

  // VAT breakdown for commission and shipping (based on seller's country)
  const vatRate = getVatRate(params.sellerCountry);
  const commissionVat = calculateVatSplit(pricing.commissionCents, vatRate);
  const shippingVat = calculateVatSplit(params.shippingCostCents, vatRate);

  const listingIds = params.items.map((i) => i.listingId);

  const isPreAssigned = !!params.orderNumber;
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < (isPreAssigned ? 1 : MAX_RETRIES); attempt++) {
    const orderNumber = isPreAssigned ? params.orderNumber! : generateOrderNumber();

    const { data: order, error: insertError } = await serviceClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        buyer_id: params.buyerId,
        seller_id: params.sellerId,
        listing_id: null,
        item_count: params.items.length,
        status: 'pending_seller',
        total_amount_cents: pricing.totalChargeCents,
        items_total_cents: pricing.itemsTotalCents,
        shipping_cost_cents: pricing.shippingCostCents,
        seller_country: params.sellerCountry,
        everypay_payment_reference: params.paymentReference,
        everypay_payment_state: params.paymentState,
        payment_method: params.paymentMethod,
        platform_commission_cents: pricing.commissionCents,
        seller_wallet_credit_cents: pricing.walletCreditCents,
        buyer_wallet_debit_cents: params.walletDebitCents ?? 0,
        commission_net_cents: commissionVat.netCents,
        commission_vat_cents: commissionVat.vatCents,
        shipping_net_cents: shippingVat.netCents,
        shipping_vat_cents: shippingVat.vatCents,
        terminal_id: params.terminalId,
        terminal_name: params.terminalName,
        terminal_address: params.terminalAddress ?? null,
        terminal_city: params.terminalCity ?? null,
        terminal_postal_code: params.terminalPostalCode ?? null,
        terminal_country: params.terminalCountry,
        buyer_phone: params.buyerPhone,
        ...(params.cartGroupId ? { cart_group_id: params.cartGroupId } : {}),
      })
      .select()
      .single<OrderRow>();

    // Unique constraint violation — retry with a new number (random collision)
    if (insertError?.code === '23505' && !isPreAssigned) {
      lastError = new Error(`Order number collision on attempt ${attempt + 1}`);
      continue;
    }

    if (insertError || !order) {
      const message = isPreAssigned && insertError?.code === '23505'
        ? `Failed to create order: duplicate order number ${orderNumber}`
        : `Failed to create order: ${insertError?.message ?? 'Unknown error'}`;
      throw new Error(message);
    }

    // Insert order_items rows
    const { error: itemsError } = await serviceClient
      .from('order_items')
      .insert(
        params.items.map((item) => ({
          order_id: order.id,
          listing_id: item.listingId,
          price_cents: item.priceCents,
        }))
      );

    if (itemsError) {
      // Roll back the order if items insertion fails
      await serviceClient.from('orders').delete().eq('id', order.id);
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // Update all listing statuses to 'reserved' using .in() — never a loop
    // Listings may already be 'reserved' (by this buyer via checkout initiation), 'active'
    // (if the reservation timer expired but nobody else took it), or 'auction_ended'
    // (auction winner paying — transition directly to reserved/sold)
    const { data: updatedListings } = await serviceClient
      .from('listings')
      .update({ status: 'reserved', reserved_at: new Date().toISOString(), reserved_by: params.buyerId })
      .in('id', listingIds)
      .or(`status.eq.active,and(status.eq.reserved,reserved_by.eq.${params.buyerId}),status.eq.auction_ended`)
      .select('id');

    if (!updatedListings || updatedListings.length !== listingIds.length) {
      // Some listings were reserved by someone else or already sold — roll back
      await serviceClient.from('order_items').delete().eq('order_id', order.id);
      await serviceClient.from('orders').delete().eq('id', order.id);
      // Unreserve any listings that were just updated
      if (updatedListings && updatedListings.length > 0) {
        const updatedIds = updatedListings.map((l) => l.id);
        await serviceClient
          .from('listings')
          .update({ status: 'active', reserved_at: null, reserved_by: null })
          .in('id', updatedIds);
      }
      throw new Error('One or more listings are no longer available');
    }

    return order;
  }

  throw lastError ?? new Error('Failed to create order after retries');
}

/**
 * Get a single order with joined listing and profile data.
 * Uses the authenticated server client — RLS ensures buyer/seller access only.
 */
export async function getOrder(orderId: string): Promise<OrderWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(id, order_id, listing_id, price_cents, active, created_at,
        listings(game_name, game_year, condition, photos, games(thumbnail),
          listing_expansions(game_name))
      ),
      listings(game_name, game_year, condition, photos, games(thumbnail)),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, avatar_url, country, phone, email),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name, avatar_url, country, phone, email)
    `)
    .eq('id', orderId)
    .single<OrderWithDetails>();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get all orders for a user, filtered by role (buyer or seller).
 * Uses the authenticated server client — RLS handles authorization.
 */
export async function getUserOrders(
  userId: string,
  role: 'buyer' | 'seller'
): Promise<OrderWithDetails[]> {
  const supabase = await createClient();

  const column = role === 'buyer' ? 'buyer_id' : 'seller_id';

  // List view: lighter query — only fetch what OrderCard needs (name + thumbnail)
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(id, listing_id, price_cents, active,
        listings(game_name, games(thumbnail))
      ),
      listings(game_name, games(thumbnail)),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, avatar_url, country, phone, email),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name, avatar_url, country, phone, email)
    `)
    .eq(column, userId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as OrderWithDetails[];
}
