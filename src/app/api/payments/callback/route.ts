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
import { sendCartOrderEmails } from '@/lib/email/cart-emails';
import { logAuditEvent } from '@/lib/services/audit';
import { notify } from '@/lib/notifications';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import type { SupabaseClient } from '@supabase/supabase-js';

const callbackLimiter = rateLimit({ interval: 60_000, maxRequests: 20 });

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
  // Rate limit to prevent enumeration and EveryPay API quota abuse (F13)
  const ip = getClientIP(request);
  const rateLimitResult = callbackLimiter.check(ip);
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

  // Validate callback token — reject if missing or mismatched (F15)
  if (!callbackToken || session.callback_token !== callbackToken) {
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
    .select('id, seller_id, price_cents, status, country, game_name, reserved_by, listing_type, highest_bidder_id')
    .eq('id', session.listing_id)
    .single();

  // Accept 'active' (timer expired but nobody else took it), 'reserved' by this buyer,
  // or 'auction_ended' for the auction winner
  const isAuctionWinnerPayment = listing?.listing_type === 'auction' &&
    listing.status === 'auction_ended' &&
    listing.highest_bidder_id === session.buyer_id;

  const isAvailable = listing && (
    listing.status === 'active' ||
    (listing.status === 'reserved' && listing.reserved_by === session.buyer_id) ||
    isAuctionWinnerPayment
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
      items: [{ listingId: listing.id, priceCents: listing.price_cents }],
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

      void notify(session.buyer_id, 'order.created', {
        gameName: emailData.gameName,
        orderNumber: emailData.orderNumber,
        orderId: emailData.orderId,
        sellerName: sellerProfile.full_name ?? 'Seller',
        role: 'buyer',
      });
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
 * Groups available items by seller and creates one order per seller,
 * with partial fulfillment if some items are unavailable.
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

  // Verify order_reference matches cart group — matches single-item pattern (F14)
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

  // Group available items by seller — one order per seller
  const sellerGroups = new Map<string, typeof available>();
  for (const listing of available) {
    const groupItems = sellerGroups.get(listing.seller_id) ?? [];
    groupItems.push(listing);
    sellerGroups.set(listing.seller_id, groupItems);
  }

  // Create one consolidated order per seller group
  const createdOrders: { id: string; order_number: string; items: typeof available; shippingCents: number; walletDebitCents: number }[] = [];

  try {
    for (const [sellerId, sellerItems] of Array.from(sellerGroups.entries())) {
      const sellerCountry = sellerItems[0].country as TerminalCountry;
      const buyerCountry = group.terminal_country as TerminalCountry;
      const shippingCents = getShippingPriceCents(sellerCountry, buyerCountry) ?? 0;

      // Sum wallet allocation across all items in this seller group
      const orderWalletDebit = sellerItems.reduce(
        (sum, l) => sum + (walletAllocation[l.id] ?? 0), 0
      );

      const order = await createOrder({
        buyerId: group.buyer_id,
        sellerId,
        items: sellerItems.map((l) => ({ listingId: l.id, priceCents: l.price_cents })),
        shippingCostCents: shippingCents,
        sellerCountry: sellerItems[0].country,
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
        const gameNames = sellerItems.map((l) => l.game_name ?? 'Game').join(', ');
        try {
          await debitWallet(
            group.buyer_id,
            orderWalletDebit,
            order.id,
            `Purchase: ${gameNames} — ${order.order_number}`
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
        items: sellerItems,
        shippingCents,
        walletDebitCents: orderWalletDebit,
      });
    }
  } catch (error) {
    console.error('[Payments] Cart: Failed to create orders:', error);
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

  // Send emails (non-blocking) — pass items array per order
  void sendCartOrderEmails(
    createdOrders.map(({ id, order_number, items, shippingCents }) => ({
      orderId: id,
      orderNumber: order_number,
      sellerId: items[0].seller_id,
      items: items.map((l) => ({ gameName: l.game_name ?? 'Game', priceCents: l.price_cents })),
      shippingCents,
      terminalName: group.terminal_name,
    })),
    group.buyer_id
  );

  void logAuditEvent({
    actorId: group.buyer_id,
    actorType: 'user',
    action: 'payment.cart_completed',
    resourceType: 'cart_checkout_group',
    resourceId: group.id,
    metadata: {
      orderCount: createdOrders.length,
      totalItemCount: available.length,
      unavailableCount: unavailable.length,
      paymentReference,
      totalAmountCents: group.total_amount_cents,
    },
  });

  return NextResponse.redirect(`${env.app.url}/orders?from=cart&group=${group.id}`);
}
