/**
 * Full wallet payment route.
 * Used when the buyer's wallet balance covers the entire order total.
 * Bypasses EveryPay — reserves listing, debits wallet, creates order directly.
 *
 * Known edge case: If the process crashes between reservation and wallet debit,
 * the listing stays reserved with no order and no checkout session. The EveryPay
 * cleanup cron (/api/cron/cleanup-sessions) won't catch this since no session exists.
 * The cleanup cron should be extended to sweep stale reserved listings with no
 * corresponding order (reserved_at > 30 min ago AND no order AND no checkout session).
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { calculateBuyerPricing } from '@/lib/services/pricing';
import { createOrder } from '@/lib/services/orders';
import { debitWallet, getWalletBalance } from '@/lib/services/wallet';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { createServiceClient } from '@/lib/supabase';
import { isValidPhoneNumber } from '@/lib/phone-utils';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from '@/lib/email';
import { paymentLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateTerminalInput } from '@/lib/api/checkout-validation';
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
  let terminalCountry: string;
  let buyerPhone: string;
  let turnstileToken: string | undefined;
  try {
    const body = await request.json();
    listingId = body.listingId;
    terminalId = body.terminalId;
    terminalName = body.terminalName;
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
    if (!buyerPhone || !isValidPhoneNumber(buyerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
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
    .select('id, seller_id, price_cents, status, country, game_name, reserved_by')
    .eq('id', listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  const canCheckout = listing.status === 'active' ||
    (listing.status === 'reserved' && listing.reserved_by === user.id);

  if (!canCheckout) {
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

  // 1. Reserve listing atomically — prevents two buyers purchasing simultaneously
  const { data: reserved } = await serviceClient
    .from('listings')
    .update({
      status: 'reserved',
      reserved_at: new Date().toISOString(),
      reserved_by: user.id,
    })
    .eq('id', listingId)
    .or(`status.eq.active,and(status.eq.reserved,reserved_by.eq.${user.id})`)
    .select('id')
    .single();

  if (!reserved) {
    return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 });
  }

  // 2. Create order first (so we have a real order ID for wallet transaction FK)
  let order;
  try {
    order = await createOrder({
      buyerId: user.id,
      sellerId: listing.seller_id,
      listingId: listing.id,
      itemsTotalCents: listing.price_cents,
      shippingCostCents: shippingCents,
      sellerCountry: listing.country,
      paymentMethod: 'wallet',
      terminalId,
      terminalName,
      terminalCountry,
      buyerPhone,
      walletDebitCents: pricing.totalChargeCents,
    });
  } catch (orderError) {
    // Revert reservation
    await serviceClient
      .from('listings')
      .update({ status: 'active', reserved_at: null, reserved_by: null })
      .eq('id', listingId)
      .eq('reserved_by', user.id);

    console.error('[Payments] Wallet-pay order creation failed:', orderError);
    return NextResponse.json(
      { error: 'Failed to create order. Please try again.' },
      { status: 500 }
    );
  }

  // 3. Debit wallet using the real order ID
  try {
    await debitWallet(
      user.id,
      pricing.totalChargeCents,
      order.id,
      `Purchase: ${listing.game_name ?? 'Game'} — ${order.order_number}`
    );
  } catch (walletError) {
    // Wallet debit failed — delete the order and revert reservation
    await serviceClient.from('orders').delete().eq('id', order.id);
    await serviceClient
      .from('listings')
      .update({ status: 'active', reserved_at: null, reserved_by: null })
      .eq('id', listingId)
      .eq('reserved_by', user.id);

    const message = walletError instanceof Error ? walletError.message : 'Wallet payment failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Send emails (non-blocking)
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
