/**
 * Payment callback handler (EveryPay redirect).
 *
 * IMPORTANT: This is the ONLY mechanism that creates orders after payment.
 * If the browser redirect fails (user closes browser, network drops), the
 * payment is captured by EveryPay but NO order is created in STG.
 *
 * TODO (Week 2/5): Add a server-to-server webhook handler and/or a cron job
 * to reconcile pending checkout_sessions against EveryPay payment statuses.
 * This would catch paid-but-no-order cases and auto-create the missing orders.
 * See: EveryPay API docs for payment notifications / webhooks.
 */

import { NextResponse } from 'next/server';
import { getPaymentStatus, SUCCESSFUL_STATES } from '@/lib/services/everypay';
import { classifyPaymentError } from '@/lib/services/everypay/classify-error';
import { createServiceClient } from '@/lib/supabase';
import { createOrder } from '@/lib/services/orders';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from '@/lib/email';
import { env } from '@/lib/env';
import type { CheckoutSession } from '@/lib/checkout/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentReference = searchParams.get('payment_reference');
  const orderReference = searchParams.get('order_reference');

  if (!paymentReference || !orderReference) {
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

  // Look up checkout session by UUID (order_reference = session ID)
  const { data: session, error: sessionError } = await serviceClient
    .from('checkout_sessions')
    .select('*')
    .eq('order_number', orderReference)
    .single<CheckoutSession>();

  if (sessionError || !session) {
    console.error('[Payments] Checkout session not found:', orderReference);
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  if (session.status === 'completed') {
    // Session already processed — find the order
    const { data: orderForSession } = await serviceClient
      .from('orders')
      .select('id')
      .eq('order_number', session.order_number)
      .single();

    if (orderForSession) {
      return NextResponse.redirect(`${env.app.url}/orders/${orderForSession.id}`);
    }
  }

  // Check if session has expired (30 minutes)
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const sessionAge = Date.now() - new Date(session.created_at).getTime();
  if (sessionAge > SESSION_TTL_MS && session.status === 'pending') {
    await serviceClient
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
      .eq('status', 'pending');

    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=session_expired`
    );
  }

  // Verify payment with EveryPay
  let paymentStatus;
  try {
    paymentStatus = await getPaymentStatus(paymentReference);
  } catch (error) {
    console.error('[Payments] Failed to verify payment:', error);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=verification_failed`
    );
  }

  // Check if payment succeeded
  if (!SUCCESSFUL_STATES.has(paymentStatus.payment_state)) {
    const errorCategory = classifyPaymentError(
      paymentStatus.payment_state,
      paymentStatus.error
    );
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=${errorCategory}`
    );
  }

  // Re-fetch listing to get current data (include game_name for emails)
  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, game_name')
    .eq('id', session.listing_id)
    .single();

  if (!listing || listing.status !== 'active') {
    console.error(`[Payments] Payment ${paymentReference} succeeded but listing ${session.listing_id} is no longer available`);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=listing_unavailable`
    );
  }

  // Calculate shipping from seller/buyer countries
  const sellerCountry = listing.country as TerminalCountry;
  const buyerCountry = session.terminal_country as TerminalCountry;
  const shippingCents = getShippingPriceCents(sellerCountry, buyerCountry) ?? 0;

  // Create the order with terminal and phone data from session
  try {
    const order = await createOrder({
      buyerId: session.buyer_id,
      sellerId: listing.seller_id,
      listingId: listing.id,
      itemsTotalCents: listing.price_cents,
      shippingCostCents: shippingCents,
      sellerCountry: listing.country,
      paymentReference,
      paymentState: paymentStatus.payment_state,
      paymentMethod: 'card',
      terminalId: session.terminal_id,
      terminalName: session.terminal_name,
      terminalCountry: session.terminal_country,
      buyerPhone: session.buyer_phone,
      orderNumber: session.order_number,
    });

    // Mark checkout session as completed
    await serviceClient
      .from('checkout_sessions')
      .update({ status: 'completed' })
      .eq('id', session.id);

    // Send emails — truly non-blocking (profile fetch + sends run after redirect)
    void (async () => {
      const { data: profiles } = await serviceClient
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', [session.buyer_id, listing.seller_id]);

      const buyerProfile = profiles?.find(p => p.id === session.buyer_id);
      const sellerProfile = profiles?.find(p => p.id === listing.seller_id);

      if (!buyerProfile?.email || !sellerProfile?.email) {
        console.error('[Email] Missing profile data for order emails:', {
          orderId: order.id,
          hasBuyer: !!buyerProfile?.email,
          hasSeller: !!sellerProfile?.email,
        });
        return;
      }

      const emailData = {
        orderNumber: order.order_number,
        orderId: order.id,
        gameName: listing.game_name ?? 'Game',
        priceCents: listing.price_cents,
        shippingCents: shippingCents,
        terminalName: session.terminal_name,
      };

      sendNewOrderToSeller({
        ...emailData,
        sellerName: sellerProfile.full_name ?? 'Seller',
        sellerEmail: sellerProfile.email,
        buyerName: buyerProfile.full_name ?? 'Buyer',
      }).catch((err) => console.error('[Email] Failed to notify seller:', err));

      sendOrderConfirmationToBuyer({
        ...emailData,
        buyerName: buyerProfile.full_name ?? 'Buyer',
        buyerEmail: buyerProfile.email,
        sellerName: sellerProfile.full_name ?? 'Seller',
      }).catch((err) => console.error('[Email] Failed to confirm buyer:', err));
    })().catch((err) => console.error('[Email] Background email failed:', err));

    return NextResponse.redirect(`${env.app.url}/orders/${order.id}`);
  } catch (error) {
    console.error('[Payments] Failed to create order:', error);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=order_creation_failed`
    );
  }
}
