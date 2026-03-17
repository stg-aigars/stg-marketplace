import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { createPayment } from '@/lib/services/everypay/client';
import { calculateBuyerPricing } from '@/lib/services/pricing';
import { generateOrderNumber } from '@/lib/services/orders';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { createServiceClient } from '@/lib/supabase';
import { isValidPhoneNumber } from '@/lib/phone-utils';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  // 1. Authenticate
  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // 2. Parse body
  let listingId: string;
  let terminalId: string;
  let terminalName: string;
  let terminalCountry: string;
  let buyerPhone: string;
  try {
    const body = await request.json();
    listingId = body.listingId;
    terminalId = body.terminalId;
    terminalName = body.terminalName;
    terminalCountry = body.terminalCountry;
    buyerPhone = body.buyerPhone;

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }
    if (!terminalId || !terminalName || !terminalCountry) {
      return NextResponse.json({ error: 'Please select a pickup terminal' }, { status: 400 });
    }
    if (!buyerPhone || !isValidPhoneNumber(buyerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 3. Fetch listing
  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, price_cents, status, country')
    .eq('id', listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  if (listing.status !== 'active') {
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

  // 6. Calculate pricing
  const pricing = calculateBuyerPricing(listing.price_cents, shippingCents);

  // 7. Create checkout session
  const serviceClient = createServiceClient();
  const orderNumber = generateOrderNumber();

  const { data: session, error: sessionError } = await serviceClient
    .from('checkout_sessions')
    .insert({
      order_number: orderNumber,
      listing_id: listingId,
      buyer_id: user.id,
      terminal_id: terminalId,
      terminal_name: terminalName,
      terminal_country: terminalCountry,
      buyer_phone: buyerPhone,
      amount_cents: pricing.totalChargeCents,
      status: 'pending',
    })
    .select('id, order_number')
    .single();

  if (sessionError || !session) {
    console.error('[Payments] Failed to create checkout session:', sessionError);
    return NextResponse.json({ error: 'Failed to start checkout. Please try again.' }, { status: 500 });
  }

  // 8. Build callback URL
  const callbackUrl = `${env.app.url}/api/payments/callback`;

  // 9. Create EveryPay payment with order number as order reference
  try {
    const paymentResponse = await createPayment(
      pricing.totalChargeCents,
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
    return NextResponse.json(
      { error: 'Failed to initiate payment. Please try again.' },
      { status: 500 }
    );
  }
}
