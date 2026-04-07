import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createPayment } from '@/lib/services/everypay/client';
import { calculateBuyerPricing, calculateCheckoutPricing } from '@/lib/services/pricing';
import { generateOrderNumber } from '@/lib/services/orders';
import { getWalletBalance } from '@/lib/services/wallet';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { createServiceClient } from '@/lib/supabase';
import { isBalticPhoneNumber } from '@/lib/phone-utils';
import { env } from '@/lib/env';
import { COUNTRY_TO_EVERYPAY_LOCALE } from '@/lib/constants';
import { paymentLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateTerminalInput, sanitizeInput } from '@/lib/api/checkout-validation';
import { logAuditEvent } from '@/lib/services/audit';
import { verifyTurnstileToken, getClientIp } from '@/lib/turnstile';

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(paymentLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  // 1. Authenticate
  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // 2. Parse body
  let listingId: string;
  let terminalId: string;
  let terminalName: string;
  let terminalAddress: string | undefined;
  let terminalCity: string | undefined;
  let terminalPostalCode: string | undefined;
  let terminalCountry: string;
  let buyerPhone: string;
  let useWallet = false;
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
    useWallet = body.useWallet === true;
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

  // 2b. Verify Turnstile token
  const turnstile = await verifyTurnstileToken(turnstileToken, getClientIp(request));
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 403 });
  }

  // 3. Fetch listing (use service client to bypass RLS for auction_ended status)
  const serviceClient = createServiceClient();
  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, listing_type, highest_bidder_id')
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
      terminal_address: terminalAddress,
      terminal_city: terminalCity,
      terminal_postal_code: terminalPostalCode,
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

  // 8. Build callback URL with callback token for security
  const callbackUrl = `${env.app.url}/api/payments/callback?token=${session.callback_token}`;

  // 9. Create EveryPay payment with order number as order reference
  try {
    const paymentResponse = await createPayment(
      everypayChargeCents,
      session.order_number,
      callbackUrl,
      {
        locale: COUNTRY_TO_EVERYPAY_LOCALE[buyerCountryCode] ?? 'en',
        email: user.email,
        customerIp: request.headers.get('x-forwarded-for') || undefined,
      }
    );

    // Store payment reference for reconciliation cron.
    // Narrow crash window: if the app dies between createPayment() and this update,
    // the payment is initiated but invisible to reconciliation. Acceptable at current scale.
    void serviceClient
      .from('checkout_sessions')
      .update({ everypay_payment_reference: paymentResponse.payment_reference })
      .eq('id', session.id)
      .then(({ error }) => {
        if (error) console.error('[Payments] CRITICAL: Failed to store payment reference:', error);
      });

    void logAuditEvent({
      actorId: user.id,
      actorType: 'user',
      action: 'payment.created',
      resourceType: 'checkout_session',
      resourceId: session.id,
      metadata: { listingId, amountCents: buyerPricing.totalChargeCents, walletDebitCents, orderNumber },
    });

    return NextResponse.json({
      paymentLink: paymentResponse.payment_link,
    });
  } catch (error) {
    console.error('[Payments] Failed to create payment:', error);

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
