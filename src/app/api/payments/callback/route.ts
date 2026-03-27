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
import { refundPayment } from '@/lib/services/everypay/client';
import { classifyPaymentError } from '@/lib/services/everypay/classify-error';
import { createServiceClient } from '@/lib/supabase';
import { createOrder } from '@/lib/services/orders';
import { debitWallet } from '@/lib/services/wallet';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from '@/lib/email';
import { env } from '@/lib/env';
import type { CheckoutSession } from '@/lib/checkout/types';
import type { CartCheckoutGroup } from '@/lib/checkout/cart-types';
import { logAuditEvent } from '@/lib/services/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

async function attemptAutoRefund(
  paymentReference: string,
  amountCents: number,
  reason: string
): Promise<boolean> {
  try {
    await refundPayment(paymentReference, amountCents);
    console.log(`[Payments] Auto-refunded ${paymentReference}: ${reason}`);
    void logAuditEvent({
      actorType: 'system',
      action: 'payment.refunded',
      resourceType: 'payment',
      resourceId: paymentReference,
      metadata: { amountCents, reason },
    });
    return true;
  } catch (refundError) {
    console.error(
      `[Payments] CRITICAL: Auto-refund failed for ${paymentReference} (${reason}):`,
      refundError
    );
    return false;
  }
}

export async function GET(request: Request) {
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
      return handleCartGroupCallback(
        cartGroup,
        paymentReference,
        callbackToken,
        serviceClient
      );
    }

    console.error('[Payments] Checkout session not found:', orderReference);
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  // Validate callback token (null check handles legacy sessions before migration)
  if (session.callback_token && session.callback_token !== callbackToken) {
    console.error('[Payments] Invalid callback token for session:', session.id);
    return NextResponse.redirect(`${env.app.url}/browse?error=invalid_callback`);
  }

  if (session.status === 'completed') {
    // Session already processed — find the order
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
    // Legacy completed sessions (order_number is null) fall through —
    // the idempotency check above already handles it via payment_reference
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
    // Payment did NOT succeed — mark expired if applicable, then redirect with error
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

  // Compute the actual amount EveryPay charged (total minus any wallet debit)
  // Used for all refund calculations below
  const walletDebit = session.wallet_debit_cents ?? 0;
  const expectedEverypayAmountCents = session.amount_cents - walletDebit;

  // Verify the payment belongs to this checkout session
  if (session.order_number && paymentStatus.order_reference !== session.order_number) {
    console.error(
      `[Payments] order_reference mismatch: EveryPay returned "${paymentStatus.order_reference}" but session has "${session.order_number}"`
    );
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'order_reference mismatch');
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=verification_failed`
    );
  }

  // Verify the payment amount matches what we charged
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

  // Re-fetch listing to get current data (include game_name for emails)
  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, game_name, reserved_by')
    .eq('id', session.listing_id)
    .single();

  // Accept 'active' (timer expired but nobody else took it) or 'reserved' by this buyer
  const isAvailable = listing && (
    listing.status === 'active' ||
    (listing.status === 'reserved' && listing.reserved_by === session.buyer_id)
  );

  if (!listing || !isAvailable) {
    console.error(`[Payments] Payment ${paymentReference} succeeded but listing ${session.listing_id} is no longer available (status: ${listing?.status}, reserved_by: ${listing?.reserved_by})`);
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'listing unavailable after payment');
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
    const walletDebitCents = session.wallet_debit_cents ?? 0;

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
      orderNumber: session.order_number ?? undefined,
      walletDebitCents,
    });

    // Debit buyer wallet if they used wallet balance for part of the payment
    if (walletDebitCents > 0) {
      try {
        await debitWallet(
          session.buyer_id,
          walletDebitCents,
          order.id,
          `Purchase: ${listing.game_name ?? 'Game'} — ${order.order_number}`
        );
      } catch (walletError) {
        // Wallet debit failed (e.g. balance changed) — log but don't fail the order.
        // The EveryPay payment succeeded, order is created. Reset buyer_wallet_debit_cents
        // to 0 so the order accurately reflects what was actually debited, making the
        // discrepancy visible in the staff dashboard for manual reconciliation.
        console.error(`[Payments] RECONCILIATION NEEDED: Wallet debit failed for order ${order.id}, expected ${walletDebitCents} cents:`, walletError);
        await serviceClient
          .from('orders')
          .update({ buyer_wallet_debit_cents: 0 })
          .eq('id', order.id);
      }
    }

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

    void logAuditEvent({
      actorId: session.buyer_id,
      actorType: 'user',
      action: 'payment.completed',
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        orderNumber: order.order_number,
        paymentReference,
        listingId: listing.id,
        amountCents: session.amount_cents,
        walletDebitCents: walletDebit,
        paymentMethod: 'card',
      },
    });

    return NextResponse.redirect(`${env.app.url}/orders/${order.id}`);
  } catch (error) {
    console.error('[Payments] Failed to create order:', error);
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, `order creation failed: ${error instanceof Error ? error.message : 'unknown'}`);
    return NextResponse.redirect(
      `${env.app.url}/checkout/${session.listing_id}?error=order_creation_failed`
    );
  }
}

/**
 * Handle a cart checkout group callback.
 * Creates one order per listing, with partial fulfillment if some items are unavailable.
 */
async function handleCartGroupCallback(
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

  // Fetch all listings in the group
  const { data: listings } = await serviceClient
    .from('listings')
    .select('id, seller_id, price_cents, status, country, game_name, reserved_by')
    .in('id', group.listing_ids);

  if (!listings) {
    console.error('[Payments] Cart: Failed to fetch listings');
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'failed to fetch listings');
    return NextResponse.redirect(`${env.app.url}/cart?error=order_creation_failed`);
  }

  // Split into available and unavailable
  const available = listings.filter(
    (l) => l.status === 'reserved' && l.reserved_by === group.buyer_id
  );
  const unavailable = listings.filter(
    (l) => !(l.status === 'reserved' && l.reserved_by === group.buyer_id)
  );

  if (available.length === 0) {
    // All items unavailable — full refund
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'all cart items unavailable');
    await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);
    return NextResponse.redirect(`${env.app.url}/cart?error=listing_unavailable`);
  }

  // Calculate refund for unavailable items (partial fulfillment)
  // Only refund shipping when ALL items from a seller are unavailable
  const walletAllocation = (group.wallet_allocation ?? {}) as Record<string, number>;
  let refundCardCents = 0;
  let refundWalletCents = 0;

  const availableSellerIds = new Set(available.map((l) => l.seller_id));

  for (const listing of unavailable) {
    const walletForItem = walletAllocation[listing.id] ?? 0;
    // Only include shipping if no available items remain from this seller
    const sellerFullyUnavailable = !availableSellerIds.has(listing.seller_id);
    const shippingRefund = sellerFullyUnavailable
      ? (getShippingPriceCents(listing.country as TerminalCountry, group.terminal_country as TerminalCountry) ?? 0)
      : 0;
    const itemTotalForRefund = listing.price_cents + shippingRefund;
    refundWalletCents += walletForItem;
    refundCardCents += itemTotalForRefund - walletForItem;
  }

  // Process partial refund if needed
  if (refundCardCents > 0) {
    await attemptAutoRefund(paymentReference, refundCardCents, `partial cart refund: ${unavailable.length} items unavailable`);
  }

  // Create orders for available items
  const createdOrders: { id: string; order_number: string; listing: typeof available[0]; shippingCents: number; walletDebitCents: number }[] = [];
  const firstForSeller = new Set<string>();

  try {
    for (const listing of available) {
      const isFirstForSeller = !firstForSeller.has(listing.seller_id);
      firstForSeller.add(listing.seller_id);

      const sellerCountry = listing.country as TerminalCountry;
      const buyerCountry = group.terminal_country as TerminalCountry;
      const shippingCents = isFirstForSeller
        ? (getShippingPriceCents(sellerCountry, buyerCountry) ?? 0)
        : 0;

      const orderWalletDebit = walletAllocation[listing.id] ?? 0;

      const order = await createOrder({
        buyerId: group.buyer_id,
        sellerId: listing.seller_id,
        listingId: listing.id,
        itemsTotalCents: listing.price_cents,
        shippingCostCents: shippingCents,
        sellerCountry: listing.country,
        paymentReference,
        paymentState: paymentStatus.payment_state,
        paymentMethod: 'card',
        walletDebitCents: orderWalletDebit,
        terminalId: group.terminal_id,
        terminalName: group.terminal_name,
        terminalCountry: group.terminal_country,
        buyerPhone: group.buyer_phone,
        cartGroupId: group.id,
      });

      // Debit wallet for this order
      if (orderWalletDebit > 0) {
        try {
          await debitWallet(
            group.buyer_id,
            orderWalletDebit,
            order.id,
            `Purchase: ${listing.game_name ?? 'Game'} — ${order.order_number}`
          );
        } catch (walletError) {
          console.error(`[Payments] Cart: Wallet debit failed for order ${order.id}:`, walletError);
          await serviceClient
            .from('orders')
            .update({ buyer_wallet_debit_cents: 0 })
            .eq('id', order.id);
        }
      }

      createdOrders.push({
        id: order.id,
        order_number: order.order_number,
        listing,
        shippingCents,
        walletDebitCents: orderWalletDebit,
      });
    }
  } catch (error) {
    console.error('[Payments] Cart: Failed to create orders:', error);
    // Orders already created stay — refund only for uncreated items
    return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}&error=partial_creation`);
  }

  // Credit wallet for unavailable items' wallet portion
  if (refundWalletCents > 0) {
    try {
      const { creditWallet } = await import('@/lib/services/wallet');
      await creditWallet(
        group.buyer_id,
        refundWalletCents,
        group.id,
        `Refund: ${unavailable.length} unavailable item(s) from cart order`
      );
    } catch (err) {
      console.error('[Payments] Cart: Failed to credit wallet for unavailable items:', err);
    }
  }

  // Mark group as completed
  await serviceClient
    .from('cart_checkout_groups')
    .update({ status: 'completed' })
    .eq('id', group.id);

  // Send emails (non-blocking)
  void (async () => {
    const userIds = Array.from(new Set([group.buyer_id, ...createdOrders.map((o) => o.listing.seller_id)]));
    const { data: profiles } = await serviceClient
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (!profiles) return;

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const buyerProfile = profileMap.get(group.buyer_id);

    for (const { id: orderId, order_number, listing, shippingCents } of createdOrders) {
      const sellerProfile = profileMap.get(listing.seller_id);
      const emailData = {
        orderNumber: order_number,
        orderId,
        gameName: listing.game_name ?? 'Game',
        priceCents: listing.price_cents,
        shippingCents,
        terminalName: group.terminal_name,
      };

      if (sellerProfile?.email) {
        sendNewOrderToSeller({
          ...emailData,
          sellerName: sellerProfile.full_name ?? 'Seller',
          sellerEmail: sellerProfile.email,
          buyerName: buyerProfile?.full_name ?? 'Buyer',
        }).catch((err) => console.error('[Email] Cart order seller notification failed:', err));
      }

      if (buyerProfile?.email) {
        sendOrderConfirmationToBuyer({
          ...emailData,
          buyerName: buyerProfile.full_name ?? 'Buyer',
          buyerEmail: buyerProfile.email,
          sellerName: sellerProfile?.full_name ?? 'Seller',
        }).catch((err) => console.error('[Email] Cart order buyer confirmation failed:', err));
      }
    }
  })().catch((err) => console.error('[Email] Cart emails failed:', err));

  void logAuditEvent({
    actorId: group.buyer_id,
    actorType: 'user',
    action: 'payment.cart_completed',
    resourceType: 'cart_checkout_group',
    resourceId: group.id,
    metadata: {
      orderCount: createdOrders.length,
      unavailableCount: unavailable.length,
      paymentReference,
      totalAmountCents: group.total_amount_cents,
    },
  });

  return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}`);
}
