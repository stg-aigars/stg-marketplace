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

  return NextResponse.json(summary);
}
