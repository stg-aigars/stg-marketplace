/**
 * Full wallet payment route (auction-only).
 * Used when the auction winner's wallet balance covers the entire order total.
 * Bypasses EveryPay — debits wallet, creates order directly.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { calculateBuyerPricing } from '@/lib/services/pricing';
import { createOrder } from '@/lib/services/orders';
import { debitWallet, getWalletBalance } from '@/lib/services/wallet';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { createServiceClient } from '@/lib/supabase';
import { isBalticPhoneNumber } from '@/lib/phone-utils';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from '@/lib/email';
import { paymentLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateTerminalInput, sanitizeInput } from '@/lib/api/checkout-validation';
import { logAuditEvent } from '@/lib/services/audit';
import { notify } from '@/lib/notifications';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(paymentLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // Parse body
  let listingId: string;
  let terminalId: string;
  let terminalName: string;
  let terminalAddress: string | undefined;
  let terminalCity: string | undefined;
  let terminalPostalCode: string | undefined;
  let terminalCountry: string;
  let buyerPhone: string;
  let turnstileToken: string | undefined;
  try {
    const body = await request.json();
    listingId = body.listingId;
    terminalId = body.terminalId;
    terminalName = body.terminalName;
    terminalAddress = body.terminalAddress;
    terminalCity = body.terminalCity;
    terminalPostalCode = body.terminalPostalCode;
    terminalCountry = body.terminalCountry;
    buyerPhone = body.buyerPhone;
    turnstileToken = body.turnstileToken;

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }
    if (!terminalId || !terminalName || !terminalCountry) {
      return NextResponse.json({ error: 'Please select a pickup terminal' }, { status: 400 });
    }
    const terminalCheck = validateTerminalInput({ terminalId, terminalName, terminalCountry });
    if (terminalCheck instanceof NextResponse) return terminalCheck;
    terminalName = terminalCheck.sanitizedName;
    terminalAddress = sanitizeInput(terminalAddress);
    terminalCity = sanitizeInput(terminalCity);
    terminalPostalCode = sanitizeInput(terminalPostalCode);
    if (!buyerPhone || !isBalticPhoneNumber(buyerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid Baltic phone number' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Verify Turnstile token
  const turnstile = await verifyTurnstileToken(turnstileToken, getClientIp(request));
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 403 });
  }

  // Fetch listing
  const serviceClient = createServiceClient();
  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, game_name, listing_type, highest_bidder_id')
    .eq('id', listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Only auction winners can reach this route (checkout page guard)
  const isAuctionWinner = listing.listing_type === 'auction' &&
    listing.status === 'auction_ended' &&
    listing.highest_bidder_id === user.id;

  if (!isAuctionWinner) {
    return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 });
  }

  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: 'You cannot buy your own listing' }, { status: 400 });
  }

  // Get buyer profile for country
  const { data: buyerProfile } = await supabase
    .from('user_profiles')
    .select('country, full_name, email')
    .eq('id', user.id)
    .single();

  if (!buyerProfile?.country) {
    return NextResponse.json({ error: 'Please set your country in your profile first' }, { status: 400 });
  }

  // Calculate pricing
  const sellerCountry = listing.country as TerminalCountry;
  const buyerCountryCode = buyerProfile.country as TerminalCountry;
  const shippingCents = getShippingPriceCents(sellerCountry, buyerCountryCode);

  if (shippingCents === null) {
    return NextResponse.json({ error: 'Shipping is not available for this route' }, { status: 400 });
  }

  const pricing = calculateBuyerPricing(listing.price_cents, shippingCents);

  // Verify wallet covers the full amount
  const walletBalance = await getWalletBalance(user.id);
  if (walletBalance < pricing.totalChargeCents) {
    return NextResponse.json(
      { error: 'Insufficient wallet balance for full wallet payment' },
      { status: 400 }
    );
  }

  // 1. Create order (auction_ended status already prevents double-purchase)
  let order;
  try {
    order = await createOrder({
      buyerId: user.id,
      sellerId: listing.seller_id,
      items: [{ listingId: listing.id, priceCents: listing.price_cents }],
      shippingCostCents: shippingCents,
      sellerCountry: listing.country,
      paymentMethod: 'wallet',
      terminalId,
      terminalName,
      terminalAddress,
      terminalCity,
      terminalPostalCode,
      terminalCountry,
      buyerPhone,
      walletDebitCents: pricing.totalChargeCents,
    });
  } catch (orderError) {
    console.error('[Payments] Wallet-pay order creation failed:', orderError);
    return NextResponse.json(
      { error: 'Failed to create order. Please try again.' },
      { status: 500 }
    );
  }

  // 2. Debit wallet using the real order ID
  try {
    await debitWallet(
      user.id,
      pricing.totalChargeCents,
      order.id,
      `Purchase: ${listing.game_name ?? 'Game'} — ${order.order_number}`
    );
  } catch (walletError) {
    // Wallet debit failed — delete the order
    await serviceClient.from('orders').delete().eq('id', order.id);

    const message = walletError instanceof Error ? walletError.message : 'Wallet payment failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Send emails (non-blocking)
  void (async () => {
    const { data: sellerProfile } = await serviceClient
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', listing.seller_id)
      .single();

    if (!sellerProfile?.email || !buyerProfile.email) return;

    const emailData = {
      orderNumber: order.order_number,
      orderId: order.id,
      gameName: listing.game_name ?? 'Game',
      priceCents: listing.price_cents,
      shippingCents,
      terminalName,
    };

    sendNewOrderToSeller({
      ...emailData,
      sellerName: sellerProfile.full_name ?? 'Seller',
      sellerEmail: sellerProfile.email,
      buyerName: buyerProfile.full_name ?? 'Buyer',
    }).catch((err) => console.error('[Email] Failed to notify seller:', err));

    void notify(listing.seller_id, 'order.created', {
      gameName: emailData.gameName,
      orderNumber: emailData.orderNumber,
      orderId: emailData.orderId,
      buyerName: buyerProfile.full_name ?? 'Buyer',
      role: 'seller',
    });

    sendOrderConfirmationToBuyer({
      ...emailData,
      buyerName: buyerProfile.full_name ?? 'Buyer',
      buyerEmail: buyerProfile.email,
      sellerName: sellerProfile.full_name ?? 'Seller',
    }).catch((err) => console.error('[Email] Failed to confirm buyer:', err));

    void notify(user.id, 'order.created', {
      gameName: emailData.gameName,
      orderNumber: emailData.orderNumber,
      orderId: emailData.orderId,
      sellerName: sellerProfile.full_name ?? 'Seller',
      role: 'buyer',
    });
  })().catch((err) => console.error('[Email] Background email failed:', err));

  void logAuditEvent({
    actorId: user.id,
    actorType: 'user',
    action: 'payment.completed',
    resourceType: 'order',
    resourceId: order.id,
    metadata: {
      orderNumber: order.order_number,
      listingId,
      amountCents: pricing.totalChargeCents,
      walletDebitCents: pricing.totalChargeCents,
      paymentMethod: 'wallet',
    },
  });

  return NextResponse.json({ orderId: order.id });
}
