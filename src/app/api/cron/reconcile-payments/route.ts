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
import { getPaymentStatus } from '@/lib/services/everypay';
import { SUCCESSFUL_STATES, FAILED_STATES } from '@/lib/services/everypay/types';
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

  const orderCutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();

  // Single-item: join orders to checkout_sessions via order_number
  const { data: singleMismatches } = await serviceClient
    .from('orders')
    .select('id, buyer_id, order_number')
    .eq('buyer_wallet_debit_cents', 0)
    .eq('payment_method', 'card')
    .is('cart_group_id', null)
    .gt('created_at', orderCutoff)
    .limit(BATCH_LIMIT);

  if (singleMismatches && singleMismatches.length > 0) {
    for (const order of singleMismatches) {
      try {
        // Find the checkout session to get intended wallet debit
        const { data: session } = await serviceClient
          .from('checkout_sessions')
          .select('wallet_debit_cents')
          .eq('order_number', order.order_number)
          .gt('wallet_debit_cents', 0)
          .single();

        if (!session) continue; // No mismatch — session had 0 wallet debit

        // Same order_id as original callback — debitWallet idempotency prevents double-debit
        await debitWallet(
          order.buyer_id,
          session.wallet_debit_cents,
          order.id,
          `Purchase (retry): ${order.order_number}`
        );

        await serviceClient
          .from('orders')
          .update({ buyer_wallet_debit_cents: session.wallet_debit_cents })
          .eq('id', order.id)
          .eq('buyer_wallet_debit_cents', 0); // Optimistic lock

        walletRetries++;
        console.log(`[Reconcile] Wallet debit retry succeeded for order ${order.id}: ${session.wallet_debit_cents} cents`);
      } catch (error) {
        walletRetryErrors++;
        console.error(`[Reconcile] MANUAL ATTENTION: Wallet debit retry failed for order ${order.id}:`, error);
      }
    }
  }

  // Cart: join orders to cart_checkout_groups via cart_group_id
  const { data: cartMismatches } = await serviceClient
    .from('orders')
    .select('id, buyer_id, order_number, cart_group_id')
    .eq('buyer_wallet_debit_cents', 0)
    .eq('payment_method', 'card')
    .not('cart_group_id', 'is', null)
    .gt('created_at', orderCutoff)
    .limit(BATCH_LIMIT);

  if (cartMismatches && cartMismatches.length > 0) {
    for (const order of cartMismatches) {
      try {
        const { data: group } = await serviceClient
          .from('cart_checkout_groups')
          .select('wallet_allocation')
          .eq('id', order.cart_group_id)
          .single();

        if (!group?.wallet_allocation) continue;

        // Sum wallet allocation for items in this order
        const { data: orderItems } = await serviceClient
          .from('order_items')
          .select('listing_id')
          .eq('order_id', order.id);

        if (!orderItems) continue;

        const allocation = group.wallet_allocation as Record<string, number>;
        const intendedDebit = orderItems.reduce(
          (sum, item) => sum + (allocation[item.listing_id] ?? 0), 0
        );

        if (intendedDebit <= 0) continue;

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
