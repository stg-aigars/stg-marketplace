/**
 * Monthly VAT close cron (PR C commit 12).
 *
 * Runs day-1 of each month at 01:00 UTC and posts P.1 entries for the
 * previous month's VAT consolidation. Reads cumulative 5710-LV-IN +
 * 5710-LV-OUT movement; computes net direction; emits the 2- or 3-line P.1
 * (refund / payable / zero-net shape).
 *
 * **Layered idempotency — both layers must exist:**
 *
 *   Layer 1 — Engine UNIQUE on (source_doc_type='period_close', source_doc_id,
 *   type_id='P.1'). Catches retry races within the same source_doc_id (e.g.,
 *   Coolify retry + manual curl both firing the cron simultaneously). The
 *   loser sees 23505; engine's recovery returns idempotent_skip.
 *
 *   Layer 2 — Cron-level period skip: query journal_entries for any P.1 in
 *   target.period_key BEFORE attempting emit. Catches DIFFERENT-source_doc_id-
 *   SAME-period scenarios that Layer 1 doesn't see:
 *     - Backfill collisions: May backfill script emits with `phase0_entry_N`
 *       or similar; cron emits with `close_2026_05`. Different source_doc_ids
 *       → UNIQUE doesn't catch → period would accept both without Layer 2.
 *     - Manual emissions: staff posts a P.1 via a one-shot script with a
 *       custom source_doc_id during an operational repair; cron later fires
 *       for the same period.
 *     - Code changes: future PRs that change the cron's source_doc_id pattern
 *       and run the new version against periods where the old pattern's
 *       entries already exist.
 *
 * Without Layer 2, a still-open period could accept two P.1 entries — period-
 * close checklist item 8 would pass spuriously (it queries by `type_id='P.1'`
 * + `accounting_period`, not by source_doc_id), and accountants would have to
 * reconcile two consolidation entries for the same period.
 *
 * **Why Layer 2 isn't redundant with Layer 1:** the engine's UNIQUE is the
 * right shape for retry-race protection but doesn't model "this period
 * already has a different-source_doc_id P.1." That's a cron-domain
 * invariant: at most one P.1 per period regardless of who emitted it.
 *
 * **Note:** PR #296's monthly-depreciation cron does NOT have an explicit
 * Layer 2 guard today (asset-level skips only). It relies on the engine's
 * `enforce_period_status` trigger (migration 094) — hard-locked periods
 * reject all new emits — which protects already-closed periods but not
 * still-open ones with different-source_doc_id prior emissions. Potential
 * consistency followup; flagged in `docs/operations/deployment-state-
 * audit-2026-05-12.md` §4.
 *
 * source_doc_id pattern: `close_<YYYY>_<MM>` (underscore separator; matches
 * April backfill `close_2026_04` + Phase 0 `close_2026_01`).
 *
 * Skipped when 5710-LV-* has no movement at all (matches checklist item 8's
 * not_applicable case). Distinct from the zero-net case where both sides
 * are nonzero and equal — P.1 still fires to clear both sub-accounts.
 *
 * Takes over from manual P.1 backfill (Phase 0 close_2026_01 + April
 * close_2026_04) starting June 2026 (first prod fire targets May 2026 — but
 * the May backfill script likely emits May's P.1 first; Layer 2 cron-level
 * skip catches the collision cleanly, returning a `skipped_period_already_
 * closed` status rather than attempting a duplicate emit).
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
  status:
    | 'created'
    | 'idempotent_skip'
    | 'skipped_no_vat_movement'
    | 'skipped_period_already_closed'  // Layer 2 — different-source_doc_id P.1 already exists for period
    | 'failed'
    | 'failed_period_locked';
  entry_id?: string;
  /**
   * Surfaced on `skipped_period_already_closed` so staff can identify the
   * pre-existing P.1 without a separate dashboard lookup.
   */
  existing_entry_id?: string;
  existing_source_doc_id?: string;
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

  // Layer 2 idempotency — period-level skip. Engine UNIQUE keys on
  // (source_doc_type, source_doc_id, type_id) and only catches retries with
  // the SAME source_doc_id. A P.1 emitted with a different source_doc_id
  // (backfill chains using `phase0_entry_N`; manual one-shot scripts with
  // custom ids; future code changes) would pass UNIQUE and produce a
  // duplicate consolidation entry for the period. This query catches that
  // case BEFORE the emit attempt — same period, same type_id, ANY
  // source_doc_id. See route header for the full rationale.
  const { data: existingP1, error: existingError } = await supabase
    .from('journal_entries')
    .select('id, source_doc_id')
    .eq('accounting_period', target.period_key)
    .eq('type_id', 'P.1')
    .limit(1)
    .maybeSingle();

  if (existingError) {
    const result: CronResult = {
      target_period: target.period_key,
      posting_date: target.posting_date,
      status: 'failed',
      error: `Pre-emit P.1 existence check failed: ${existingError.message}`,
    };
    return NextResponse.json({ ok: false, result }, { status: 500 });
  }

  if (existingP1) {
    const row = existingP1 as { id: string; source_doc_id: string | null };
    const result: CronResult = {
      target_period: target.period_key,
      posting_date: target.posting_date,
      status: 'skipped_period_already_closed',
      existing_entry_id: row.id,
      existing_source_doc_id: row.source_doc_id ?? undefined,
    };
    return NextResponse.json({ ok: true, result });
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
