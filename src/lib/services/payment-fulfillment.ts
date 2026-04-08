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

import { createOrder } from '@/lib/services/orders';
import { debitWallet, creditWallet, refundToWallet } from '@/lib/services/wallet';
import { refundPayment } from '@/lib/services/everypay/client';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { sendCartOrderEmails } from '@/lib/email/cart-emails';
import { logAuditEvent } from '@/lib/services/audit';
import { formatGameWithExpansions } from '@/lib/orders/utils';
import type { CartCheckoutGroup } from '@/lib/checkout/cart-types';
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

// ---------------------------------------------------------------------------
// Cart fulfillment
// ---------------------------------------------------------------------------

export async function fulfillCartPayment(
  group: CartCheckoutGroup,
  paymentReference: string,
  paymentState: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: SupabaseClient<any, any, any>
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
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'failed to fetch listings');
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
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'all cart items unavailable');
    // Credit back wallet portion if buyer used wallet balance
    if (walletDebit > 0) {
      try {
        await creditWallet(
          group.buyer_id,
          walletDebit,
          group.id,
          `Refund: all items unavailable in cart order`
        );
      } catch (err) {
        console.error('[Payments] Cart: Failed to credit wallet for all-unavailable refund:', err);
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
        paymentState,
        paymentMethod: 'card',
        walletDebitCents: orderWalletDebit,
        terminalId: group.terminal_id,
        terminalName: group.terminal_name,
        terminalAddress: group.terminal_address ?? undefined,
        terminalCity: group.terminal_city ?? undefined,
        terminalPostalCode: group.terminal_postal_code ?? undefined,
        terminalCountry: group.terminal_country,
        buyerPhone: group.buyer_phone,
        cartGroupId: group.id,
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

    // Rollback: cancel created orders and refund their wallet debits
    for (const created of createdOrders) {
      try {
        if (created.walletDebitCents > 0) {
          await refundToWallet(
            group.buyer_id,
            created.walletDebitCents,
            created.id,
            `Rollback: cart order creation failed`
          );
        }
        await serviceClient
          .from('orders')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'system' })
          .eq('id', created.id);
      } catch (rollbackError) {
        console.error(`[Payments] Cart: Rollback failed for order ${created.id}:`, rollbackError);
      }
    }

    // Full card refund — the EveryPay charge covers all sellers as one payment,
    // so we refund the entire card amount regardless of how many orders were created
    await attemptAutoRefund(paymentReference, expectedEverypayAmountCents, 'cart order creation failed mid-loop');

    await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);
    return { outcome: 'failed', error: error instanceof Error ? error.message : 'unknown' };
  }

  // Credit wallet for unavailable items' wallet portion
  if (refundWalletCents > 0) {
    try {
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

  return { outcome: 'created', orderIds: createdOrders.map((o) => o.id) };
}
