/**
 * Trader-volume signals cron (Phase 7 of PTAC plan).
 * Runs daily. Aggregates per-seller rolling 12-month order counts + revenue,
 * writes counters to user_profiles, and fires seller.trader_signal_crossed
 * the first time a seller crosses the verification trigger (25 sales OR €1,800
 * revenue per TRADER_THRESHOLDS).
 *
 * Architectural note: separate from dac7-reconcile because tax reporting and
 * trader-status enforcement have different SLAs and different failure modes.
 * If trader-signals fails for a day, advisory data is stale and staff sees it.
 * If dac7-reconcile fails for a day, tax data is wrong — different category
 * of problem.
 *
 * Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/trader-signals
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { logAuditEvent } from '@/lib/services/audit';
import {
  TRADER_THRESHOLDS,
  evaluateTraderSignal,
  triggeredBy,
} from '@/lib/seller/trader-thresholds';

interface CronResult {
  reconciled: number;
  signalsCrossed: number;
  errors: string[];
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const result: CronResult = { reconciled: 0, signalsCrossed: 0, errors: [] };

  // 12-month window from now
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  try {
    // ─── Aggregate completed orders per seller, last 12 months ───
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('seller_id, items_total_cents, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', twelveMonthsAgo.toISOString());

    if (ordersError) {
      result.errors.push(`orders aggregation: ${ordersError.message}`);
      return NextResponse.json({ ok: false, result }, { status: 500 });
    }

    const counters = new Map<string, { count: number; revenueCents: number }>();
    for (const order of orders ?? []) {
      const existing = counters.get(order.seller_id) ?? { count: 0, revenueCents: 0 };
      existing.count += 1;
      existing.revenueCents += order.items_total_cents ?? 0;
      counters.set(order.seller_id, existing);
    }

    // ─── Per seller: write counters; first-crossing → audit + first-crossed-at stamp ───
    for (const [sellerId, c] of counters.entries()) {
      // Load current state to detect first crossing
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('trader_signal_first_crossed_at, seller_status')
        .eq('id', sellerId)
        .single();

      if (profileError || !profile) {
        result.errors.push(`load profile ${sellerId}: ${profileError?.message ?? 'not found'}`);
        continue;
      }

      // Always write current counters (cheap, gives staff dashboard live numbers)
      const signal = evaluateTraderSignal(c);
      const firstCrossing = signal === 'verify' && !profile.trader_signal_first_crossed_at;

      const update: Record<string, unknown> = {
        completed_sales_12mo_count: c.count,
        completed_sales_12mo_revenue_cents: c.revenueCents,
      };

      if (firstCrossing) {
        update.trader_signal_first_crossed_at = new Date().toISOString();
        update.trader_signal_threshold_version = TRADER_THRESHOLDS.version;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(update)
        .eq('id', sellerId);

      if (updateError) {
        result.errors.push(`update profile ${sellerId}: ${updateError.message}`);
        continue;
      }

      result.reconciled += 1;

      if (firstCrossing) {
        result.signalsCrossed += 1;
        void logAuditEvent({
          actorType: 'cron',
          action: 'seller.trader_signal_crossed',
          resourceType: 'user',
          resourceId: sellerId,
          metadata: {
            count: c.count,
            revenue_cents: c.revenueCents,
            threshold_version: TRADER_THRESHOLDS.version,
            enforcement: TRADER_THRESHOLDS.enforcement,
            triggered_by: triggeredBy(c),
          },
        });
      }

      // Future-flip path: if enforcement === 'automatic', this branch would
      // mutate seller_status. Unreachable at launch (advisory mode); the
      // existence here keeps the flip a one-line constant change.
      if (TRADER_THRESHOLDS.enforcement === 'automatic' && firstCrossing) {
        // Intentionally unreachable until TRADER_THRESHOLDS.enforcement flips.
        // Tested in src/lib/seller/trader-thresholds.test.ts to keep the path
        // green during the cron's lifetime. When the flip lands, this becomes
        // an UPDATE seller_status to 'warned' or 'suspended' depending on
        // future suspendThreshold values.
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`unexpected: ${message}`);
    return NextResponse.json({ ok: false, result }, { status: 500 });
  }
}
