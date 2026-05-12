import { describe, it, expect } from 'vitest';

import {
  buildDepreciationEvent,
  computeMonthNumber,
  computeMonthlyDepreciationCents,
  computeTargetPeriod,
  type FixedAssetRow,
} from './depreciation-logic';

function macbookAsset(overrides: Partial<FixedAssetRow> = {}): FixedAssetRow {
  return {
    asset_code: 'IT-2026-001',
    acquisition_cost_cents: 151140, // €1,511.40
    useful_life_months: 36,
    depreciation_start_date: '2026-02-28',
    disposed_date: null,
    ...overrides,
  };
}

describe('computeTargetPeriod', () => {
  it('returns the previous month for a mid-year invocation', () => {
    // Day-1-of-June 2026 → target = May 2026, posting_date = 2026-05-31.
    const now = new Date(Date.UTC(2026, 5, 1, 0, 30, 0)); // June 1 (UTC), 00:30
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2026-05',
      posting_date: '2026-05-31',
    });
  });

  it('rolls back to December of previous year for a January invocation', () => {
    const now = new Date(Date.UTC(2027, 0, 1, 0, 30, 0)); // January 1, 2027
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2026-12',
      posting_date: '2026-12-31',
    });
  });

  it('handles February in a non-leap year (28 days)', () => {
    const now = new Date(Date.UTC(2026, 2, 1, 0, 30, 0)); // March 1, 2026
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2026-02',
      posting_date: '2026-02-28',
    });
  });

  it('handles February in a leap year (29 days)', () => {
    const now = new Date(Date.UTC(2028, 2, 1, 0, 30, 0)); // March 1, 2028 (leap year)
    expect(computeTargetPeriod(now)).toEqual({
      period_key: '2028-02',
      posting_date: '2028-02-29',
    });
  });

  it('handles months with 30 days correctly', () => {
    // April (30 days), June (30), September (30), November (30)
    const now = new Date(Date.UTC(2026, 4, 1, 0, 30, 0)); // May 1, 2026
    expect(computeTargetPeriod(now).posting_date).toBe('2026-04-30');
  });

  it('handles months with 31 days correctly', () => {
    const now = new Date(Date.UTC(2026, 1, 1, 0, 30, 0)); // February 1, 2026
    expect(computeTargetPeriod(now).posting_date).toBe('2026-01-31');
  });

  it('returns posting_date matching the period_key year-month', () => {
    // Across a year boundary, posting_date YYYY-MM must match period_key.
    const now = new Date(Date.UTC(2027, 0, 1, 12, 0, 0));
    const result = computeTargetPeriod(now);
    expect(result.posting_date.startsWith(result.period_key)).toBe(true);
  });
});

describe('computeMonthNumber', () => {
  it('returns 1 for the period matching depreciation_start_date', () => {
    const asset = macbookAsset(); // start 2026-02-28
    const target = { period_key: '2026-02', posting_date: '2026-02-28' };
    expect(computeMonthNumber(asset, target)).toBe(1);
  });

  it('returns 4 for May 2026 with start in Feb 2026', () => {
    const asset = macbookAsset();
    const target = { period_key: '2026-05', posting_date: '2026-05-31' };
    expect(computeMonthNumber(asset, target)).toBe(4);
  });

  it('returns 12 for Jan 2027 with start in Feb 2026 (crosses year boundary)', () => {
    const asset = macbookAsset();
    const target = { period_key: '2027-01', posting_date: '2027-01-31' };
    expect(computeMonthNumber(asset, target)).toBe(12);
  });

  it('returns 36 for Jan 2029 with start in Feb 2026 (last month of useful life)', () => {
    const asset = macbookAsset();
    const target = { period_key: '2029-01', posting_date: '2029-01-31' };
    expect(computeMonthNumber(asset, target)).toBe(36);
  });

  it('returns null for a period before depreciation start', () => {
    const asset = macbookAsset(); // start 2026-02-28
    const target = { period_key: '2026-01', posting_date: '2026-01-31' };
    expect(computeMonthNumber(asset, target)).toBeNull();
  });

  it('returns null for several years before depreciation start', () => {
    const asset = macbookAsset();
    const target = { period_key: '2025-12', posting_date: '2025-12-31' };
    expect(computeMonthNumber(asset, target)).toBeNull();
  });
});

describe('computeMonthlyDepreciationCents', () => {
  it('returns 4198 for IT-2026-001 (€1,511.40 / 36 months, truncated)', () => {
    // 151140 / 36 = 4198.333... → 4198 (matches Phase 0 Entries 19, 20).
    expect(computeMonthlyDepreciationCents(macbookAsset())).toBe(4198);
  });

  it('truncates toward zero (does not round)', () => {
    // 1000 / 7 = 142.857... → 142 (Math.trunc).
    expect(computeMonthlyDepreciationCents(macbookAsset({
      acquisition_cost_cents: 1000,
      useful_life_months: 7,
    }))).toBe(142);
  });

  it('returns exact division when it divides cleanly', () => {
    expect(computeMonthlyDepreciationCents(macbookAsset({
      acquisition_cost_cents: 12000,
      useful_life_months: 12,
    }))).toBe(1000);
  });
});

describe('buildDepreciationEvent', () => {
  it('builds a P.6 PostingEvent for IT-2026-001 in May 2026 (month 4 of 36)', () => {
    const asset = macbookAsset();
    const target = { period_key: '2026-05', posting_date: '2026-05-31' };
    const result = buildDepreciationEvent(asset, target);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.event.event_type).toBe('cron.monthly_depreciation');
    expect(result.event.source_doc_type).toBe('monthly_depreciation');
    expect(result.event.source_doc_id).toBe('depreciation_IT-2026-001_2026-05');
    expect(result.event.posting_date).toBe('2026-05-31');
    expect(result.event.accounting_period).toBe('2026-05');
    expect(result.event.tax_period).toBe('2026-05');
    expect(result.event.payload).toMatchObject({
      emission_source: 'cron',
      asset_code: 'IT-2026-001',
      month_number: 4,
      of_total: 36,
      depreciation_cents: 4198,
    });
    expect(result.event.payload.backfill).toBeUndefined();
  });

  it('skips a disposed asset', () => {
    const asset = macbookAsset({ disposed_date: '2026-04-15' });
    const target = { period_key: '2026-05', posting_date: '2026-05-31' };
    const result = buildDepreciationEvent(asset, target);
    expect(result).toEqual({ status: 'skip', reason: 'disposed' });
  });

  it('skips when target is before depreciation start', () => {
    const asset = macbookAsset(); // start 2026-02
    const target = { period_key: '2026-01', posting_date: '2026-01-31' };
    const result = buildDepreciationEvent(asset, target);
    expect(result).toEqual({ status: 'skip', reason: 'before_depreciation_start' });
  });

  it('skips when asset is fully depreciated (month > of_total)', () => {
    const asset = macbookAsset(); // start 2026-02, 36 months → ends Jan 2029
    const target = { period_key: '2029-02', posting_date: '2029-02-28' };
    const result = buildDepreciationEvent(asset, target);
    expect(result).toEqual({ status: 'skip', reason: 'fully_depreciated' });
  });

  it('still depreciates on the final month (month_number = of_total)', () => {
    const asset = macbookAsset(); // start 2026-02, 36 months → month 36 = Jan 2029
    const target = { period_key: '2029-01', posting_date: '2029-01-31' };
    const result = buildDepreciationEvent(asset, target);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.event.payload).toMatchObject({ month_number: 36, of_total: 36 });
  });

  it('embeds the period_key in the narrative for log readability', () => {
    const asset = macbookAsset();
    const target = { period_key: '2026-05', posting_date: '2026-05-31' };
    const result = buildDepreciationEvent(asset, target);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.event.narrative).toContain('IT-2026-001');
    expect(result.event.narrative).toContain('€41.98');
    expect(result.event.narrative).toContain('month 4 of 36');
  });
});
