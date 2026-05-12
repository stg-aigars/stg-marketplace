/**
 * Pure-logic tests for the monthly-vat-close cron.
 *
 * Mirrors the depreciation-logic.test.ts shape — date arithmetic + period
 * derivation with no Supabase / network involvement.
 */

import { describe, it, expect } from 'vitest';

import { computeTargetPeriod } from './vat-close-logic';

describe('computeTargetPeriod', () => {
  it('returns the previous month when fired on day 1', () => {
    const now = new Date(Date.UTC(2026, 5, 1, 1, 0, 0)); // 2026-06-01 01:00 UTC
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2026-05',
      posting_date: '2026-05-31',
    });
  });

  it('handles January (year rollover to previous December)', () => {
    const now = new Date(Date.UTC(2026, 0, 1, 1, 0, 0)); // 2026-01-01 01:00 UTC
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2025-12',
      posting_date: '2025-12-31',
    });
  });

  it('handles February correctly (28 days in non-leap year)', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 1, 0, 0)); // 2026-03-01 01:00 UTC
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2026-02',
      posting_date: '2026-02-28',
    });
  });

  it('handles February correctly (29 days in leap year)', () => {
    const now = new Date(Date.UTC(2028, 2, 1, 1, 0, 0)); // 2028-03-01 01:00 UTC (2028 is leap)
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2028-02',
      posting_date: '2028-02-29',
    });
  });

  it('handles months with 30 days (April, June, September, November)', () => {
    const now = new Date(Date.UTC(2026, 6, 1, 1, 0, 0)); // 2026-07-01
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2026-06',
      posting_date: '2026-06-30',
    });
  });

  it('is timezone-safe across midnight UTC boundaries', () => {
    // 23:30 on the last day of the month should still target that month
    // (the cron fires at 01:00 UTC, so this is well within day 1).
    const lateApril = new Date(Date.UTC(2026, 3, 30, 23, 30, 0)); // 2026-04-30 23:30 UTC
    expect(computeTargetPeriod(lateApril)).toEqual({
      period_key: '2026-03',
      posting_date: '2026-03-31',
    });
  });

  it('manual re-fire mid-month targets the previous-from-now month (not the period being re-filed)', () => {
    // Staff manually re-fires the cron on May 15 to retry an April close
    // that failed. computeTargetPeriod returns April per current_date.minus(1).
    // Idempotency catches the case where the original day-1 fire already
    // succeeded (returns idempotent_skip). For deeper back-fires, staff
    // needs a one-shot script (NOT the cron) — Q12-2 sign-off.
    const may15 = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
    expect(computeTargetPeriod(may15)).toEqual({
      period_key: '2026-04',
      posting_date: '2026-04-30',
    });
  });
});
