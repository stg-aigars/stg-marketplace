/**
 * Phase 0 backfill — reconciliation harness.
 *
 * Verifies that all 23 backfill emits produced the expected GL state. Three
 * layers of assertion, run in order:
 *
 *   1. Bank-walk: 9 month-end checkpoints on `2610` net debit. Each checkpoint
 *      ties to a Swedbank statement closing balance from the v2 backfill spec.
 *      Catches off-period drift (an entry posted to wrong month).
 *   2. VAT account checkpoint at 31.01.2026: post-P.1 close, all LV-* sub-
 *      accounts cleared, `2380` carries the €13.05 receivable, foreign RC pair
 *      from H.1 December catch-up persists. Ties to the as-filed January 2026
 *      PVN deklarācija.
 *   3. Closing trial balance at 31.03.2026: per-account net debit/credit + Σ
 *      check.
 *
 * Tolerance: zero. Every checkpoint must match to the cent. A backfill that
 * produces a different result than spec ships is not a valid backfill.
 *
 * On mismatch, throws Phase0ReconciliationError with: which checkpoint/account
 * broke, expected vs observed cents, and the top 3 contributing entries up to
 * that point (for triage). Bank-walk failures pinpoint the offending entry so
 * the implementer doesn't have to walk back from a final-balance discrepancy
 * across 20 entries.
 *
 * Strategy: pull all backfill journal_lines (~75 rows) into memory once,
 * compute aggregations in JS. Single roundtrip, simple JSONB-free queries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { SOURCE_DOC_TYPE } from './phase0-backfill-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class Phase0ReconciliationError extends Error {
  readonly checkpoint: string;
  readonly expected_cents: number;
  readonly observed_cents: number;
  readonly drift_cents: number;
  readonly top_contributors: TopContributor[];

  constructor(args: {
    checkpoint: string;
    expected_cents: number;
    observed_cents: number;
    top_contributors: TopContributor[];
  }) {
    const drift = args.observed_cents - args.expected_cents;
    const driftStr = drift >= 0 ? `+${drift}` : `${drift}`;
    const topStr = args.top_contributors
      .map((c) => `  ${c.entry_number}: ${c.description} (${c.contribution_cents}¢)`)
      .join('\n');
    super(
      `Phase0ReconciliationError at ${args.checkpoint}:\n` +
      `  expected ${args.expected_cents}¢, observed ${args.observed_cents}¢, drift ${driftStr}¢\n` +
      `Top 3 contributors:\n${topStr}`
    );
    this.name = 'Phase0ReconciliationError';
    this.checkpoint = args.checkpoint;
    this.expected_cents = args.expected_cents;
    this.observed_cents = args.observed_cents;
    this.drift_cents = drift;
    this.top_contributors = args.top_contributors;
  }
}

interface TopContributor {
  entry_number: string;
  description: string;
  contribution_cents: number;
}

interface BackfillLine {
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  posting_date: string;
  entry_id: string;
  source_doc_id: string;
  entry_number: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Expected closing state — derived from stg-phase-0-backfill-execution-v2.md
// ---------------------------------------------------------------------------

/**
 * Bank-walk checkpoints: expected net debit balance on `2610` at each
 * month-end, matching Swedbank statements per the v2 backfill spec.
 */
const BANK_WALK_CHECKPOINTS: ReadonlyArray<{ date: string; expected_cents: number }> = [
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
const VAT_CHECKPOINT_2026_01_31: ReadonlyArray<{ account: string; expected_cents: number }> = [
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
const CLOSING_TRIAL_BALANCE_2026_03_31: ReadonlyArray<{ account: string; expected_cents: number }> = [
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function assertMatchesExpectedClosingState(supabase: SupabaseClient): Promise<void> {
  const lines = await loadAllBackfillLines(supabase);
  if (lines.length === 0) {
    throw new Phase0ReconciliationError({
      checkpoint: 'preflight',
      expected_cents: -1,
      observed_cents: 0,
      top_contributors: [
        {
          entry_number: '(none)',
          description: 'No backfill journal_lines found. Run `pnpm tsx scripts/phase0-backfill.ts` first.',
          contribution_cents: 0
        }
      ]
    });
  }
  assertBankWalkCheckpoints(lines);
  assertVatCheckpoint2026_01_31(lines);
  assertClosingTrialBalance2026_03_31(lines);
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

async function loadAllBackfillLines(supabase: SupabaseClient): Promise<BackfillLine[]> {
  // Pull all backfill lines into memory in one roundtrip. ~75 rows max
  // (22 entries × ~3-4 lines avg); negligible memory cost, simpler than
  // running ~9 separate aggregation queries.
  const { data, error } = await supabase
    .from('journal_lines')
    .select(`
      account_code,
      debit_cents,
      credit_cents,
      entry_id,
      journal_entries!inner(
        posting_date,
        source_doc_id,
        source_doc_type,
        narrative,
        posting_context
      )
    `)
    .eq('journal_entries.source_doc_type', SOURCE_DOC_TYPE);

  if (error) {
    throw new Error(`reconcile: failed to load backfill journal_lines: ${error.message}`);
  }
  if (!data) return [];

  return data.map((row) => {
    const je = row.journal_entries as unknown as {
      posting_date: string;
      source_doc_id: string;
      source_doc_type: string;
      narrative: string;
      posting_context: { phase0_entry_number?: string };
    };
    return {
      account_code: row.account_code as string,
      debit_cents: Number(row.debit_cents ?? 0),
      credit_cents: Number(row.credit_cents ?? 0),
      posting_date: je.posting_date,
      entry_id: row.entry_id as string,
      source_doc_id: je.source_doc_id,
      entry_number: je.posting_context?.phase0_entry_number ?? '(unknown)',
      description: je.narrative
    };
  });
}

function assertBankWalkCheckpoints(lines: ReadonlyArray<BackfillLine>): void {
  for (const checkpoint of BANK_WALK_CHECKPOINTS) {
    const subset = lines.filter((l) => l.account_code === '2610' && l.posting_date <= checkpoint.date);
    const observed = sumNetDebit(subset);
    if (observed !== checkpoint.expected_cents) {
      throw new Phase0ReconciliationError({
        checkpoint: `bank-walk 2610 @ ${checkpoint.date}`,
        expected_cents: checkpoint.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(subset)
      });
    }
  }
}

function assertVatCheckpoint2026_01_31(lines: ReadonlyArray<BackfillLine>): void {
  for (const expected of VAT_CHECKPOINT_2026_01_31) {
    const subset = lines.filter((l) => l.account_code === expected.account && l.posting_date <= '2026-01-31');
    const observed = sumNetDebit(subset);
    if (observed !== expected.expected_cents) {
      throw new Phase0ReconciliationError({
        checkpoint: `VAT-state ${expected.account} @ 2026-01-31`,
        expected_cents: expected.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(subset)
      });
    }
  }
}

function assertClosingTrialBalance2026_03_31(lines: ReadonlyArray<BackfillLine>): void {
  // Per-account assertions
  for (const expected of CLOSING_TRIAL_BALANCE_2026_03_31) {
    const subset = lines.filter((l) => l.account_code === expected.account && l.posting_date <= '2026-03-31');
    const observed = sumNetDebit(subset);
    if (observed !== expected.expected_cents) {
      throw new Phase0ReconciliationError({
        checkpoint: `closing TB ${expected.account} @ 2026-03-31`,
        expected_cents: expected.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(subset)
      });
    }
  }

  // Σ check across all backfill lines (must be exactly zero)
  const totalDr = lines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCr = lines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDr !== totalCr) {
    throw new Phase0ReconciliationError({
      checkpoint: 'Σdr = Σcr across all backfill lines',
      expected_cents: 0,
      observed_cents: totalDr - totalCr,
      top_contributors: []  // mismatch is across all entries; no useful "top 3"
    });
  }

  // Cross-check: assert the per-account expectations cover all accounts that
  // actually have non-zero balances (catches the case where a new entry adds a
  // line to an unexpected account that the harness doesn't know about).
  const expectedAccounts = new Set(CLOSING_TRIAL_BALANCE_2026_03_31.map((e) => e.account));
  const observedAccounts = new Set(lines.map((l) => l.account_code));
  const missingFromExpectations: string[] = [];
  for (const acc of observedAccounts) {
    if (!expectedAccounts.has(acc)) {
      const balance = sumNetDebit(lines.filter((l) => l.account_code === acc));
      if (balance !== 0) {
        missingFromExpectations.push(`${acc}=${balance}¢`);
      }
    }
  }
  if (missingFromExpectations.length > 0) {
    throw new Phase0ReconciliationError({
      checkpoint: 'unexpected non-zero accounts in closing TB',
      expected_cents: 0,
      observed_cents: missingFromExpectations.length,
      top_contributors: missingFromExpectations.map((entry) => ({
        entry_number: '(account)',
        description: entry,
        contribution_cents: 0
      }))
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumNetDebit(lines: ReadonlyArray<BackfillLine>): number {
  return lines.reduce((s, l) => s + l.debit_cents - l.credit_cents, 0);
}

function topContributors(lines: ReadonlyArray<BackfillLine>): TopContributor[] {
  // Group by entry_number, sum (debit - credit), sort by absolute magnitude desc.
  const byEntry = new Map<string, { description: string; total: number }>();
  for (const line of lines) {
    const existing = byEntry.get(line.entry_number);
    const contribution = line.debit_cents - line.credit_cents;
    if (existing) {
      existing.total += contribution;
    } else {
      byEntry.set(line.entry_number, { description: line.description, total: contribution });
    }
  }
  return Array.from(byEntry.entries())
    .map(([entry_number, info]) => ({
      entry_number,
      description: info.description,
      contribution_cents: info.total
    }))
    .sort((a, b) => Math.abs(b.contribution_cents) - Math.abs(a.contribution_cents))
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Standalone reconcile-only mode (used by `--reconcile-only` flag in commit 3)
// ---------------------------------------------------------------------------

export async function runReconcileOnly(supabase: SupabaseClient): Promise<{ status: 'pass' } | { status: 'fail'; error: Phase0ReconciliationError }> {
  try {
    await assertMatchesExpectedClosingState(supabase);
    return { status: 'pass' };
  } catch (err) {
    if (err instanceof Phase0ReconciliationError) {
      return { status: 'fail', error: err };
    }
    throw err;  // unexpected; let caller surface
  }
}
