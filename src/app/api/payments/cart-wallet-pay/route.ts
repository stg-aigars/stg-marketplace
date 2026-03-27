/**
 * Full wallet payment for cart checkout.
 * Used when the buyer's wallet balance covers the entire cart total.
 * Bypasses EveryPay — reserves listings, debits wallet, creates orders directly.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createOrder } from '@/lib/services/orders';
import { debitWallet, getWalletBalance } from '@/lib/services/wallet';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { createServiceClient } from '@/lib/supabase';
import { sendCartOrderEmails } from '@/lib/email/cart-emails';
import { paymentLimiter, applyRateLimit } from '@/lib/rate-limit';
import { parseCartCheckoutBody } from '@/lib/api/checkout-validation';
import { logAuditEvent } from '@/lib/services/audit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(paymentLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // Parse and validate body
  const parsed = await parseCartCheckoutBody(request);
  if (parsed instanceof NextResponse) return parsed;

  const { listingIds, terminalId, terminalName, terminalCountry, buyerPhone, turnstileToken } = parsed;

  const turnstile = await verifyTurnstileToken(turnstileToken, getClientIp(request));
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 403 });
  }

  const serviceClient = createServiceClient();

  // Fetch all listings
  const { data: listings } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, game_name, reserved_by')
    .in('id', listingIds);

  if (!listings || listings.length !== listingIds.length) {
    return NextResponse.json({ error: 'Some items are no longer available' }, { status: 400 });
  }

  for (const listing of listings) {
    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot buy your own listing' }, { status: 400 });
    }
    const canCheckout = listing.status === 'active' ||
      (listing.status === 'reserved' && listing.reserved_by === user.id);
    if (!canCheckout) {
      return NextResponse.json({ error: 'Some items are no longer available' }, { status: 400 });
    }
  }

  // Get buyer profile
  const { data: buyerProfile } = await supabase
    .from('user_profiles')
    .select('country')
    .eq('id', user.id)
    .single();

  if (!buyerProfile?.country) {
    return NextResponse.json({ error: 'Please set your country in your profile first' }, { status: 400 });
  }

  // Calculate totals
  const sellerMap = new Map<string, typeof listings>();
  for (const listing of listings) {
    const group = sellerMap.get(listing.seller_id) ?? [];
    group.push(listing);
    sellerMap.set(listing.seller_id, group);
  }

  const itemsTotalCents = listings.reduce((sum, l) => sum + l.price_cents, 0);
  let shippingTotalCents = 0;
  const sellerShipping = new Map<string, number>();

  for (const [sellerId, sellerListings] of Array.from(sellerMap.entries())) {
    const shippingCents = getShippingPriceCents(
      sellerListings[0].country as TerminalCountry,
      buyerProfile.country as TerminalCountry
    );
    if (shippingCents === null) {
      return NextResponse.json({ error: 'Shipping is not available for this route' }, { status: 400 });
    }
    sellerShipping.set(sellerId, shippingCents);
    shippingTotalCents += shippingCents;
  }

  const grandTotalCents = itemsTotalCents + shippingTotalCents;

  // Verify wallet covers the full amount
  const walletBalance = await getWalletBalance(user.id);
  if (walletBalance < grandTotalCents) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
  }

  // Reserve atomically
  const { data: failedIds, error: rpcError } = await serviceClient
    .rpc('reserve_listings_atomic', {
      p_listing_ids: listingIds,
      p_buyer_id: user.id,
    });

  if (rpcError || (failedIds && failedIds.length > 0)) {
    return NextResponse.json({ error: 'Some items are no longer available' }, { status: 400 });
  }

  // Create a cart checkout group for record-keeping
  const cartGroupId = crypto.randomUUID();

  // Pre-compute per-order wallet allocation (each order gets its listingTotal since wallet covers all)
  const firstForSellerPrecompute = new Set<string>();
  const orderAllocations: { listing: typeof listings[0]; shippingCents: number; walletDebit: number }[] = [];
  let allocatedTotal = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const isFirst = !firstForSellerPrecompute.has(listing.seller_id);
    firstForSellerPrecompute.add(listing.seller_id);
    const shippingCents = isFirst ? (sellerShipping.get(listing.seller_id) ?? 0) : 0;
    const listingTotal = listing.price_cents + shippingCents;

    if (i < listings.length - 1) {
      orderAllocations.push({ listing, shippingCents, walletDebit: listingTotal });
      allocatedTotal += listingTotal;
    } else {
      // Last order gets remainder to avoid rounding drift
      orderAllocations.push({ listing, shippingCents, walletDebit: grandTotalCents - allocatedTotal });
    }
  }

  // Create orders and debit wallet
  const createdOrders: { id: string; orderNumber: string; index: number }[] = [];

  try {
    for (let i = 0; i < orderAllocations.length; i++) {
      const { listing, shippingCents, walletDebit: walletForOrder } = orderAllocations[i];
      const order = await createOrder({
        buyerId: user.id,
        sellerId: listing.seller_id,
        listingId: listing.id,
        itemsTotalCents: listing.price_cents,
        shippingCostCents: shippingCents,
        sellerCountry: listing.country,
        paymentMethod: 'wallet',
        walletDebitCents: walletForOrder,
        terminalId,
        terminalName,
        terminalCountry,
        buyerPhone,
        cartGroupId,
      });

      createdOrders.push({ id: order.id, orderNumber: order.order_number, index: i });

      // Debit wallet for this order
      if (walletForOrder > 0) {
        await debitWallet(
          user.id,
          walletForOrder,
          order.id,
          `Purchase: ${listing.game_name ?? 'Game'} — ${order.order_number}`
        );
      }
    }
  } catch (error) {
    console.error('[Cart Wallet] Failed during order creation:', error);
    // Unreserve remaining listings
    await serviceClient.rpc('unreserve_listings', {
      p_listing_ids: listingIds,
      p_buyer_id: user.id,
    });
    return NextResponse.json({ error: 'Failed to create orders. Please try again.' }, { status: 500 });
  }

  void logAuditEvent({
    actorId: user.id,
    actorType: 'user',
    action: 'payment.cart_wallet_completed',
    resourceType: 'cart_group',
    resourceId: cartGroupId,
    metadata: {
      orderCount: createdOrders.length,
      totalAmountCents: grandTotalCents,
      paymentMethod: 'wallet',
    },
  });

  // Send emails (non-blocking)
  void sendCartOrderEmails(
    createdOrders.map(({ id, orderNumber, index }) => ({
      orderId: id,
      orderNumber,
      sellerId: orderAllocations[index].listing.seller_id,
      gameName: orderAllocations[index].listing.game_name ?? 'Game',
      priceCents: orderAllocations[index].listing.price_cents,
      shippingCents: orderAllocations[index].shippingCents,
      terminalName,
    })),
    user.id
  );

  return NextResponse.json({ groupId: cartGroupId, orderIds: createdOrders.map((o) => o.id) });
}
