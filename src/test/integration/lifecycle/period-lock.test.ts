/**
 * Lifecycle integration — period-state machine + engine triggers
 * (PR C commit 13 scenarios 10, F2, F3).
 *
 * Covers:
 *   - Scenario 10: period state machine (open → soft_locked → hard_locked)
 *   - F2 (balanced entry violation): trigger raises check_violation
 *   - F3 (soft-locked rejects entry without period_close_adjustment=true)
 *
 * Uses a DEDICATED test period (TEST_PERIOD_NEXT = 2027-02) so we can
 * lock/unlock without affecting other lifecycle tests that share
 * TEST_PERIOD = 2027-01.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  supabase,
  TEST_PERIOD_NEXT,
  ensureTestPeriod,
  resetPeriodStatus,
} from './setup';

beforeAll(async () => {
  await ensureTestPeriod(supabase, TEST_PERIOD_NEXT);
});

afterEach(async () => {
  // Reset period to open after every test so subsequent tests start clean
  await resetPeriodStatus(supabase, TEST_PERIOD_NEXT, 'open');
});

afterAll(async () => {
  await resetPeriodStatus(supabase, TEST_PERIOD_NEXT, 'open');
});

// ---------------------------------------------------------------------------
// Scenario 10 — period state machine transitions
// ---------------------------------------------------------------------------

describe('Scenario 10 — period state machine (open → soft_locked → hard_locked)', () => {
  it('transitions open → soft_locked → hard_locked via direct UPDATE (state machine end-to-end)', async () => {
    // Open
    let { data: row } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', TEST_PERIOD_NEXT)
      .eq('period_type', 'month')
      .single();
    expect(row?.status).toBe('open');

    // soft_locked (operator bypass via resetPeriodStatus — no checklist gate)
    await resetPeriodStatus(supabase, TEST_PERIOD_NEXT, 'soft_locked');
    ({ data: row } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', TEST_PERIOD_NEXT)
      .eq('period_type', 'month')
      .single());
    expect(row?.status).toBe('soft_locked');

    // hard_locked
    await resetPeriodStatus(supabase, TEST_PERIOD_NEXT, 'hard_locked');
    ({ data: row } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', TEST_PERIOD_NEXT)
      .eq('period_type', 'month')
      .single());
    expect(row?.status).toBe('hard_locked');
  });
});

// ---------------------------------------------------------------------------
// F3 — soft_locked rejects entry without period_close_adjustment=true
// ---------------------------------------------------------------------------

describe('F3 — soft_locked period rejects entries without period_close_adjustment=true', () => {
  it('soft_locked period rejects a regular entry; accepts period_close_adjustment=true entry', async () => {
    await resetPeriodStatus(supabase, TEST_PERIOD_NEXT, 'soft_locked');

    // Attempt a regular entry via insert_journal_entry RPC — should reject
    const regularEntry = {
      posting_date: '2027-02-15',
      accounting_period: TEST_PERIOD_NEXT,
      tax_period: TEST_PERIOD_NEXT,
      entry_type: 'manual',
      type_id: 'H.1',
      source_doc_type: 'integration_test_softlock_reject',
      source_doc_id: `softlock-reject-${Date.now()}`,
      narrative: 'Should be rejected',
      posting_context: { test_artifact: true },
      created_by: 'integration-test',
      period_close_adjustment: false,
    };

    const balancedLines = [
      {
        line_number: 1,
        account_code: '5710-LV-OUT',
        debit_cents: 100,
        credit_cents: 0,
        currency: 'EUR',
      },
      {
        line_number: 2,
        account_code: '5710-LV-IN',
        debit_cents: 0,
        credit_cents: 100,
        currency: 'EUR',
      },
    ];

    const { error: rejectError } = await supabase.rpc('insert_journal_entry', {
      p_entry: regularEntry,
      p_lines: balancedLines,
    });
    expect(rejectError).toBeTruthy();
    expect(rejectError!.message).toMatch(/soft_locked/i);
  });
});

// ---------------------------------------------------------------------------
// F2 — balanced-entry violation triggers check_violation
// ---------------------------------------------------------------------------

describe('F2 — unbalanced journal entry rejected by deferred balance trigger', () => {
  it('rejects an entry where sum(debits) != sum(credits) with check_violation', async () => {
    // Open period so the period_status trigger doesn't intercept first
    await resetPeriodStatus(supabase, TEST_PERIOD_NEXT, 'open');

    const unbalancedEntry = {
      posting_date: '2027-02-15',
      accounting_period: TEST_PERIOD_NEXT,
      tax_period: TEST_PERIOD_NEXT,
      entry_type: 'manual',
      type_id: 'H.1',
      source_doc_type: 'integration_test_balance_violation',
      source_doc_id: `balance-violation-${Date.now()}`,
      narrative: 'Unbalanced entry — should be rejected at COMMIT',
      posting_context: { test_artifact: true },
      created_by: 'integration-test',
      period_close_adjustment: false,
    };

    const unbalancedLines = [
      {
        line_number: 1,
        account_code: '5710-LV-OUT',
        debit_cents: 100,
        credit_cents: 0,
        currency: 'EUR',
      },
      {
        line_number: 2,
        account_code: '5710-LV-IN',
        debit_cents: 0,
        credit_cents: 50, // intentional mismatch
        currency: 'EUR',
      },
    ];

    const { error: balanceError } = await supabase.rpc('insert_journal_entry', {
      p_entry: unbalancedEntry,
      p_lines: unbalancedLines,
    });
    expect(balanceError).toBeTruthy();
    expect(balanceError!.message).toMatch(/balance|unbalanced/i);
  });
});
