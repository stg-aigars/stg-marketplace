/**
 * DAC7 reconciliation + escalation cron.
 * Runs daily. Reconciles seller stats from completed orders,
 * evaluates threshold crossings, and escalates reminder/blocked statuses.
 *
 * Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/dac7-reconcile
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { notify } from '@/lib/notifications';
import {
  DAC7_WARN_TRANSACTIONS,
  DAC7_WARN_CONSIDERATION_CENTS,
  DAC7_REPORT_TRANSACTIONS,
  DAC7_REPORT_CONSIDERATION_CENTS,
  DAC7_REMINDER_DAYS,
} from '@/lib/dac7/constants';
import type { Dac7SellerStatus } from '@/lib/dac7/types';

interface CronResult {
  reconciled: number;
  yearResets: number;
  escalated: number;
  blocked: number;
  errors: string[];
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const result: CronResult = { reconciled: 0, yearResets: 0, escalated: 0, blocked: 0, errors: [] };

  try {
    // ─── Part A: Reconcile stats from completed orders ───
    const { data: orderStats, error: statsError } = await supabase
      .rpc('dac7_reconcile_stats', { p_year: currentYear });

    // Fallback if RPC doesn't exist: raw query
    if (statsError) {
      const { data: rawStats } = await supabase
        .from('orders')
        .select('seller_id, items_total_cents, platform_commission_cents, completed_at')
        .eq('status', 'completed')
        .gte('completed_at', `${currentYear}-01-01T00:00:00Z`)
        .lt('completed_at', `${currentYear + 1}-01-01T00:00:00Z`);

      if (rawStats) {
        // Aggregate in JS
        const aggregated = new Map<string, { count: number; cents: number }>();
        for (const row of rawStats) {
          const sellerId = row.seller_id;
          const consideration = row.items_total_cents - (row.platform_commission_cents ?? 0);
          const existing = aggregated.get(sellerId) ?? { count: 0, cents: 0 };
          aggregated.set(sellerId, {
            count: existing.count + 1,
            cents: existing.cents + consideration,
          });
        }

        // Upsert each seller's stats
        for (const [sellerId, stats] of aggregated) {
          const { error: upsertErr } = await supabase
            .from('dac7_seller_annual_stats')
            .upsert({
              seller_id: sellerId,
              calendar_year: currentYear,
              completed_transaction_count: stats.count,
              total_consideration_cents: stats.cents,
              updated_at: now.toISOString(),
            }, { onConflict: 'seller_id,calendar_year' });

          if (upsertErr) {
            result.errors.push(`Reconcile ${sellerId}: ${upsertErr.message}`);
          } else {
            result.reconciled++;
          }
        }
      }
    } else {
      result.reconciled = Array.isArray(orderStats) ? orderStats.length : 0;
    }

    // ─── Part B: Year-start reset (January only) ───
    if (currentMonth === 1) {
      // Check PRIOR year stats to decide resets
      const priorYear = currentYear - 1;

      // Find sellers with actionable statuses who did NOT cross the regulatory threshold last year
      const { data: actionableSellers } = await supabase
        .from('user_profiles')
        .select('id, dac7_status')
        .in('dac7_status', ['approaching', 'data_requested', 'reminder_sent', 'blocked']);

      if (actionableSellers) {
        for (const seller of actionableSellers) {
          // Check prior year stats
          const { data: priorStats } = await supabase
            .from('dac7_seller_annual_stats')
            .select('completed_transaction_count, total_consideration_cents')
            .eq('seller_id', seller.id)
            .eq('calendar_year', priorYear)
            .single();

          const crossedRegulatory = priorStats &&
            (priorStats.completed_transaction_count >= DAC7_REPORT_TRANSACTIONS ||
             priorStats.total_consideration_cents >= DAC7_REPORT_CONSIDERATION_CENTS);

          // If blocked AND crossed regulatory: stay blocked (they owe data for prior year)
          if (seller.dac7_status === 'blocked' && crossedRegulatory) continue;

          // Otherwise: reset to not_applicable for the new year
          if (!crossedRegulatory) {
            await supabase
              .from('user_profiles')
              .update({
                dac7_status: 'not_applicable',
                dac7_status_updated_at: now.toISOString(),
              })
              .eq('id', seller.id);
            result.yearResets++;
          }
        }
      }
    }

    // ─── Part C: Threshold escalation ───
    // Fetch all stats for current year with seller status
    const { data: allStats } = await supabase
      .from('dac7_seller_annual_stats')
      .select('seller_id, completed_transaction_count, total_consideration_cents')
      .eq('calendar_year', currentYear);

    if (allStats) {
      // Get profiles for sellers with stats
      const sellerIds = allStats.map((s) => s.seller_id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, dac7_status, email')
        .in('id', sellerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: { id: string; dac7_status: Dac7SellerStatus; email: string | null }) => [p.id, p])
      );

      for (const stats of allStats) {
        const profile = profileMap.get(stats.seller_id);
        if (!profile) continue;

        const crossedRegulatory =
          stats.completed_transaction_count >= DAC7_REPORT_TRANSACTIONS ||
          stats.total_consideration_cents >= DAC7_REPORT_CONSIDERATION_CENTS;

        const crossedWarning =
          stats.completed_transaction_count >= DAC7_WARN_TRANSACTIONS ||
          stats.total_consideration_cents >= DAC7_WARN_CONSIDERATION_CENTS;

        // not_applicable → approaching (warning threshold, no timer — notification only)
        if (crossedWarning && !crossedRegulatory && profile.dac7_status === 'not_applicable') {
          await supabase
            .from('user_profiles')
            .update({ dac7_status: 'approaching', dac7_status_updated_at: now.toISOString() })
            .eq('id', stats.seller_id);
          void notify(stats.seller_id, 'dac7.approaching');
          result.escalated++;
        }

        // not_applicable or approaching → data_requested (regulatory threshold)
        if (crossedRegulatory && (profile.dac7_status === 'not_applicable' || profile.dac7_status === 'approaching')) {
          await supabase
            .from('user_profiles')
            .update({
              dac7_status: 'data_requested',
              dac7_status_updated_at: now.toISOString(),
              dac7_first_reminder_sent_at: now.toISOString(),
            })
            .eq('id', stats.seller_id);
          void notify(stats.seller_id, 'dac7.data_requested');
          result.escalated++;
        }
      }
    }

    // ─── Part D: Reminder escalation (time-based) ───
    const reminderCutoff = new Date(now);
    reminderCutoff.setDate(reminderCutoff.getDate() - DAC7_REMINDER_DAYS);

    // data_requested → reminder_sent (14 days after first reminder)
    const { data: needsReminder } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('dac7_status', 'data_requested')
      .lt('dac7_first_reminder_sent_at', reminderCutoff.toISOString());

    for (const seller of needsReminder ?? []) {
      await supabase
        .from('user_profiles')
        .update({
          dac7_status: 'reminder_sent',
          dac7_status_updated_at: now.toISOString(),
          dac7_second_reminder_sent_at: now.toISOString(),
        })
        .eq('id', seller.id);
      void notify(seller.id, 'dac7.reminder');
      result.escalated++;
    }

    // reminder_sent → blocked (14 days after second reminder)
    const { data: needsBlock } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('dac7_status', 'reminder_sent')
      .lt('dac7_second_reminder_sent_at', reminderCutoff.toISOString());

    for (const seller of needsBlock ?? []) {
      await supabase
        .from('user_profiles')
        .update({
          dac7_status: 'blocked',
          dac7_status_updated_at: now.toISOString(),
        })
        .eq('id', seller.id);
      void notify(seller.id, 'dac7.blocked');
      result.blocked++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(message);
    console.error('[Cron] DAC7 reconciliation error:', message);
  }

  return NextResponse.json(result);
}
