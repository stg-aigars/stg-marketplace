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
import { formatGameWithExpansions } from '@/lib/orders/utils';
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

  const { listingIds, terminalId, terminalName, terminalAddress, terminalCity, terminalPostalCode, terminalCountry, buyerPhone, turnstileToken } = parsed;

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

  // Verify all listings belong to same seller
  const sellerIds = new Set(listings.map(l => l.seller_id));
  if (sellerIds.size > 1) {
    return NextResponse.json({ error: 'All items must be from the same seller' }, { status: 400 });
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

  // Fetch expansion counts for all listings (for email enrichment)
  const { data: expansionRows } = await serviceClient
    .from('listing_expansions')
    .select('listing_id, game_name')
    .in('listing_id', listingIds);

  const expansionsByListing = new Map<string, Array<{ game_name: string }>>();
  for (const row of expansionRows ?? []) {
    const arr = expansionsByListing.get(row.listing_id) ?? [];
    arr.push({ game_name: row.game_name });
    expansionsByListing.set(row.listing_id, arr);
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

  // Calculate totals — single-seller guard above guarantees one seller
  const sellerId = listings[0].seller_id;
  const sellerCountry = listings[0].country;
  const itemsTotalCents = listings.reduce((sum, l) => sum + l.price_cents, 0);
  const shippingTotalCents = getShippingPriceCents(
    sellerCountry as TerminalCountry,
    buyerProfile.country as TerminalCountry
  );
  if (shippingTotalCents === null) {
    return NextResponse.json({ error: 'Shipping is not available for this route' }, { status: 400 });
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

  if (rpcError) {
    console.error('[Cart Wallet] Reservation RPC failed:', rpcError);
    return NextResponse.json({ error: 'Failed to reserve items. Please try again.' }, { status: 500 });
  }

  if (failedIds && failedIds.length > 0) {
    return NextResponse.json({ error: 'Some items are no longer available', unavailable: failedIds }, { status: 400 });
  }

  // Create a cart checkout group for record-keeping
  const cartGroupId = crypto.randomUUID();

  // Create single order (single-seller guard ensures one seller)
  let createdOrder: { id: string; orderNumber: string };

  // Step 1: Create order
  try {
    const order = await createOrder({
      buyerId: user.id,
      sellerId,
      items: listings.map((l) => ({ listingId: l.id, priceCents: l.price_cents })),
      shippingCostCents: shippingTotalCents,
      sellerCountry,
      paymentMethod: 'wallet',
      walletDebitCents: grandTotalCents,
      terminalId,
      terminalName,
      terminalAddress,
      terminalCity,
      terminalPostalCode,
      terminalCountry,
      buyerPhone,
      cartGroupId,
    });

    createdOrder = { id: order.id, orderNumber: order.order_number };
  } catch (error) {
    console.error('[Cart Wallet] Order creation failed:', error);
    await serviceClient.rpc('unreserve_listings', {
      p_listing_ids: listingIds,
      p_buyer_id: user.id,
    });
    return NextResponse.json({ error: 'Failed to create order. Please try again.' }, { status: 500 });
  }

  // Step 2: Debit wallet
  try {
    const gameNames = listings.map((l) => formatGameWithExpansions(l.game_name ?? 'Game', expansionsByListing.get(l.id) ?? [])).join(', ');
    await debitWallet(
      user.id,
      grandTotalCents,
      createdOrder.id,
      `Purchase: ${gameNames} — ${createdOrder.orderNumber}`
    );
  } catch (walletError) {
    console.error('[Cart Wallet] Wallet debit failed:', walletError);
    // Delete the unpaid order and unreserve listings
    try {
      await serviceClient.from('orders').delete().eq('id', createdOrder.id);
      await serviceClient.rpc('unreserve_listings', {
        p_listing_ids: listingIds,
        p_buyer_id: user.id,
      });
    } catch (rollbackErr) {
      console.error('[Cart Wallet] Rollback failed:', rollbackErr);
    }
    const message = walletError instanceof Error ? walletError.message : 'Wallet payment failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  void logAuditEvent({
    actorId: user.id,
    actorType: 'user',
    action: 'payment.cart_wallet_completed',
    resourceType: 'cart_group',
    resourceId: cartGroupId,
    metadata: {
      orderCount: 1,
      totalItemCount: listings.length,
      totalAmountCents: grandTotalCents,
      paymentMethod: 'wallet',
    },
  });

  // Send emails (non-blocking)
  void sendCartOrderEmails(
    [{
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      sellerId,
      items: listings.map((l) => ({
        gameName: formatGameWithExpansions(l.game_name ?? 'Game', expansionsByListing.get(l.id) ?? []),
        priceCents: l.price_cents,
      })),
      shippingCents: shippingTotalCents,
      terminalName,
    }],
    user.id
  );

  return NextResponse.json({ groupId: cartGroupId, orderIds: [createdOrder.id] });
}
