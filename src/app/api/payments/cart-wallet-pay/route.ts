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
import { isValidPhoneNumber } from '@/lib/phone-utils';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from '@/lib/email';
import { paymentLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateTerminalInput } from '@/lib/api/checkout-validation';
import { logAuditEvent } from '@/lib/services/audit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';
import { MAX_CART_ITEMS } from '@/lib/checkout/cart-types';

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(paymentLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // Parse body
  let listingIds: string[];
  let terminalId: string;
  let terminalName: string;
  let terminalCountry: string;
  let buyerPhone: string;
  let turnstileToken: string | undefined;
  try {
    const body = await request.json();
    listingIds = body.listingIds;
    terminalId = body.terminalId;
    terminalName = body.terminalName;
    terminalCountry = body.terminalCountry;
    buyerPhone = body.buyerPhone;
    turnstileToken = body.turnstileToken;

    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'No items in cart' }, { status: 400 });
    }
    if (listingIds.length > MAX_CART_ITEMS) {
      return NextResponse.json({ error: `Maximum ${MAX_CART_ITEMS} items per cart` }, { status: 400 });
    }
    if (!terminalId || !terminalName || !terminalCountry) {
      return NextResponse.json({ error: 'Please select a pickup terminal' }, { status: 400 });
    }
    const terminalCheck = validateTerminalInput({ terminalId, terminalName, terminalCountry });
    if (terminalCheck instanceof NextResponse) return terminalCheck;
    terminalName = terminalCheck.sanitizedName;
    if (!buyerPhone || !isValidPhoneNumber(buyerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

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
    if (listing.status !== 'active') {
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

  // Create orders and debit wallet
  const createdOrderIds: string[] = [];
  const firstForSeller = new Set<string>();

  try {
    for (const listing of listings) {
      const isFirstForSeller = !firstForSeller.has(listing.seller_id);
      firstForSeller.add(listing.seller_id);
      const shippingCents = isFirstForSeller ? (sellerShipping.get(listing.seller_id) ?? 0) : 0;

      // Pro-rata wallet debit for this listing
      const listingTotal = listing.price_cents + shippingCents;
      const walletForOrder = Math.floor(grandTotalCents > 0 ? grandTotalCents * listingTotal / grandTotalCents : 0);

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

      createdOrderIds.push(order.id);

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
      orderCount: createdOrderIds.length,
      totalAmountCents: grandTotalCents,
      paymentMethod: 'wallet',
    },
  });

  // Send emails (non-blocking)
  void sendCartOrderEmails(serviceClient, createdOrderIds, user.id);

  return NextResponse.json({ groupId: cartGroupId, orderIds: createdOrderIds });
}

interface ProfileInfo {
  id: string;
  full_name: string | null;
  email: string | null;
}

async function sendCartOrderEmails(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: any,
  orderIds: string[],
  buyerId: string
) {
  try {
    const { data: orders } = await serviceClient
      .from('orders')
      .select('id, order_number, listing_id, seller_id, items_total_cents, shipping_cost_cents, terminal_name, listings(game_name)')
      .in('id', orderIds);

    if (!orders) return;

    const userIds = Array.from(new Set([buyerId, ...orders.map((o: { seller_id: string }) => o.seller_id)]));
    const { data: profiles } = await serviceClient
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (!profiles) return;

    const profileMap = new Map<string, ProfileInfo>(
      (profiles as ProfileInfo[]).map((p) => [p.id, p])
    );
    const buyerProfile = profileMap.get(buyerId);

    for (const order of orders) {
      const sellerProfile = profileMap.get(order.seller_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gameName = (order.listings as any)?.game_name ?? 'Game';

      const emailData = {
        orderNumber: order.order_number,
        orderId: order.id,
        gameName,
        priceCents: order.items_total_cents,
        shippingCents: order.shipping_cost_cents,
        terminalName: order.terminal_name,
      };

      if (sellerProfile?.email) {
        sendNewOrderToSeller({
          ...emailData,
          sellerName: sellerProfile.full_name ?? 'Seller',
          sellerEmail: sellerProfile.email,
          buyerName: buyerProfile?.full_name ?? 'Buyer',
        }).catch((err: unknown) => console.error('[Email] Cart order seller notification failed:', err));
      }

      if (buyerProfile?.email) {
        sendOrderConfirmationToBuyer({
          ...emailData,
          buyerName: buyerProfile.full_name ?? 'Buyer',
          buyerEmail: buyerProfile.email,
          sellerName: sellerProfile?.full_name ?? 'Seller',
        }).catch((err: unknown) => console.error('[Email] Cart order buyer confirmation failed:', err));
      }
    }
  } catch (err) {
    console.error('[Email] Cart order emails failed:', err);
  }
}
