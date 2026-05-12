/**
 * Monthly-depreciation cron — pure logic.
 *
 * Split out from `route.ts` so the date arithmetic + event construction can be
 * unit-tested without mocking the Supabase client or Next.js Request. The
 * route handles I/O + orchestration; this module handles "given now and an
 * asset row, what P.6 event should we emit?"
 *
 * Posting cadence: cron runs on day 1 of each month and posts depreciation
 * for the PREVIOUS month (target_period = month before now). Posting_date is
 * always the last day of the target month.
 */

import type { PostingEvent } from '@/lib/accounting/types';

export interface FixedAssetRow {
  asset_code: string;
  acquisition_cost_cents: number;
  useful_life_months: number;
  depreciation_start_date: string; // YYYY-MM-DD; matches month 1 posting_date
  disposed_date: string | null;
}

export interface TargetPeriod {
  /** YYYY-MM */
  period_key: string;
  /** YYYY-MM-DD — last day of the target month */
  posting_date: string;
}

export type BuildEventResult =
  | { status: 'ok'; event: PostingEvent }
  | { status: 'skip'; reason: 'disposed' | 'before_depreciation_start' | 'fully_depreciated' };

/**
 * Compute the period to depreciate based on a "now" timestamp.
 *
 * Strategy: target = month before `now`. Cron runs day-1-of-month and depreciates
 * the month that just ended. This keeps the cron schedule decoupled from the
 * posting_date math.
 *
 * @param now - typically `new Date()` from the route handler; passed in for testability
 */
export function computeTargetPeriod(now: Date): TargetPeriod {
  // getUTCMonth() returns 0-11 (0 = January). Compute previous month with year
  // rollover for January.
  const nowYear = now.getUTCFullYear();
  const nowMonth0 = now.getUTCMonth(); // 0-indexed
  let prevYear = nowYear;
  let prevMonth0 = nowMonth0 - 1;
  if (prevMonth0 < 0) {
    prevMonth0 = 11;
    prevYear -= 1;
  }

  // Last day of prev month: day-0 of (prev_month + 1) rolls back one day.
  // E.g. Date.UTC(2026, 5, 0) → 2026-05-31 (May 31 = "day 0 of June" rolled back).
  const lastDayDate = new Date(Date.UTC(prevYear, prevMonth0 + 1, 0));
  const yyyy = String(prevYear);
  const mm = String(prevMonth0 + 1).padStart(2, '0');
  const dd = String(lastDayDate.getUTCDate()).padStart(2, '0');

  return {
    period_key: `${yyyy}-${mm}`,
    posting_date: `${yyyy}-${mm}-${dd}`,
  };
}

/**
 * Compute month_number for an asset at a target period. month 1 = the period
 * matching the asset's `depreciation_start_date`. Returns null when the target
 * is before the asset's depreciation start (e.g. asset acquired after the
 * target month).
 */
export function computeMonthNumber(asset: FixedAssetRow, target: TargetPeriod): number | null {
  const [startYearStr, startMonthStr] = asset.depreciation_start_date.split('-');
  const startYear = Number(startYearStr);
  const startMonth = Number(startMonthStr); // 1-indexed

  const [targetYearStr, targetMonthStr] = target.period_key.split('-');
  const targetYear = Number(targetYearStr);
  const targetMonth = Number(targetMonthStr); // 1-indexed

  const monthsBetween = (targetYear - startYear) * 12 + (targetMonth - startMonth);
  const month_number = monthsBetween + 1;
  return month_number >= 1 ? month_number : null;
}

/**
 * Per-asset monthly depreciation (acquisition_cost_cents / useful_life_months,
 * truncated toward zero to keep integer cents — matches Phase 0 convention
 * where IT-2026-001's €1,511.40 / 36 = €41.983... → €41.98/month).
 */
export function computeMonthlyDepreciationCents(asset: FixedAssetRow): number {
  return Math.trunc(asset.acquisition_cost_cents / asset.useful_life_months);
}

/**
 * Build the PostingEvent for one asset + target period. Returns a `skip`
 * result when the asset is disposed, the target is before depreciation
 * starts, or the asset is fully depreciated.
 */
export function buildDepreciationEvent(asset: FixedAssetRow, target: TargetPeriod): BuildEventResult {
  if (asset.disposed_date !== null) {
    return { status: 'skip', reason: 'disposed' };
  }

  const month_number = computeMonthNumber(asset, target);
  if (month_number === null) {
    return { status: 'skip', reason: 'before_depreciation_start' };
  }
  if (month_number > asset.useful_life_months) {
    return { status: 'skip', reason: 'fully_depreciated' };
  }

  const depreciation_cents = computeMonthlyDepreciationCents(asset);

  const source_doc_id = `depreciation_${asset.asset_code}_${target.period_key}`;
  const narrative =
    `Monthly depreciation ${asset.asset_code} ${formatEur(depreciation_cents)} ` +
    `(month ${month_number} of ${asset.useful_life_months})`;

  const event: PostingEvent = {
    event_type: 'cron.monthly_depreciation',
    source_doc_type: 'monthly_depreciation',
    source_doc_id,
    posting_date: target.posting_date,
    accounting_period: target.period_key,
    tax_period: target.period_key,
    narrative,
    // emission_source moved from payload to the typed PostingEvent field
    // (PR C commit 9 / Q6 Option A). The engine merges it into posting_context
    // automatically; the resulting journal_entries.posting_context.emission_source
    // value is byte-identical to the prior payload-inject convention.
    emission_source: 'cron',
    payload: {
      asset_code: asset.asset_code,
      month_number,
      of_total: asset.useful_life_months,
      depreciation_cents,
    },
  };

  return { status: 'ok', event };
}

/** Format an integer-cents value as a euro string for narrative text. */
function formatEur(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}€${euros}.${String(remainder).padStart(2, '0')}`;
}
