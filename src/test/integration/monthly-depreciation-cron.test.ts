/**
 * Monthly-depreciation cron — integration test.
 *
 * Exercises the emit path end-to-end against a real local Supabase: builds a
 * P.6 event via the cron's pure logic module, passes it to the engine's
 * emit(), verifies the journal_entries + journal_lines shape, and confirms
 * idempotency on re-emit (UNIQUE on (source_doc_type, source_doc_id, type_id)
 * makes the second call return the same entry_id with status='idempotent_skip').
 *
 * Uses a synthetic test asset (TEST-DEPR-001) not in the production seed, so
 * the test doesn't interfere with IT-2026-001's depreciation chain. All
 * entries persist (immutability trigger blocks DELETE on journal_entries) but
 * land in period 2027-01 well outside any production reporting period.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { emit } from '@/lib/accounting/posting-engine';

import { createTestServiceClient } from '../helpers/supabase';

import {
  buildDepreciationEvent,
  type FixedAssetRow,
} from '../../app/api/cron/monthly-depreciation/depreciation-logic';

const supabase = createTestServiceClient();

const TEST_ASSET: FixedAssetRow = {
  asset_code: 'TEST-DEPR-001',
  acquisition_cost_cents: 360000, // €3,600 / 36 months = €100 per month (clean math)
  useful_life_months: 36,
  depreciation_start_date: '2027-01-31',
  disposed_date: null,
};

// Target a far-future period to keep test artifacts isolated from any
// production reporting window.
const TARGET = { period_key: '2027-01', posting_date: '2027-01-31' };

beforeAll(async () => {
  // Insert the test asset into fixed_assets (idempotent on asset_code UNIQUE).
  // The cron route loads from this table, but for this test we pass the row
  // directly to buildDepreciationEvent — we still need it present so future
  // tests / queries against fixed_assets can find it consistently.
  const { error } = await supabase
    .from('fixed_assets')
    .upsert(
      {
        asset_code: TEST_ASSET.asset_code,
        description: 'Integration-test asset (not in production)',
        acquired_date: '2026-12-15',
        acquisition_cost_cents: TEST_ASSET.acquisition_cost_cents,
        account_code: '1230',
        useful_life_months: TEST_ASSET.useful_life_months,
        depreciation_start_date: TEST_ASSET.depreciation_start_date,
      },
      { onConflict: 'asset_code' },
    );
  if (error) throw new Error(`UPSERT TEST-DEPR-001 failed: ${error.message}`);
});

describe('monthly-depreciation cron — end-to-end emit', () => {
  it('emits a P.6 entry with correct shape + posting_context tags', async () => {
    const built = buildDepreciationEvent(TEST_ASSET, TARGET);
    expect(built.status).toBe('ok');
    if (built.status !== 'ok') return;

    const result = await emit(supabase, built.event);
    expect(['created', 'idempotent_skip']).toContain(result.status);
    if (result.status !== 'created' && result.status !== 'idempotent_skip') return;

    // Fetch the persisted entry + lines.
    const { data: entry, error: entryErr } = await supabase
      .from('journal_entries')
      .select('id, type_id, entry_type, accounting_period, posting_date, source_doc_type, source_doc_id, posting_context')
      .eq('id', result.entry_id)
      .single();
    if (entryErr) throw new Error(`fetch entry: ${entryErr.message}`);

    expect(entry.type_id).toBe('P.6');
    expect(entry.entry_type).toBe('depreciation');
    expect(entry.accounting_period).toBe('2027-01');
    expect(entry.posting_date).toBe('2027-01-31');
    expect(entry.source_doc_type).toBe('monthly_depreciation');
    expect(entry.source_doc_id).toBe('depreciation_TEST-DEPR-001_2027-01');

    // posting_context discriminators from the cron path.
    const ctx = entry.posting_context as Record<string, unknown>;
    expect(ctx.emission_source).toBe('cron');
    expect(ctx.asset_code).toBe('TEST-DEPR-001');
    expect(ctx.month_number).toBe(1);
    expect(ctx.of_total).toBe(36);
    expect(ctx.depreciation_cents).toBe(10000); // €100/month
    expect(ctx.backfill).toBeUndefined(); // cron entries are NOT backfill

    // P.6 produces 2 lines: Dr 7610 / Cr 1239.
    const { data: lines, error: linesErr } = await supabase
      .from('journal_lines')
      .select('line_number, account_code, debit_cents, credit_cents')
      .eq('entry_id', result.entry_id)
      .order('line_number');
    if (linesErr) throw new Error(`fetch lines: ${linesErr.message}`);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      account_code: '7610',
      debit_cents: 10000,
      credit_cents: 0,
    });
    expect(lines[1]).toMatchObject({
      account_code: '1239',
      debit_cents: 0,
      credit_cents: 10000,
    });
  });

  it('re-emit for the same (asset, period) returns same entry_id with idempotent_skip', async () => {
    const built = buildDepreciationEvent(TEST_ASSET, TARGET);
    if (built.status !== 'ok') throw new Error('expected ok');

    const first = await emit(supabase, built.event);
    if (first.status !== 'created' && first.status !== 'idempotent_skip') {
      throw new Error(`unexpected status: ${first.status}`);
    }

    const second = await emit(supabase, built.event);
    expect(second.status).toBe('idempotent_skip');
    if (second.status !== 'idempotent_skip') return;
    expect(second.entry_id).toBe(first.entry_id);
  });
});
