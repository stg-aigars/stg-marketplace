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

import {
  BANK_WALK_CHECKPOINTS,
  CLOSING_TRIAL_BALANCE_2026_03_31,
  VAT_CHECKPOINT_2026_01_31
} from '@/lib/accounting/phase0-reconciliation-constants';

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
