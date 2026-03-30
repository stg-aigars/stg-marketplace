/**
 * Payment reconciliation cron.
 *
 * Detects orphaned checkout sessions where EveryPay captured payment but the
 * browser redirect callback never fired (buyer closed browser, network drop).
 * For confirmed payments, creates the missing order. For failed payments,
 * cleans up the session and releases reservations.
 *
 * Runs every 5 minutes via Coolify cron.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { getPaymentStatus, SUCCESSFUL_STATES, FAILED_STATES } from '@/lib/services/everypay';
import { debitWallet } from '@/lib/services/wallet';
import {
  fulfillSingleItemPayment,
  fulfillCartPayment,
} from '@/lib/services/payment-fulfillment';
import type { CheckoutSession } from '@/lib/checkout/types';
import type { CartCheckoutGroup } from '@/lib/checkout/cart-types';

const BATCH_LIMIT = 50;
const MIN_AGE_MS = 5 * 60 * 1000;   // 5 minutes — give the callback time to fire
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — skip ancient sessions

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const minCutoff = new Date(Date.now() - MIN_AGE_MS).toISOString();
  const maxCutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();

  const summary = {
    sessions: { processed: 0, created: 0, cleaned: 0, skipped: 0, errors: 0 },
    carts: { processed: 0, created: 0, cleaned: 0, skipped: 0, errors: 0 },
  };

  // ---- Single-item checkout sessions ----

  const { data: staleSessions, error: sessionQueryError } = await serviceClient
    .from('checkout_sessions')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', minCutoff)
    .gt('created_at', maxCutoff)
    .not('everypay_payment_reference', 'is', null)
    .limit(BATCH_LIMIT)
    .returns<CheckoutSession[]>();

  if (sessionQueryError) {
    console.error('[Reconcile] Failed to query sessions:', sessionQueryError);
  } else if (staleSessions) {
    for (const session of staleSessions) {
      summary.sessions.processed++;
      try {
        const paymentStatus = await getPaymentStatus(session.everypay_payment_reference!);

        if (SUCCESSFUL_STATES.has(paymentStatus.payment_state)) {
          const result = await fulfillSingleItemPayment(
            session,
            session.everypay_payment_reference!,
            paymentStatus.payment_state,
            serviceClient
          );

          if (result.outcome === 'created') {
            summary.sessions.created++;
            console.log(`[Reconcile] Created order ${result.orderId} for orphaned session ${session.id}`);
          } else if (result.outcome === 'already_exists') {
            // Callback beat us — mark session completed
            await serviceClient
              .from('checkout_sessions')
              .update({ status: 'completed' })
              .eq('id', session.id);
            summary.sessions.skipped++;
          } else if (result.outcome === 'unavailable') {
            // Listing no longer available — refund already triggered by fulfillment
            await serviceClient
              .from('checkout_sessions')
              .update({ status: 'expired' })
              .eq('id', session.id);
            summary.sessions.cleaned++;
            console.log(`[Reconcile] Session ${session.id}: listing unavailable, refunded`);
          } else {
            // Fulfillment failed — mark expired to prevent re-processing every run
            await serviceClient
              .from('checkout_sessions')
              .update({ status: 'expired' })
              .eq('id', session.id);
            summary.sessions.errors++;
            console.error(`[Reconcile] Session ${session.id}: fulfillment failed — ${result.error}`);
          }
        } else if (FAILED_STATES.has(paymentStatus.payment_state)) {
          // Payment failed — clean up session
          await serviceClient
            .from('checkout_sessions')
            .update({ status: 'expired' })
            .eq('id', session.id)
            .eq('status', 'pending');
          summary.sessions.cleaned++;
        } else {
          // Still processing — skip, check again next run
          summary.sessions.skipped++;
        }
      } catch (error) {
        summary.sessions.errors++;
        console.error(`[Reconcile] Error processing session ${session.id}:`, error);
      }
    }
  }

  // ---- Cart checkout groups ----

  const { data: staleGroups, error: cartQueryError } = await serviceClient
    .from('cart_checkout_groups')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', minCutoff)
    .gt('created_at', maxCutoff)
    .not('everypay_payment_reference', 'is', null)
    .limit(BATCH_LIMIT)
    .returns<CartCheckoutGroup[]>();

  if (cartQueryError) {
    console.error('[Reconcile] Failed to query cart groups:', cartQueryError);
  } else if (staleGroups) {
    for (const group of staleGroups) {
      summary.carts.processed++;
      try {
        const paymentStatus = await getPaymentStatus(group.everypay_payment_reference!);

        if (SUCCESSFUL_STATES.has(paymentStatus.payment_state)) {
          const result = await fulfillCartPayment(
            group,
            group.everypay_payment_reference!,
            paymentStatus.payment_state,
            serviceClient
          );

          if (result.outcome === 'created') {
            summary.carts.created++;
            console.log(`[Reconcile] Created ${result.orderIds.length} order(s) for orphaned cart group ${group.id}`);
          } else if (result.outcome === 'already_exists') {
            await serviceClient
              .from('cart_checkout_groups')
              .update({ status: 'completed' })
              .eq('id', group.id);
            summary.carts.skipped++;
          } else if (result.outcome === 'unavailable') {
            summary.carts.cleaned++;
            console.log(`[Reconcile] Cart group ${group.id}: all items unavailable, refunded`);
          } else {
            // Fulfillment failed — mark expired to prevent re-processing every run
            await serviceClient
              .from('cart_checkout_groups')
              .update({ status: 'expired' })
              .eq('id', group.id);
            summary.carts.errors++;
            console.error(`[Reconcile] Cart group ${group.id}: fulfillment failed — ${result.error}`);
          }
        } else if (FAILED_STATES.has(paymentStatus.payment_state)) {
          // Payment failed — expire group and unreserve listings
          await serviceClient
            .from('cart_checkout_groups')
            .update({ status: 'expired' })
            .eq('id', group.id)
            .eq('status', 'pending');

          await serviceClient.rpc('unreserve_listings', {
            p_listing_ids: group.listing_ids,
            p_buyer_id: group.buyer_id,
          });

          summary.carts.cleaned++;
        } else {
          summary.carts.skipped++;
        }
      } catch (error) {
        summary.carts.errors++;
        console.error(`[Reconcile] Error processing cart group ${group.id}:`, error);
      }
    }
  }

  const totalCreated = summary.sessions.created + summary.carts.created;
  if (totalCreated > 0) {
    console.log(`[Reconcile] Created ${totalCreated} order(s) from orphaned sessions`);
  }

  // ---- Wallet debit failure retry (F16) ----
  // Detect orders where the checkout intended a wallet debit but it failed
  // (buyer_wallet_debit_cents = 0 but session.wallet_debit_cents > 0)

  let walletRetries = 0;
  let walletRetryErrors = 0;

  // Single-item: bulk-fetch sessions to avoid N+1 per-order lookups
  const { data: singleMismatches } = await serviceClient
    .from('orders')
    .select('id, buyer_id, order_number')
    .eq('buyer_wallet_debit_cents', 0)
    .eq('payment_method', 'card')
    .is('cart_group_id', null)
    .gt('created_at', maxCutoff)
    .limit(BATCH_LIMIT);

  if (singleMismatches && singleMismatches.length > 0) {
    const orderNumbers = singleMismatches.map((o) => o.order_number).filter(Boolean);
    const { data: sessions } = await serviceClient
      .from('checkout_sessions')
      .select('order_number, wallet_debit_cents')
      .in('order_number', orderNumbers)
      .gt('wallet_debit_cents', 0);

    const sessionMap = new Map(sessions?.map((s) => [s.order_number, s.wallet_debit_cents]) ?? []);

    for (const order of singleMismatches) {
      const intendedDebit = sessionMap.get(order.order_number);
      if (!intendedDebit) continue; // No mismatch — session had 0 wallet debit

      try {
        // Same order_id as original callback — debitWallet idempotency prevents double-debit
        await debitWallet(
          order.buyer_id,
          intendedDebit,
          order.id,
          `Purchase (retry): ${order.order_number}`
        );

        await serviceClient
          .from('orders')
          .update({ buyer_wallet_debit_cents: intendedDebit })
          .eq('id', order.id)
          .eq('buyer_wallet_debit_cents', 0); // Optimistic lock

        walletRetries++;
        console.log(`[Reconcile] Wallet debit retry succeeded for order ${order.id}: ${intendedDebit} cents`);
      } catch (error) {
        walletRetryErrors++;
        console.error(`[Reconcile] MANUAL ATTENTION: Wallet debit retry failed for order ${order.id}:`, error);
      }
    }
  }

  // Cart: bulk-fetch groups and items to avoid N+1
  const { data: cartMismatches } = await serviceClient
    .from('orders')
    .select('id, buyer_id, order_number, cart_group_id')
    .eq('buyer_wallet_debit_cents', 0)
    .eq('payment_method', 'card')
    .not('cart_group_id', 'is', null)
    .gt('created_at', maxCutoff)
    .limit(BATCH_LIMIT);

  if (cartMismatches && cartMismatches.length > 0) {
    const groupIds = [...new Set(cartMismatches.map((o) => o.cart_group_id).filter(Boolean))];
    const orderIds = cartMismatches.map((o) => o.id);

    const [{ data: groups }, { data: allItems }] = await Promise.all([
      serviceClient.from('cart_checkout_groups').select('id, wallet_allocation').in('id', groupIds),
      serviceClient.from('order_items').select('order_id, listing_id').in('order_id', orderIds),
    ]);

    const groupMap = new Map(groups?.map((g) => [g.id, g.wallet_allocation as Record<string, number>]) ?? []);
    const itemsByOrder = new Map<string, string[]>();
    for (const item of allItems ?? []) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item.listing_id);
      itemsByOrder.set(item.order_id, list);
    }

    for (const order of cartMismatches) {
      const allocation = groupMap.get(order.cart_group_id!);
      if (!allocation) continue;

      const listingIds = itemsByOrder.get(order.id) ?? [];
      const intendedDebit = listingIds.reduce(
        (sum, lid) => sum + (allocation[lid] ?? 0), 0
      );

      if (intendedDebit <= 0) continue;

      try {
        await debitWallet(
          order.buyer_id,
          intendedDebit,
          order.id,
          `Purchase (retry): ${order.order_number}`
        );

        await serviceClient
          .from('orders')
          .update({ buyer_wallet_debit_cents: intendedDebit })
          .eq('id', order.id)
          .eq('buyer_wallet_debit_cents', 0);

        walletRetries++;
        console.log(`[Reconcile] Cart wallet debit retry succeeded for order ${order.id}: ${intendedDebit} cents`);
      } catch (error) {
        walletRetryErrors++;
        console.error(`[Reconcile] MANUAL ATTENTION: Cart wallet debit retry failed for order ${order.id}:`, error);
      }
    }
  }

  return NextResponse.json({
    ...summary,
    walletRetries,
    walletRetryErrors,
  });
}
