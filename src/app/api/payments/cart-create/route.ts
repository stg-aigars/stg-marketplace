import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createPayment } from '@/lib/services/everypay/client';
import { getWalletBalance } from '@/lib/services/wallet';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { createServiceClient } from '@/lib/supabase';
import { generateOrderNumber } from '@/lib/services/orders';
import { env } from '@/lib/env';
import { COUNTRY_TO_EVERYPAY_LOCALE } from '@/lib/constants';
import { paymentLimiter, applyRateLimit } from '@/lib/rate-limit';
import { parseCartCheckoutBody } from '@/lib/api/checkout-validation';
import { logAuditEvent } from '@/lib/services/audit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';

/**
 * POST /api/payments/cart-create
 * Creates a multi-item checkout: reserves all listings atomically,
 * creates a cart_checkout_group, and returns an EveryPay payment link.
 */
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

  const { listingIds, terminalId, terminalName, terminalAddress, terminalCity, terminalPostalCode, terminalCountry, buyerPhone, useWallet, turnstileToken } = parsed;

  const turnstile = await verifyTurnstileToken(turnstileToken, getClientIp(request));
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 403 });
  }

  const serviceClient = createServiceClient();

  // Fetch all listings
  const { data: listings } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, reserved_by')
    .in('id', listingIds);

  if (!listings || listings.length !== listingIds.length) {
    return NextResponse.json({ error: 'Some items are no longer available' }, { status: 400 });
  }

  // Verify all listings belong to same seller
  const sellerIds = new Set(listings.map(l => l.seller_id));
  if (sellerIds.size > 1) {
    return NextResponse.json({ error: 'All items must be from the same seller' }, { status: 400 });
  }

  // Validate all listings
  for (const listing of listings) {
    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot buy your own listing' }, { status: 400 });
    }
    const canCheckout = listing.status === 'active' ||
      (listing.status === 'reserved' && listing.reserved_by === user.id);
    if (!canCheckout) {
      return NextResponse.json({ error: `"${listing.id}" is no longer available` }, { status: 400 });
    }
  }

  // Get buyer profile for country
  const { data: buyerProfile } = await supabase
    .from('user_profiles')
    .select('country')
    .eq('id', user.id)
    .single();

  if (!buyerProfile?.country) {
    return NextResponse.json({ error: 'Please set your country in your profile first' }, { status: 400 });
  }

  // Calculate totals — single-seller guard above guarantees one seller
  const itemsTotalCents = listings.reduce((sum, l) => sum + l.price_cents, 0);
  const sellerCountry = listings[0].country as TerminalCountry;
  const shippingTotalCents = getShippingPriceCents(sellerCountry, buyerProfile.country as TerminalCountry);
  if (shippingTotalCents === null) {
    return NextResponse.json({ error: 'Shipping is not available for this route' }, { status: 400 });
  }

  const grandTotalCents = itemsTotalCents + shippingTotalCents;

  // Wallet calculation
  let walletDebitCents = 0;
  let everypayChargeCents = grandTotalCents;

  if (useWallet) {
    const walletBalance = await getWalletBalance(user.id);
    if (walletBalance > 0) {
      walletDebitCents = Math.min(walletBalance, grandTotalCents);
      everypayChargeCents = grandTotalCents - walletDebitCents;
    }
  }

  if (everypayChargeCents <= 0) {
    return NextResponse.json(
      { error: 'Wallet covers the full amount. Use wallet payment instead.', walletCoversTotal: true },
      { status: 400 }
    );
  }

  // Pro-rata wallet allocation per listing
  const walletAllocation: Record<string, number> = {};
  if (walletDebitCents > 0) {
    // Compute each listing's share of the total
    // Shipping is assigned to the first listing (single seller)
    let allocated = 0;
    const listingTotals: { id: string; total: number }[] = [];

    for (let j = 0; j < listings.length; j++) {
      const listing = listings[j];
      const shipping = j === 0 ? shippingTotalCents : 0;
      listingTotals.push({ id: listing.id, total: listing.price_cents + shipping });
    }

    // Sort by total descending (largest gets rounding remainder)
    listingTotals.sort((a, b) => b.total - a.total);

    for (let i = 0; i < listingTotals.length; i++) {
      const { id, total } = listingTotals[i];
      if (i === 0) {
        // Last to allocate — gets rounding remainder
        continue;
      }
      const share = Math.floor(walletDebitCents * total / grandTotalCents);
      walletAllocation[id] = share;
      allocated += share;
    }
    // Assign remainder to the largest order
    walletAllocation[listingTotals[0].id] = walletDebitCents - allocated;
  }

  // Create checkout group
  const orderNumber = generateOrderNumber();
  const callbackToken = crypto.randomUUID();

  const { data: group, error: groupError } = await serviceClient
    .from('cart_checkout_groups')
    .insert({
      order_number: orderNumber,
      callback_token: callbackToken,
      buyer_id: user.id,
      terminal_id: terminalId,
      terminal_name: terminalName,
      terminal_address: terminalAddress,
      terminal_city: terminalCity,
      terminal_postal_code: terminalPostalCode,
      terminal_country: terminalCountry,
      buyer_phone: buyerPhone,
      total_amount_cents: grandTotalCents,
      wallet_debit_cents: walletDebitCents,
      wallet_allocation: walletAllocation,
      listing_ids: listingIds,
      status: 'pending',
    })
    .select('id')
    .single();

  if (groupError || !group) {
    console.error('[Cart] Failed to create checkout group:', groupError);
    return NextResponse.json({ error: 'Failed to start checkout. Please try again.' }, { status: 500 });
  }

  // Reserve all listings atomically via RPC
  const { data: failedIds, error: rpcError } = await serviceClient
    .rpc('reserve_listings_atomic', {
      p_listing_ids: listingIds,
      p_buyer_id: user.id,
    });

  if (rpcError) {
    console.error('[Cart] Reservation RPC failed:', rpcError);
    await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);
    return NextResponse.json({ error: 'Failed to reserve items. Please try again.' }, { status: 500 });
  }

  if (failedIds && failedIds.length > 0) {
    // Some items couldn't be reserved — clean up and report
    await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);
    return NextResponse.json({ error: 'Some items are no longer available', unavailable: failedIds }, { status: 400 });
  }

  // Create EveryPay payment
  const callbackUrl = `${env.app.url}/api/payments/callback?token=${callbackToken}`;

  try {
    const paymentResponse = await createPayment(
      everypayChargeCents,
      orderNumber,
      callbackUrl,
      {
        locale: COUNTRY_TO_EVERYPAY_LOCALE[buyerProfile.country] ?? 'en',
        email: user.email,
        customerIp: request.headers.get('x-forwarded-for') || undefined,
      }
    );

    // Store payment reference for reconciliation cron
    void serviceClient
      .from('cart_checkout_groups')
      .update({ everypay_payment_reference: paymentResponse.payment_reference })
      .eq('id', group.id)
      .then(({ error }) => {
        if (error) console.error('[Payments] CRITICAL: Failed to store cart payment reference:', error);
      });

    void logAuditEvent({
      actorId: user.id,
      actorType: 'user',
      action: 'payment.cart_created',
      resourceType: 'cart_checkout_group',
      resourceId: group.id,
      metadata: {
        listingCount: listingIds.length,
        totalAmountCents: grandTotalCents,
        walletDebitCents,
        orderNumber,
      },
    });

    return NextResponse.json({ paymentLink: paymentResponse.payment_link });
  } catch (error) {
    console.error('[Cart] Failed to create payment:', error);

    // Unreserve all listings and expire the group
    await serviceClient.rpc('unreserve_listings', {
      p_listing_ids: listingIds,
      p_buyer_id: user.id,
    });
    await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);

    return NextResponse.json({ error: 'Failed to initiate payment. Please try again.' }, { status: 500 });
  }
}
