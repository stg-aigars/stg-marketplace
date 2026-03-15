import { NextResponse } from 'next/server';
import { getPaymentStatus, SUCCESSFUL_STATES } from '@/lib/services/everypay';
import { classifyPaymentError } from '@/lib/services/everypay/classify-error';
import { createServiceClient } from '@/lib/supabase';
import { createOrder } from '@/lib/services/orders';
import { getShippingPrice, type TerminalCountry } from '@/lib/services/unisend/types';
import { env } from '@/lib/env';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentReference = searchParams.get('payment_reference');
  const orderReference = searchParams.get('order_reference');

  if (!paymentReference || !orderReference) {
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  // Decode order reference
  let listingId: string;
  let buyerId: string;
  try {
    const decoded = Buffer.from(orderReference, 'base64').toString('utf-8');
    [listingId, buyerId] = decoded.split(':');
    if (!listingId || !buyerId) throw new Error('Invalid format');
  } catch {
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  const serviceClient = createServiceClient();

  // Idempotency: check if order already exists for this payment reference
  const { data: existingOrder } = await serviceClient
    .from('orders')
    .select('id')
    .eq('everypay_payment_reference', paymentReference)
    .single();

  if (existingOrder) {
    return NextResponse.redirect(`${env.app.url}/orders/${existingOrder.id}`);
  }

  // Verify payment with EveryPay
  let paymentStatus;
  try {
    paymentStatus = await getPaymentStatus(paymentReference);
  } catch (error) {
    console.error('[Payments] Failed to verify payment:', error);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${listingId}?error=verification_failed`
    );
  }

  // Check if payment succeeded
  if (!SUCCESSFUL_STATES.has(paymentStatus.payment_state)) {
    const errorCategory = classifyPaymentError(
      paymentStatus.payment_state,
      paymentStatus.error
    );
    return NextResponse.redirect(
      `${env.app.url}/checkout/${listingId}?error=${errorCategory}`
    );
  }

  // Re-fetch listing to get current data
  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country')
    .eq('id', listingId)
    .single();

  if (!listing || listing.status !== 'active') {
    // Payment succeeded but listing no longer available — will need manual refund
    console.error(`[Payments] Payment ${paymentReference} succeeded but listing ${listingId} is no longer available`);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${listingId}?error=listing_unavailable`
    );
  }

  // Get buyer and seller countries for shipping calculation
  const { data: buyerProfile } = await serviceClient
    .from('user_profiles')
    .select('country')
    .eq('id', buyerId)
    .single();

  const sellerCountry = listing.country as TerminalCountry;
  const buyerCountry = (buyerProfile?.country ?? sellerCountry) as TerminalCountry;
  const shippingEur = getShippingPrice(sellerCountry, buyerCountry);
  const shippingCents = shippingEur !== null ? Math.round(shippingEur * 100) : 0;

  // Create the order
  try {
    const order = await createOrder({
      buyerId,
      sellerId: listing.seller_id,
      listingId: listing.id,
      itemsTotalCents: listing.price_cents,
      shippingCostCents: shippingCents,
      sellerCountry: listing.country,
      paymentReference,
      paymentState: paymentStatus.payment_state,
      paymentMethod: 'card',
    });

    return NextResponse.redirect(`${env.app.url}/orders/${order.id}`);
  } catch (error) {
    console.error('[Payments] Failed to create order:', error);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${listingId}?error=order_creation_failed`
    );
  }
}
