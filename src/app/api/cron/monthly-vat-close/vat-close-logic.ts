/**
 * Monthly-vat-close cron — pure logic.
 *
 * Split out from `route.ts` so the date arithmetic + narrative construction
 * can be unit-tested without mocking Supabase or Next.js Request. Mirrors the
 * monthly-depreciation cron's `depreciation-logic.ts` split (PR #296).
 *
 * Posting cadence: cron runs on day 1 of each month and posts P.1 for the
 * PREVIOUS month (target_period = month before now). Posting_date is the
 * last day of the target month (same convention as April backfill's
 * close_2026_04 posting on 2026-04-30).
 */

export interface VatCloseTargetPeriod {
  /** YYYY-MM */
  period_key: string;
  /** YYYY-MM-DD — last day of the target month */
  posting_date: string;
}

/**
 * Compute the period to close based on a "now" timestamp. Target = month
 * before `now`. Cron runs day-1-of-month at 01:00 UTC and closes the month
 * that just ended.
 *
 * @param now - typically `new Date()` from the route handler; passed in for testability
 */
export function computeTargetPeriod(now: Date): VatCloseTargetPeriod {
  const nowYear = now.getUTCFullYear();
  const nowMonth0 = now.getUTCMonth(); // 0-indexed
  let prevYear = nowYear;
  let prevMonth0 = nowMonth0 - 1;
  if (prevMonth0 < 0) {
    prevMonth0 = 11;
    prevYear -= 1;
  }

  // Last day of prev month: day-0 of (prev_month + 1) rolls back one day.
  // E.g. Date.UTC(2026, 5, 0) → 2026-05-31. Same idiom as depreciation-logic.ts.
  const lastDayDate = new Date(Date.UTC(prevYear, prevMonth0 + 1, 0));
  const yyyy = String(prevYear);
  const mm = String(prevMonth0 + 1).padStart(2, '0');
  const dd = String(lastDayDate.getUTCDate()).padStart(2, '0');

  return {
    period_key: `${yyyy}-${mm}`,
    posting_date: `${yyyy}-${mm}-${dd}`,
  };
}
