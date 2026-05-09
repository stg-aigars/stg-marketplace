import { describe, expect, it } from 'vitest';

import {
  BANK_WALK_CHECKPOINTS,
  CLOSING_TRIAL_BALANCE_2026_03_31,
  VAT_CHECKPOINT_2026_01_31,
  getPhase0BankCloseForPeriod
} from './phase0-reconciliation-constants';

describe('BANK_WALK_CHECKPOINTS', () => {
  it('locks the closing balance at 31.03.2026 to €444.90 (44490 cents)', () => {
    // Regression anchor against the audit snapshot
    // (docs/audits/phase0-backfill-closing-tb-2026-03-31.md).
    const last = BANK_WALK_CHECKPOINTS[BANK_WALK_CHECKPOINTS.length - 1];
    expect(BANK_WALK_CHECKPOINTS[8]?.expected_cents).toBe(44490);
    expect(last?.date).toBe('2026-03-31');
  });

  it('exposes all 9 month-end checkpoints in order', () => {
    expect(BANK_WALK_CHECKPOINTS.map((c) => c.date)).toEqual([
      '2025-07-31',
      '2025-08-31',
      '2025-09-30',
      '2025-10-31',
      '2025-11-30',
      '2025-12-31',
      '2026-01-31',
      '2026-02-28',
      '2026-03-31'
    ]);
  });

  it('locks each checkpoint balance to the v2 spec values', () => {
    expect(BANK_WALK_CHECKPOINTS.map((c) => c.expected_cents)).toEqual([
      5100,
      8993,
      5421,
      3658,
      3658,
      1904,
      43185,
      44490,
      44490
    ]);
  });
});

describe('VAT_CHECKPOINT_2026_01_31', () => {
  it('locks the post-January-close VAT state', () => {
    expect(VAT_CHECKPOINT_2026_01_31).toEqual([
      { account: '5710-LV-IN', expected_cents: 0 },
      { account: '5710-LV-RC-IN', expected_cents: 0 },
      { account: '5710-LV-RC-OUT', expected_cents: 0 },
      { account: '5710-RC-IN', expected_cents: 738 },
      { account: '5710-RC-OUT', expected_cents: -738 },
      { account: '2380', expected_cents: 1305 }
    ]);
  });
});

describe('CLOSING_TRIAL_BALANCE_2026_03_31', () => {
  it('matches the audit snapshot exactly (17 accounts)', () => {
    // Tie-out: docs/audits/phase0-backfill-closing-tb-2026-03-31.md.
    expect(CLOSING_TRIAL_BALANCE_2026_03_31).toEqual([
      // Assets
      { account: '1230', expected_cents: 151140 },
      { account: '1239', expected_cents: -8396 },
      { account: '2380', expected_cents: 0 },
      { account: '2610', expected_cents: 44490 },
      // Equity
      { account: '3110', expected_cents: -100 },
      { account: '3420', expected_cents: 13196 },
      // Liabilities
      { account: '5340', expected_cents: -215000 },
      // VAT
      { account: '5710-LV-IN', expected_cents: 0 },
      { account: '5710-LV-RC-IN', expected_cents: 0 },
      { account: '5710-LV-RC-OUT', expected_cents: 0 },
      { account: '5710-RC-IN', expected_cents: 738 },
      { account: '5710-RC-OUT', expected_cents: -738 },
      // P&L
      { account: '7610', expected_cents: 8396 },
      { account: '7710', expected_cents: 57 },
      { account: '7730', expected_cents: 0 },
      { account: '7740', expected_cents: 5931 },
      { account: '7770', expected_cents: 286 }
    ]);
    expect(CLOSING_TRIAL_BALANCE_2026_03_31).toHaveLength(17);
  });

  it('balances to zero (Σ net debit across all accounts = 0)', () => {
    const total = CLOSING_TRIAL_BALANCE_2026_03_31.reduce(
      (sum, row) => sum + row.expected_cents,
      0
    );
    expect(total).toBe(0);
  });
});

describe('getPhase0BankCloseForPeriod', () => {
  it('returns the closing balance for the final Phase 0 period', () => {
    expect(getPhase0BankCloseForPeriod('2026-03')).toBe(44490);
  });

  it('returns null for periods outside Phase 0', () => {
    expect(getPhase0BankCloseForPeriod('2099-01')).toBeNull();
  });

  it('returns the balance for the first Phase 0 period (2025-07)', () => {
    expect(getPhase0BankCloseForPeriod('2025-07')).toBe(5100);
  });

  it('returns the balance for the no-entries month (2025-11)', () => {
    expect(getPhase0BankCloseForPeriod('2025-11')).toBe(3658);
  });

  it('handles February correctly (last day = 28 in 2026)', () => {
    expect(getPhase0BankCloseForPeriod('2026-02')).toBe(44490);
  });

  it('returns null for malformed period keys', () => {
    expect(getPhase0BankCloseForPeriod('invalid')).toBeNull();
    expect(getPhase0BankCloseForPeriod('')).toBeNull();
    expect(getPhase0BankCloseForPeriod('2026')).toBeNull();
    expect(getPhase0BankCloseForPeriod('2026-XX')).toBeNull();
    expect(getPhase0BankCloseForPeriod('2026-1')).toBeNull();
    expect(getPhase0BankCloseForPeriod('2026-01-15')).toBeNull();
    expect(getPhase0BankCloseForPeriod('2026-13')).toBeNull();
  });
});
