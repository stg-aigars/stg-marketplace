/**
 * Payment callback handler (EveryPay redirect).
 *
 * This is the primary mechanism that creates orders after payment.
 * A reconciliation cron (/api/cron/reconcile-payments) handles the case
 * where the browser redirect fails (user closes browser, network drops).
 *
 * Order creation logic is in src/lib/services/payment-fulfillment.ts,
 * shared between this callback and the reconciliation cron.
 */

import { NextResponse } from 'next/server';
import { getPaymentStatus, SUCCESSFUL_STATES } from '@/lib/services/everypay';
import { classifyPaymentError } from '@/lib/services/everypay/classify-error';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { CheckoutSession } from '@/lib/checkout/types';
import type { CartCheckoutGroup } from '@/lib/checkout/cart-types';
import { paymentCallbackLimiter, getClientIP } from '@/lib/rate-limit';
import {
  fulfillSingleItemPayment,
  fulfillCartPayment,
  attemptAutoRefund,
} from '@/lib/services/payment-fulfillment';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  // Rate limit to prevent enumeration and EveryPay API quota abuse
  const ip = getClientIP(request);
  const rateLimitResult = paymentCallbackLimiter.check(ip);
  if (!rateLimitResult.success) {
    return NextResponse.redirect(`${env.app.url}/browse?error=rate_limited`);
  }

  const { searchParams } = new URL(request.url);
  const paymentReference = searchParams.get('payment_reference');
  const orderReference = searchParams.get('order_reference');
  const callbackToken = searchParams.get('token');

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

  // Look up checkout session by order_number (STG-YYYYMMDD-XXXX)
  let session: CheckoutSession | null = null;
  const { data: sessionByOrderNumber } = await serviceClient
    .from('checkout_sessions')
    .select('*')
    .eq('order_number', orderReference)
    .single<CheckoutSession>();

  if (sessionByOrderNumber) {
    session = sessionByOrderNumber;
  } else {
    // Fallback: legacy sessions created before order_number migration have UUID as order_reference
    const { data: sessionById } = await serviceClient
      .from('checkout_sessions')
      .select('*')
      .eq('id', orderReference)
      .single<CheckoutSession>();

    if (sessionById) {
      console.log(`[Payments] Legacy session fallback: found session ${sessionById.id} by UUID (no order_number)`);
      session = sessionById;
    }
  }

  if (!session) {
    // Check if this is a cart checkout group
    const { data: cartGroup } = await serviceClient
      .from('cart_checkout_groups')
      .select('*')
      .eq('order_number', orderReference)
      .single();

    if (cartGroup) {
      return handleCartCallback(
        cartGroup,
        paymentReference,
        callbackToken,
        serviceClient
      );
    }

    console.error('[Payments] Checkout session not found:', orderReference);
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  // Validate callback token — reject if missing or mismatched
  if (!callbackToken || session.callback_token !== callbackToken) {
    console.error('[Payments] Invalid callback token for session:', session.id);
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  if (session.status === 'completed') {
    let orderForSession = null;
    if (session.order_number) {
      const { data } = await serviceClient
        .from('orders')
        .select('id')
        .eq('order_number', session.order_number)
        .single();
      orderForSession = data;
    }
    if (orderForSession) {
      return NextResponse.redirect(`${env.app.url}/orders/${orderForSession.id}`);
    }
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
    if (session.status === 'pending') {
      const SESSION_TTL_MS = 30 * 60 * 1000;
      const sessionAge = Date.now() - new Date(session.created_at).getTime();
      if (sessionAge > SESSION_TTL_MS) {
        await serviceClient
          .from('checkout_sessions')
          .update({ status: 'expired' })
          .eq('id', session.id)
          .eq('status', 'pending');
      }
    }

    const errorCategory = classifyPaymentError(
      paymentStatus.payment_state,
      paymentStatus.error
    );
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=${errorCategory}`
    );
  }

  // Verify payment amount and order reference
  const walletDebit = session.wallet_debit_cents ?? 0;
  const expectedEverypayAmountCents = session.amount_cents - walletDebit;

  if (session.order_number && paymentStatus.order_reference !== session.order_number) {
    console.error(
      `[Payments] order_reference mismatch: EveryPay returned "${paymentStatus.order_reference}" but session has "${session.order_number}"`
    );
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'order_reference mismatch');
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=verification_failed`
    );
  }

  const expectedAmount = (expectedEverypayAmountCents / 100).toFixed(2);
  if (paymentStatus.amount && paymentStatus.amount !== expectedAmount) {
    console.error(
      `[Payments] Amount mismatch: EveryPay charged €${paymentStatus.amount} but expected €${expectedAmount} (total: ${session.amount_cents}, wallet: ${walletDebit})`
    );
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, `amount mismatch: expected €${expectedAmount}, got €${paymentStatus.amount}`);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=verification_failed`
    );
  }

  // Fulfill the payment — create order, debit wallet, send notifications
  const result = await fulfillSingleItemPayment(
    session,
    paymentReference,
    paymentStatus.payment_state,
    serviceClient
  );

  switch (result.outcome) {
    case 'created':
      return NextResponse.redirect(`${env.app.url}/orders/${result.orderId}`);
    case 'already_exists':
      return NextResponse.redirect(`${env.app.url}/orders/${result.orderId}`);
    case 'unavailable':
      return NextResponse.redirect(
        `${env.app.url}/checkout/${session.listing_id}?error=listing_unavailable`
      );
    case 'failed':
      return NextResponse.redirect(
        `${env.app.url}/checkout/${session.listing_id}?error=order_creation_failed`
      );
  }
}

/**
 * Handle a cart checkout group callback.
 */
async function handleCartCallback(
  group: CartCheckoutGroup,
  paymentReference: string,
  callbackToken: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: SupabaseClient<any, any, any>
) {
  // Idempotency: check if orders already exist for this group
  const { data: existingOrders } = await serviceClient
    .from('orders')
    .select('id')
    .eq('cart_group_id', group.id);

  if (existingOrders && existingOrders.length > 0) {
    return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}`);
  }

  // Validate callback token
  if (group.callback_token !== callbackToken) {
    console.error('[Payments] Invalid callback token for cart group:', group.id);
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  if (group.status === 'completed') {
    return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}`);
  }

  // Verify payment with EveryPay
  let paymentStatus;
  try {
    paymentStatus = await getPaymentStatus(paymentReference);
  } catch (error) {
    console.error('[Payments] Cart: Failed to verify payment:', error);
    return NextResponse.redirect(`${env.app.url}/cart?error=verification_failed`);
  }

  const walletDebit = group.wallet_debit_cents ?? 0;
  const expectedEverypayAmountCents = group.total_amount_cents - walletDebit;

  // Verify order_reference matches cart group
  if (paymentStatus.order_reference !== group.order_number) {
    console.error(
      `[Payments] Cart order_reference mismatch: EveryPay returned "${paymentStatus.order_reference}" but group has "${group.order_number}"`
    );
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'cart order_reference mismatch');
    return NextResponse.redirect(`${env.app.url}/cart?error=verification_failed`);
  }

  if (!SUCCESSFUL_STATES.has(paymentStatus.payment_state)) {
    if (group.status === 'pending') {
      const SESSION_TTL_MS = 30 * 60 * 1000;
      const sessionAge = Date.now() - new Date(group.created_at).getTime();
      if (sessionAge > SESSION_TTL_MS) {
        await serviceClient
          .from('cart_checkout_groups')
          .update({ status: 'expired' })
          .eq('id', group.id)
          .eq('status', 'pending');
      }
    }
    return NextResponse.redirect(`${env.app.url}/cart?error=payment_failed`);
  }

  // Verify amount
  const expectedAmount = (expectedEverypayAmountCents / 100).toFixed(2);
  if (paymentStatus.amount && paymentStatus.amount !== expectedAmount) {
    console.error(`[Payments] Cart amount mismatch: expected €${expectedAmount}, got €${paymentStatus.amount}`);
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'cart amount mismatch');
    return NextResponse.redirect(`${env.app.url}/cart?error=verification_failed`);
  }

  // Fulfill the cart payment — create orders, debit wallet, send notifications
  const result = await fulfillCartPayment(
    group,
    paymentReference,
    paymentStatus.payment_state,
    serviceClient
  );

  switch (result.outcome) {
    case 'created':
      return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}`);
    case 'already_exists':
      return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}`);
    case 'unavailable':
      return NextResponse.redirect(`${env.app.url}/cart?error=listing_unavailable`);
    case 'failed':
      return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}&error=partial_creation`);
  }
}
