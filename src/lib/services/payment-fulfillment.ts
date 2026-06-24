/**
 * Cart payment fulfillment — order creation after successful EveryPay payment.
 *
 * Called by:
 * - Browser redirect callback (GET /api/payments/callback)
 * - Reconciliation cron (POST /api/cron/reconcile-payments)
 *
 * Callers verify payment status with EveryPay before calling these functions.
 * Handles order creation, wallet debit, emails, and notifications.
 * Returns outcome objects — callers map outcomes to redirects (callback) or logs (cron).
 */

import * as Sentry from '@sentry/nextjs';
import { createOrder, lookupSellerIbanCountry } from '@/lib/services/orders';
import { debitWallet, refundToWallet } from '@/lib/services/wallet';
import { refundPayment } from '@/lib/services/everypay/client';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { sendCartOrderEmails } from '@/lib/email/cart-emails';
import { logAuditEvent } from '@/lib/services/audit';
import { formatGameWithExpansions } from '@/lib/orders/utils';
import { isAccountingEngineEnabled } from '@/lib/accounting/feature-flag';
import { cartFulfillmentWithGL } from '@/lib/accounting/lifecycle-wraps';
import type { CartCheckoutGroup } from '@/lib/checkout/cart-types';
import type { PaymentMethod } from '@/lib/orders/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Outcome types
// ---------------------------------------------------------------------------

export type CartFulfillmentOutcome =
  | { outcome: 'created'; orderIds: string[] }
  | { outcome: 'already_exists' }
  | { outcome: 'unavailable' }
  | { outcome: 'failed'; error: string };

// ---------------------------------------------------------------------------
// Auto-refund helper (shared across both flows)
// ---------------------------------------------------------------------------

export async function attemptAutoRefund(
  serviceClient: SupabaseClient,
  paymentReference: string,
  amountCents: number,
  reason: string
): Promise<boolean> {
  try {
    await refundPayment(paymentReference, amountCents);
    console.log(`[Payments] Auto-refunded ${paymentReference}: ${reason}`);
    void logAuditEvent(serviceClient, {
      actorType: 'system',
      action: 'payment.refunded',
      resourceType: 'payment',
      resourceId: paymentReference,
      metadata: { amountCents, reason },
      retentionClass: 'regulatory',
    });
    return true;
  } catch (refundError) {
    console.error(
      `[Payments] CRITICAL: Auto-refund failed for ${paymentReference} (${reason}):`,
      refundError
    );
    Sentry.captureException(refundError, {
      tags: { paymentReference, reason, phase: 'auto_refund_failed' },
      extra: { amountCents },
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mid-loop rollback helpers (cart-rollback-refund-consistency fix)
// ---------------------------------------------------------------------------
//
// These exist to fix the production incident where order STG-20260606-UJRJ
// had its card payment refunded but was never cancelled — the old catch
// block refunded the card BEFORE cancelling orders, so a crash mid-rollback
// reproduced the exact incident. Cancel-first design: claimAndCancelOrder +
// refundOrderWalletLeg run for every pending order BEFORE any card refund.
//
// Deliberately do NOT call refundOrder() from order-refund.ts — that
// function always attempts its own EveryPay call when cardAmount > 0, which
// would double-refund against the same payment reference the aggregate
// attemptAutoRefund call already covers in the catch block below.

/**
 * Atomically claims a pending_seller order for cancellation, restores its
 * listings, and deactivates its order_items. Idempotent: returns false
 * without side effects if the order was already transitioned by a
 * concurrent retry.
 */
export async function claimAndCancelOrder(
  serviceClient: SupabaseClient,
  buyerId: string,
  order: { id: string; order_number: string },
): Promise<boolean> {
  const { data: claimed } = await serviceClient
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'system',
    })
    .eq('id', order.id)
    .eq('status', 'pending_seller')
    .select('id')
    .single();

  if (!claimed) return false; // already transitioned by a concurrent retry — idempotent no-op

  const { data: orderItems } = await serviceClient
    .from('order_items')
    .select('listing_id')
    .eq('order_id', order.id);
  const listingIds = (orderItems ?? []).map((i) => i.listing_id);

  if (listingIds.length > 0) {
    const { error: unreserveError } = await serviceClient.rpc('unreserve_listings', {
      p_listing_ids: listingIds, p_buyer_id: buyerId,
    });
    if (unreserveError) {
      Sentry.captureException(unreserveError, {
        tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_listings_restore_failed' },
      });
    }
    const { error: deactivateError } = await serviceClient
      .from('order_items')
      .update({ active: false })
      .eq('order_id', order.id);
    if (deactivateError) {
      Sentry.captureException(deactivateError, {
        tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_order_items_deactivate_failed' },
      });
    }
  }

  return true;
}

async function refundOrderWalletLeg(
  serviceClient: SupabaseClient,
  buyerId: string,
  order: { id: string; order_number: string; buyer_wallet_debit_cents: number },
): Promise<boolean> {
  if (order.buyer_wallet_debit_cents <= 0) return true;
  try {
    await refundToWallet(buyerId, order.buyer_wallet_debit_cents, order.id, 'Rollback: cart order creation failed');
    return true;
  } catch (walletError) {
    console.error(`[Payments] Cart: Wallet rollback refund failed for order ${order.id}:`, walletError);
    Sentry.captureException(walletError, {
      tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_wallet_refund_failed' },
    });
    return false;
  }
}

/**
 * Writes the refund_status stamp unconditionally (needed in Phase 1, before
 * the card outcome is known, so a crash before Phase 3 still leaves a
 * sweepable status instead of null). Only captures to Sentry when
 * captureIfIncomplete=true — Phase 1 always computes 'partial'/'failed'
 * (cardRefundOk is hard-coded false there), so capturing there would alert
 * on every successful rollback. Phase 3 passes true once the real outcome
 * is known.
 */
export async function stampRollbackRefundStatus(
  serviceClient: SupabaseClient,
  order: { id: string; order_number: string; total_amount_cents: number; buyer_wallet_debit_cents: number },
  cardRefundOk: boolean,
  walletRefundOk: boolean,
  captureIfIncomplete: boolean,
): Promise<{ refundStatus: 'completed' | 'partial' | 'failed'; refundAmountCents: number }> {
  const refundStatus =
    cardRefundOk && walletRefundOk ? 'completed' :
    !cardRefundOk && !walletRefundOk ? 'failed' : 'partial';
  const refundAmountCents =
    (cardRefundOk ? order.total_amount_cents - order.buyer_wallet_debit_cents : 0) +
    (walletRefundOk ? order.buyer_wallet_debit_cents : 0);

  await serviceClient
    .from('orders')
    .update({ refund_status: refundStatus, refund_amount_cents: refundAmountCents, refunded_at: new Date().toISOString() })
    .eq('id', order.id);

  if (captureIfIncomplete && refundStatus !== 'completed') {
    Sentry.captureException(new Error(`Cart rollback refund ${refundStatus} for order ${order.order_number}`), {
      tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_refund_incomplete' },
    });
  }
  return { refundStatus, refundAmountCents };
}

// ---------------------------------------------------------------------------
// Cart fulfillment
// ---------------------------------------------------------------------------

export async function fulfillCartPayment(
  group: CartCheckoutGroup,
  paymentReference: string,
  paymentState: string,
  serviceClient: SupabaseClient,
  paymentMethod: PaymentMethod = 'card',
  /**
   * cf-ipcountry header from the request that triggered fulfillment. Null when
   * called from a cron (no request context). Captured on each order created in
   * this group for fraud-investigation forensics; see migration 086.
   */
  requestCountryAtOrder: string | null = null,
  /**
   * Raw EveryPay callback payload. Threaded into the C.1/C.2 GL entry's
   * posting_context so the original payment-confirmation data is preserved
   * for audit, dispute, and fraud forensics under flag-ON. Optional for
   * back-compat with callers that don't forward the raw payload yet; when
   * omitted, a minimal shape is reconstructed from paymentReference and
   * paymentState.
   */
  callbackPayload?: Record<string, unknown>,
): Promise<CartFulfillmentOutcome> {
  // Idempotency: check if orders already exist for this group
  const { data: existingOrders } = await serviceClient
    .from('orders')
    .select('id')
    .eq('cart_group_id', group.id);

  if (existingOrders && existingOrders.length > 0) {
    return { outcome: 'already_exists' };
  }

  const walletDebit = group.wallet_debit_cents ?? 0;
  const expectedEverypayAmountCents = group.total_amount_cents - walletDebit;

  // Fetch listings and expansion data in parallel (independent operations)
  const [{ data: listings }, { data: expansionRows }] = await Promise.all([
    serviceClient
      .from('listings')
      .select('id, seller_id, price_cents, status, country, game_name, reserved_by, listing_type, highest_bidder_id, current_bid_cents')
      .in('id', group.listing_ids),
    serviceClient
      .from('listing_expansions')
      .select('listing_id, game_name')
      .in('listing_id', group.listing_ids),
  ]);

  const expansionsByListing = new Map<string, Array<{ game_name: string }>>();
  for (const row of expansionRows ?? []) {
    const arr = expansionsByListing.get(row.listing_id) ?? [];
    arr.push({ game_name: row.game_name });
    expansionsByListing.set(row.listing_id, arr);
  }

  if (!listings) {
    console.error('[Payments] Cart: Failed to fetch listings');
    await attemptAutoRefund(serviceClient, paymentReference, expectedEverypayAmountCents, 'failed to fetch listings');
    return { outcome: 'failed', error: 'failed to fetch listings' };
  }

  // Split into available and unavailable
  // Regular items must be reserved by this buyer; auction items must still be auction_ended
  const isAvailable = (l: typeof listings[0]) =>
    (l.status === 'reserved' && l.reserved_by === group.buyer_id) ||
    (l.listing_type === 'auction' && l.status === 'auction_ended' && l.highest_bidder_id === group.buyer_id);

  const available = listings.filter(isAvailable);
  const unavailable = listings.filter((l) => !isAvailable(l));

  // Use winning bid price for auction items
  for (const listing of available) {
    if (listing.listing_type === 'auction' && listing.current_bid_cents) {
      listing.price_cents = listing.current_bid_cents;
    }
  }

  if (available.length === 0) {
    await attemptAutoRefund(serviceClient, paymentReference, expectedEverypayAmountCents, 'all cart items unavailable');
    // Refund back wallet portion if buyer used wallet balance
    if (walletDebit > 0) {
      try {
        await refundToWallet(
          group.buyer_id,
          walletDebit,
          group.id,
          `Refund: all items unavailable in cart order`
        );
      } catch (err) {
        console.error('[Payments] Cart: Failed to refund wallet for all-unavailable refund:', err);
      }
    }
    await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);
    return { outcome: 'unavailable' };
  }

  // Calculate refund for unavailable items (partial fulfillment)
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

  // Process partial refund if needed. Both legs of the SAME refund event
  // (card + wallet) fire together, here, before the seller loop starts —
  // so a later unrelated failure in the loop can't skip the wallet leg
  // (it used to run after the loop completed successfully, so a mid-loop
  // throw meant the wallet portion for unavailable items was never refunded).
  if (refundCardCents > 0) {
    await attemptAutoRefund(serviceClient, paymentReference, refundCardCents, `partial cart refund: ${unavailable.length} items unavailable`);
  }
  if (refundWalletCents > 0) {
    try {
      await refundToWallet(
        group.buyer_id,
        refundWalletCents,
        group.id,
        `Refund: ${unavailable.length} unavailable item(s) from cart order`
      );
    } catch (err) {
      console.error('[Payments] Cart: Failed to refund wallet for unavailable items:', err);
    }
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

      const orderWalletDebit = sellerItems.reduce(
        (sum, l) => sum + (walletAllocation[l.id] ?? 0), 0
      );

      const sellerIbanCountryAtOrder = await lookupSellerIbanCountry(sellerId);

      const order = await createOrder({
        buyerId: group.buyer_id,
        sellerId,
        items: sellerItems.map((l) => ({ listingId: l.id, priceCents: l.price_cents })),
        shippingCostCents: shippingCents,
        sellerCountry: sellerItems[0].country,
        paymentReference,
        paymentState,
        paymentMethod,
        walletDebitCents: orderWalletDebit,
        terminalId: group.terminal_id,
        terminalName: group.terminal_name,
        terminalAddress: group.terminal_address ?? undefined,
        terminalCity: group.terminal_city ?? undefined,
        terminalPostalCode: group.terminal_postal_code ?? undefined,
        terminalCountry: group.terminal_country,
        buyerPhone: group.buyer_phone,
        cartGroupId: group.id,
        requestCountryAtOrder,
        sellerIbanCountryAtOrder,
        // Reuse cart group order number when there's only one seller (matches EveryPay reference)
        orderNumber: sellerGroups.size === 1 ? group.order_number : undefined,
      });

      // Debit wallet for this order
      if (orderWalletDebit > 0) {
        const gameNames = sellerItems.map((l) => formatGameWithExpansions(l.game_name ?? 'Game', expansionsByListing.get(l.id) ?? [])).join(', ');
        try {
          await debitWallet(
            group.buyer_id,
            orderWalletDebit,
            order.id,
            `Purchase: ${gameNames} — ${order.order_number}`
          );
        } catch (walletError) {
          console.error(`[Payments] Cart: Wallet debit failed for order ${order.id} — reconciliation cron will retry:`, walletError);
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
    console.error('[Payments] Cart: Failed mid-loop, rolling back created orders:', error);
    Sentry.captureException(error, {
      tags: { cartGroupId: group.id, paymentReference, phase: 'cart_fulfillment_mid_loop' },
      extra: { createdOrderIds: createdOrders.map((o) => o.id) },
    });

    // Re-query rather than trust createdOrders — a row can be invisible to it
    // if createOrder() itself failed to report a row it created (see orders.ts).
    const { data: pendingOrders, error: pendingOrdersError } = await serviceClient
      .from('orders')
      .select('id, order_number, buyer_wallet_debit_cents, total_amount_cents')
      .eq('cart_group_id', group.id)
      .eq('status', 'pending_seller');

    if (pendingOrdersError) {
      // If this query fails, Phase 1 silently loops over [] (nothing claimed)
      // and Phase 2 still fires the card refund unconditionally — surface it
      // rather than let the rollback proceed on a false "nothing pending" read.
      Sentry.captureException(pendingOrdersError, {
        tags: { cartGroupId: group.id, phase: 'cart_rollback_verification_query_failed' },
      });
    }

    if (pendingOrders && pendingOrders.length !== createdOrders.length) {
      Sentry.captureException(new Error('Cart rollback found orders not tracked in-memory'), {
        tags: { cartGroupId: group.id, phase: 'cart_fulfillment_stranded_order_detected' },
        extra: { dbOrderIds: pendingOrders.map((o) => o.id), trackedOrderIds: createdOrders.map((o) => o.id) },
      });
    }

    // Phase 1 — cancel + restore listings + deactivate order_items + refund the
    // wallet leg for every pending order FIRST, before any card money moves.
    // A crash here leaves orders cancelled (never live-and-refunded).
    // Per-order try/catch (matching autoCancelOrders in order-deadlines.ts) so
    // one order's unexpected throw can't abort the rollback for its siblings.
    const claimedOrders: NonNullable<typeof pendingOrders> = [];
    const walletOutcomes = new Map<string, boolean>();
    for (const order of pendingOrders ?? []) {
      try {
        const claimed = await claimAndCancelOrder(serviceClient, group.buyer_id, order);
        if (!claimed) continue;
        const walletRefundOk = await refundOrderWalletLeg(serviceClient, group.buyer_id, order);
        walletOutcomes.set(order.id, walletRefundOk);
        claimedOrders.push(order);
        // Pessimistic DB stamp for crash-visibility — captureIfIncomplete=false:
        // cardRefundOk is hard-coded false here (the card hasn't run yet), so
        // capturing now would alert on every successful rollback.
        await stampRollbackRefundStatus(serviceClient, order, false, walletRefundOk, false);
      } catch (perOrderError) {
        Sentry.captureException(perOrderError, {
          tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_unexpected_per_order_error' },
        });
      }
    }

    // Phase 2 — the single aggregate card refund, only now that nothing claimed
    // above can still be shipped. Subtract what the pre-loop unavailable-items
    // refund already covered (Finding A) so the card is never refunded twice.
    const remainingCardRefundCents = expectedEverypayAmountCents - refundCardCents;
    let cardRefundOk = true;
    if (remainingCardRefundCents > 0) {
      cardRefundOk = await attemptAutoRefund(
        serviceClient, paymentReference, remainingCardRefundCents, 'cart order creation failed mid-loop'
      );
    }

    // Phase 3 — upgrade every claimed order's refund_status now that the card
    // outcome is known (captureIfIncomplete=true), and fire the audit event.
    // Per-order try/catch, same rationale as Phase 1.
    for (const order of claimedOrders) {
      try {
        const walletRefundOk = walletOutcomes.get(order.id) ?? false;
        const { refundStatus, refundAmountCents } = await stampRollbackRefundStatus(
          serviceClient, order, cardRefundOk, walletRefundOk, true
        );
        void logAuditEvent(serviceClient, {
          actorType: 'system',
          action: 'order.auto_cancelled.system',
          resourceType: 'order',
          resourceId: order.id,
          metadata: { orderNumber: order.order_number, reason: 'system', refundStatus, refundAmountCents },
          retentionClass: 'regulatory',
        });
      } catch (perOrderError) {
        Sentry.captureException(perOrderError, {
          tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_unexpected_per_order_error' },
        });
      }
    }

    // Post-condition canary: after a total rollback, every order tied to this
    // group must be cancelled. Any survivor is the literal UJRJ incident
    // condition — alert immediately. If the verification query itself fails,
    // that failure must be just as loud — a silent `null` here would let the
    // one canary whose job is "catch the incident again" go dark exactly when
    // it might be needed.
    const { data: stillLiveOrders, error: stillLiveOrdersError } = await serviceClient
      .from('orders')
      .select('id')
      .eq('cart_group_id', group.id)
      .neq('status', 'cancelled');
    if (stillLiveOrdersError) {
      Sentry.captureException(stillLiveOrdersError, {
        tags: { cartGroupId: group.id, phase: 'cart_rollback_verification_query_failed' },
      });
    } else if (stillLiveOrders && stillLiveOrders.length > 0) {
      Sentry.captureException(new Error('Cart rollback left a live order after total rollback'), {
        tags: { cartGroupId: group.id, phase: 'cart_rollback_live_order_survived' },
        extra: { liveOrderIds: stillLiveOrders.map((o) => o.id) },
      });
    }

    await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);
    return { outcome: 'failed', error: error instanceof Error ? error.message : 'unknown' };
  }

  // Mark group as completed. Two-level cutover gate:
  //   - ACCOUNTING_ENGINE_ENABLED=false → legacy update on cart_checkout_groups
  //   - flag-ON + cart.is_staff_test=false → legacy update (stage 2 customer traffic)
  //   - flag-ON + cart.is_staff_test=true → engine path with posting_context tag
  // Stage 3 transition: drop the `&& group.is_staff_test` clause so the engine
  // path runs unconditionally. See lifecycle-cutover-runbook.md §4.
  if (isAccountingEngineEnabled() && group.is_staff_test) {
    await cartFulfillmentWithGL(serviceClient, {
      cart_group_id: group.id,
      buyer_id: group.buyer_id,
      payment_method: paymentMethod === 'bank_link' ? 'bank_link' : 'card',
      gross_cart_cents: group.total_amount_cents,
      buyer_wallet_cents: walletDebit,
      everypay_payment_reference: paymentReference,
      callback_payload: callbackPayload ?? {
        payment_reference: paymentReference,
        payment_state: paymentState,
      },
      partial_refund:
        refundCardCents + refundWalletCents > 0
          ? {
              refund_cents: refundCardCents + refundWalletCents,
              buyer_wallet_refund_cents: refundWalletCents,
            }
          : undefined,
      is_staff_test: true,
    });
  } else {
    await serviceClient
      .from('cart_checkout_groups')
      .update({ status: 'completed' })
      .eq('id', group.id);
  }

  // Send emails (non-blocking)
  void sendCartOrderEmails(
    createdOrders.map(({ id, order_number, items, shippingCents }) => ({
      orderId: id,
      orderNumber: order_number,
      sellerId: items[0].seller_id,
      items: items.map((l) => ({
        gameName: formatGameWithExpansions(l.game_name ?? 'Game', expansionsByListing.get(l.id) ?? []),
        priceCents: l.price_cents,
      })),
      shippingCents,
      terminalName: group.terminal_name,
      terminalAddress: group.terminal_address,
      terminalCity: group.terminal_city,
      terminalPostalCode: group.terminal_postal_code,
      terminalCountry: group.terminal_country,
    })),
    group.buyer_id
  );

  void logAuditEvent(serviceClient, {
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
    retentionClass: 'regulatory',
  });

  return { outcome: 'created', orderIds: createdOrders.map((o) => o.id) };
}
