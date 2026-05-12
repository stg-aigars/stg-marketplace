/**
 * Monthly VAT close cron (PR C commit 12).
 *
 * Runs day-1 of each month at 01:00 UTC and posts P.1 entries for the
 * previous month's VAT consolidation. Reads cumulative 5710-LV-IN +
 * 5710-LV-OUT movement; computes net direction; emits the 2- or 3-line P.1
 * (refund / payable / zero-net shape).
 *
 * source_doc_id pattern: `close_<YYYY>_<MM>` (underscore separator; matches
 * April backfill `close_2026_04` + Phase 0 `close_2026_01`). UNIQUE on
 * (source_doc_type='period_close', source_doc_id, type_id='P.1') makes
 * re-runs idempotent_skip.
 *
 * Skipped when 5710-LV-* has no movement at all (matches checklist item 8's
 * not_applicable case). Distinct from the zero-net case where both sides
 * are nonzero and equal — P.1 still fires to clear both sub-accounts.
 *
 * Takes over from manual P.1 backfill (Phase 0 close_2026_01 + April
 * close_2026_04) starting June 2026 (first prod fire targets May 2026 — but
 * the May backfill script likely emits May's P.1 first; idempotency catches
 * the collision).
 *
 * Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/monthly-vat-close
 *
 * Schedule: `0 1 1 * *` (01:00 UTC on day 1 of every month; offset 30min
 * from monthly-depreciation's `30 0 1 * *` to avoid simultaneous engine
 * RPC contention).
 */

import { NextResponse } from 'next/server';

import { buildVatClosingEvent } from '@/lib/accounting/lifecycle-events';
import { emit } from '@/lib/accounting/posting-engine';
import { getNetVatPositionForPeriod, getPeriodRow } from '@/lib/accounting/queries';
import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase';

import { computeTargetPeriod } from './vat-close-logic';

interface CronResult {
  target_period: string;
  posting_date: string;
  status: 'created' | 'idempotent_skip' | 'skipped_no_vat_movement' | 'failed' | 'failed_period_locked';
  entry_id?: string;
  net_payable_to_vid_cents?: number;
  lines_count?: number;
  error?: string;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const target = computeTargetPeriod(new Date());

  // Q12-3 sign-off: pre-check period state. If the previous month is already
  // soft_locked or hard_locked, the enforce_period_status trigger would
  // reject the emit with a check_violation 500 — surfacing a descriptive
  // failure here is cheaper to debug than a generic engine error.
  let period;
  try {
    period = await getPeriodRow(supabase, target.period_key, 'month');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'period read failed';
    const result: CronResult = {
      target_period: target.period_key,
      posting_date: target.posting_date,
      status: 'failed',
      error: `Period read failed: ${message}`,
    };
    return NextResponse.json({ ok: false, result }, { status: 500 });
  }

  if (!period) {
    const result: CronResult = {
      target_period: target.period_key,
      posting_date: target.posting_date,
      status: 'failed',
      error: `Period ${target.period_key} not seeded in public.periods (period_type=month)`,
    };
    return NextResponse.json({ ok: false, result }, { status: 500 });
  }

  if (period.status !== 'open') {
    const result: CronResult = {
      target_period: target.period_key,
      posting_date: target.posting_date,
      status: 'failed_period_locked',
      error: `Period ${target.period_key} is ${period.status}; only open periods can receive P.1 closing entries`,
    };
    return NextResponse.json({ ok: false, result }, { status: 500 });
  }

  // Read net VAT position from GL
  const netPosition = await getNetVatPositionForPeriod(supabase, target);

  if (netPosition.has_no_movement) {
    const result: CronResult = {
      target_period: target.period_key,
      posting_date: target.posting_date,
      status: 'skipped_no_vat_movement',
      net_payable_to_vid_cents: 0,
    };
    return NextResponse.json({ ok: true, result });
  }

  // Build event. Q12-7a sign-off: net_refund_cents is the legacy sign
  // (positive = refund, negative = payable); net_payable_to_vid_cents is the
  // direction-explicit sibling. NetVatPosition's net_payable_to_vid_cents
  // matches the sibling convention.
  const event = buildVatClosingEvent({
    closing_period: target.period_key,
    posting_date: target.posting_date,
    net_refund_cents: -netPosition.net_payable_to_vid_cents,
    net_payable_to_vid_cents: netPosition.net_payable_to_vid_cents,
    lines: netPosition.lines,
    actor_id: 'monthly-vat-close-cron',
  });

  // Emit via engine
  const emitResult = await emit(supabase, event);

  if (emitResult.status === 'failed') {
    const result: CronResult = {
      target_period: target.period_key,
      posting_date: target.posting_date,
      status: 'failed',
      net_payable_to_vid_cents: netPosition.net_payable_to_vid_cents,
      lines_count: netPosition.lines.length,
      error: emitResult.error,
    };
    return NextResponse.json({ ok: false, result }, { status: 500 });
  }

  const result: CronResult = {
    target_period: target.period_key,
    posting_date: target.posting_date,
    status: emitResult.status,
    entry_id: emitResult.entry_id,
    net_payable_to_vid_cents: netPosition.net_payable_to_vid_cents,
    lines_count: netPosition.lines.length,
  };
  return NextResponse.json({ ok: true, result });
}
