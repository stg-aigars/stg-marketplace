import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createPayment } from '@/lib/services/everypay/client';
import { calculateBuyerPricing, calculateCheckoutPricing } from '@/lib/services/pricing';
import { generateOrderNumber } from '@/lib/services/orders';
import { getWalletBalance } from '@/lib/services/wallet';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { createServiceClient } from '@/lib/supabase';
import { isValidPhoneNumber } from '@/lib/phone-utils';
import { env } from '@/lib/env';
import { paymentLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const limit = paymentLimiter.check(ip);
  if (!limit.success) return rateLimitResponse(limit.resetTime);

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  // 1. Authenticate
  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // 2. Parse body
  let listingId: string;
  let terminalId: string;
  let terminalName: string;
  let terminalCountry: string;
  let buyerPhone: string;
  let useWallet = false;
  try {
    const body = await request.json();
    listingId = body.listingId;
    terminalId = body.terminalId;
    terminalName = body.terminalName;
    terminalCountry = body.terminalCountry;
    buyerPhone = body.buyerPhone;
    useWallet = body.useWallet === true;

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }
    if (!terminalId || !terminalName || !terminalCountry) {
      return NextResponse.json({ error: 'Please select a pickup terminal' }, { status: 400 });
    }
    const validCountries = ['LV', 'LT', 'EE'];
    if (!validCountries.includes(terminalCountry)) {
      return NextResponse.json({ error: 'Invalid terminal country' }, { status: 400 });
    }
    if (terminalId.length > 50) {
      return NextResponse.json({ error: 'Invalid terminal ID' }, { status: 400 });
    }
    // Cap terminal name length and strip control characters
    terminalName = terminalName.slice(0, 200).replace(/[\x00-\x1f\x7f]/g, '');
    if (!buyerPhone || !isValidPhoneNumber(buyerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 3. Fetch listing (use service client to read reserved listings — RLS only
  // exposes active listings + seller's own, so a buyer can't read their own reserved listing)
  const serviceClient = createServiceClient();
  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, reserved_by')
    .eq('id', listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Allow 'active' or 'reserved' by the same buyer (retry/back-button case)
  const canCheckout = listing.status === 'active' ||
    (listing.status === 'reserved' && listing.reserved_by === user.id);

  if (!canCheckout) {
    return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 });
  }

  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: 'You cannot buy your own listing' }, { status: 400 });
  }

  // 4. Get buyer profile for country
  const { data: buyerProfile } = await supabase
    .from('user_profiles')
    .select('country')
    .eq('id', user.id)
    .single();

  if (!buyerProfile?.country) {
    return NextResponse.json({ error: 'Please set your country in your profile first' }, { status: 400 });
  }

  // 5. Calculate shipping
  const sellerCountry = listing.country as TerminalCountry;
  const buyerCountryCode = buyerProfile.country as TerminalCountry;
  const shippingCents = getShippingPriceCents(sellerCountry, buyerCountryCode);

  if (shippingCents === null) {
    return NextResponse.json({ error: 'Shipping is not available for this route' }, { status: 400 });
  }

  // 6. Calculate pricing (with wallet if requested)
  const buyerPricing = calculateBuyerPricing(listing.price_cents, shippingCents);
  let walletDebitCents = 0;
  let everypayChargeCents = buyerPricing.totalChargeCents;

  if (useWallet) {
    const walletBalance = await getWalletBalance(user.id);
    if (walletBalance > 0) {
      const checkoutPricing = calculateCheckoutPricing(listing.price_cents, shippingCents, walletBalance);
      walletDebitCents = checkoutPricing.walletDebitCents;
      everypayChargeCents = checkoutPricing.everypayChargeCents;
    }
  }

  // If wallet covers the full amount, this route should not be used — use /api/payments/wallet-pay instead
  if (everypayChargeCents <= 0) {
    return NextResponse.json(
      { error: 'Wallet covers the full amount. Use wallet payment instead.', walletCoversTotal: true },
      { status: 400 }
    );
  }

  // 7. Create checkout session
  const orderNumber = generateOrderNumber();
  const callbackToken = crypto.randomUUID();

  const { data: session, error: sessionError } = await serviceClient
    .from('checkout_sessions')
    .insert({
      order_number: orderNumber,
      callback_token: callbackToken,
      listing_id: listingId,
      buyer_id: user.id,
      terminal_id: terminalId,
      terminal_name: terminalName,
      terminal_country: terminalCountry,
      buyer_phone: buyerPhone,
      amount_cents: buyerPricing.totalChargeCents,
      wallet_debit_cents: walletDebitCents,
      status: 'pending',
    })
    .select('id, order_number, callback_token')
    .single();

  if (sessionError || !session) {
    console.error('[Payments] Failed to create checkout session:', sessionError);
    return NextResponse.json({ error: 'Failed to start checkout. Please try again.' }, { status: 500 });
  }

  // 8. Reserve the listing (before payment, not after)
  // Accept 'active' OR already reserved by same buyer (retry/back-button refreshes the timer)
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
    // Race condition: another buyer reserved it between our check and this update
    await serviceClient
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id);
    return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 });
  }

  // 9. Build callback URL with callback token for security
  const callbackUrl = `${env.app.url}/api/payments/callback?token=${session.callback_token}`;

  // 10. Create EveryPay payment with order number as order reference
  try {
    const paymentResponse = await createPayment(
      everypayChargeCents,
      session.order_number,
      callbackUrl,
      {
        email: user.email,
        customerIp: request.headers.get('x-forwarded-for') || undefined,
      }
    );

    return NextResponse.json({
      paymentLink: paymentResponse.payment_link,
    });
  } catch (error) {
    console.error('[Payments] Failed to create payment:', error);

    // Revert the reservation so the listing isn't locked for 30 min
    await serviceClient
      .from('listings')
      .update({ status: 'active', reserved_at: null, reserved_by: null })
      .eq('id', listingId)
      .eq('status', 'reserved');

    await serviceClient
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id);

    return NextResponse.json(
      { error: 'Failed to initiate payment. Please try again.' },
      { status: 500 }
    );
  }
}
