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

  // Build per-seller-group order allocations (one order per seller)
  const sellerGroupAllocations: Array<{
    sellerId: string;
    items: typeof listings;
    shippingCents: number;
    walletDebit: number;
  }> = [];
  let allocatedTotal = 0;
  const sellerEntries = Array.from(sellerMap.entries());

  for (let i = 0; i < sellerEntries.length; i++) {
    const [sellerId, sellerListings] = sellerEntries[i];
    const shippingCents = sellerShipping.get(sellerId) ?? 0;
    const sellerItemsTotal = sellerListings.reduce((sum, l) => sum + l.price_cents, 0);
    const sellerTotal = sellerItemsTotal + shippingCents;

    if (i < sellerEntries.length - 1) {
      sellerGroupAllocations.push({ sellerId, items: sellerListings, shippingCents, walletDebit: sellerTotal });
      allocatedTotal += sellerTotal;
    } else {
      // Last seller group gets remainder to avoid rounding drift
      sellerGroupAllocations.push({ sellerId, items: sellerListings, shippingCents, walletDebit: grandTotalCents - allocatedTotal });
    }
  }

  // Create one consolidated order per seller group and debit wallet
  const createdOrders: Array<{ id: string; orderNumber: string; sellerId: string; items: typeof listings; shippingCents: number }> = [];

  try {
    for (const { sellerId, items, shippingCents, walletDebit: walletForOrder } of sellerGroupAllocations) {
      const order = await createOrder({
        buyerId: user.id,
        sellerId,
        items: items.map((l) => ({ listingId: l.id, priceCents: l.price_cents })),
        shippingCostCents: shippingCents,
        sellerCountry: items[0].country,
        paymentMethod: 'wallet',
        walletDebitCents: walletForOrder,
        terminalId,
        terminalName,
        terminalCountry,
        buyerPhone,
        cartGroupId,
      });

      createdOrders.push({ id: order.id, orderNumber: order.order_number, sellerId, items, shippingCents });

      // Debit wallet for this order
      if (walletForOrder > 0) {
        const gameNames = items.map((l) => l.game_name ?? 'Game').join(', ');
        await debitWallet(
          user.id,
          walletForOrder,
          order.id,
          `Purchase: ${gameNames} — ${order.order_number}`
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
      totalItemCount: listings.length,
      totalAmountCents: grandTotalCents,
      paymentMethod: 'wallet',
    },
  });

  // Send emails (non-blocking)
  void sendCartOrderEmails(
    createdOrders.map(({ id, orderNumber, sellerId: sid, items, shippingCents }) => ({
      orderId: id,
      orderNumber,
      sellerId: sid,
      items: items.map((l) => ({ gameName: l.game_name ?? 'Game', priceCents: l.price_cents })),
      shippingCents,
      terminalName,
    })),
    user.id
  );

  return NextResponse.json({ groupId: cartGroupId, orderIds: createdOrders.map((o) => o.id) });
}
