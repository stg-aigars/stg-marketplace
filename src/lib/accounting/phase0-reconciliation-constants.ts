/**
 * Phase 0 reconciliation source-of-truth — derived from
 * stg-phase-0-backfill-execution-v2.md and validated against Swedbank
 * statements during the 2026-05-09 production run (PR #281).
 *
 * Both scripts/phase0-backfill-reconcile.ts and the period-close UI consume
 * these constants. Single source of truth; tie-out test in
 * src/test/integration/accounting-readonly-ui.test.ts asserts these values
 * match the GL after Phase 0 backfill is replayed.
 *
 * DO NOT EDIT VALUES without rerunning the reconciliation. Adding new
 * checkpoint dates is fine; mutating existing ones requires evidence.
 */

/**
 * Bank-walk checkpoints: expected net debit balance on `2610` at each
 * month-end, matching Swedbank statements per the v2 backfill spec.
 */
export const BANK_WALK_CHECKPOINTS: ReadonlyArray<{
  date: string;
  expected_cents: number;
}> = [
  { date: '2025-07-31', expected_cents: 5100 },     // Entry 1 (€1) + Entry 2 (€50)
  { date: '2025-08-31', expected_cents: 8993 },     // + 3,4,5,6: €100 - €35 - €18.08 - €7.99
  { date: '2025-09-30', expected_cents: 5421 },     // + 7,8,9: -€17.74 - €7.99 - €9.99
  { date: '2025-10-31', expected_cents: 3658 },     // + 10: -€17.63
  { date: '2025-11-30', expected_cents: 3658 },     // (no entries)
  { date: '2025-12-31', expected_cents: 1904 },     // + 11: -€17.54 (12 + close are non-2610)
  { date: '2026-01-31', expected_cents: 43185 },    // + 13,14a,14b,15,16,17: +2000 -1511.40 -3.45 -71.76 -0.01 -0.57
  { date: '2026-02-28', expected_cents: 44490 },    // + 18: +€13.05 (19 is non-2610)
  { date: '2026-03-31', expected_cents: 44490 }     // (entry 20 is non-2610)
];

/**
 * VAT account state at 31.01.2026 (post January P.1 close).
 * LV sub-accounts cleared; 2380 carries the refund receivable; foreign RC pair
 * (from H.1 December catch-up) persists indefinitely.
 */
export const VAT_CHECKPOINT_2026_01_31: ReadonlyArray<{
  account: string;
  expected_cents: number;
}> = [
  { account: '5710-LV-IN', expected_cents: 0 },
  { account: '5710-LV-RC-IN', expected_cents: 0 },
  { account: '5710-LV-RC-OUT', expected_cents: 0 },
  { account: '5710-RC-IN', expected_cents: 738 },        // H.1 December catch-up
  { account: '5710-RC-OUT', expected_cents: -738 },      // H.1 December catch-up
  { account: '2380', expected_cents: 1305 }              // January refund receivable
];

/**
 * Closing trial balance at 31.03.2026.
 *
 * Net debit balance per account (positive = debit, negative = credit). Σ
 * across all accounts must equal 0 (Σdr = Σcr trivially holds via
 * journal_lines invariants).
 */
export const CLOSING_TRIAL_BALANCE_2026_03_31: ReadonlyArray<{
  account: string;
  expected_cents: number;
}> = [
  // Assets
  { account: '1230', expected_cents: 151140 },           // C&C MacBook capitalized
  { account: '1239', expected_cents: -8396 },            // Accumulated depreciation (2 months × €41.98)
  { account: '2380', expected_cents: 0 },                // VID receivable cleared by Entry 18
  { account: '2610', expected_cents: 44490 },            // Bank — final balance (matches Swedbank)
  // Equity
  { account: '3110', expected_cents: -100 },             // Share capital
  { account: '3420', expected_cents: 13196 },            // 2025 closed loss carried forward (debit balance)
  // Liabilities
  { account: '5340', expected_cents: -215000 },          // Three shareholder loans
  // VAT (LV cleared; foreign RC persists from H.1)
  { account: '5710-LV-IN', expected_cents: 0 },
  { account: '5710-LV-RC-IN', expected_cents: 0 },
  { account: '5710-LV-RC-OUT', expected_cents: 0 },
  { account: '5710-RC-IN', expected_cents: 738 },
  { account: '5710-RC-OUT', expected_cents: -738 },
  // P&L (2026 YTD only — 2025 closed by P.7)
  { account: '7610', expected_cents: 8396 },             // 2026 YTD depreciation
  { account: '7710', expected_cents: 57 },               // 2026 January Swedbank FX commission
  { account: '7730', expected_cents: 0 },                // No 2026 IT/SaaS yet
  { account: '7740', expected_cents: 5931 },             // 2026 January VINCIT net
  { account: '7770', expected_cents: 286 }               // 2026 C&C levy + Mollie verification
];

/**
 * Maps period_key → expected closing balance for account 2610 (Swedbank).
 * Period-close checklist item 2 uses this for bank reconciliation against GL.
 * Returns null for periods not covered by Phase 0 — those need PR #4b's bank-
 * statement ingestion.
 */
export function getPhase0BankCloseForPeriod(periodKey: string): number | null {
  const [yearStr, monthStr] = periodKey.split('-');
  if (!yearStr || !monthStr) return null;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  const lastDay = new Date(year, month, 0).getDate();
  const dateStr = `${yearStr}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return BANK_WALK_CHECKPOINTS.find(c => c.date === dateStr)?.expected_cents ?? null;
}
