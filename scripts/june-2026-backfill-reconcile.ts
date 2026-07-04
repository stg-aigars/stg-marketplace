/**
 * June 2026 backfill — reconciliation harness.
 *
 * Deliberately lighter than May's reconcile harness (`may-2026-backfill-
 * reconcile.ts`). May hand-derived a full per-account delta table for 6
 * orders across 2 VAT jurisdictions — feasible by hand at that volume. June
 * has 21 completions across 3 jurisdictions (LV 21%, LT 21% OSS, EE 24% OSS)
 * plus FX decomposition (Porkbun) and combined-batch settlements; hand-
 * deriving every commission/VAT split independently would be more error-prone
 * than trusting the engine's own (separately unit-tested) compute functions.
 *
 * This harness instead checks the things independently verifiable from
 * source documents without re-deriving the engine's math:
 *   1. Bank checkpoints @ 30.06.2026 — exact Swedbank statement closings.
 *   2. 2630 EveryPay clearing in-transit — only UJRJ (€34.10) unsettled.
 *   3. Two accounts that must net to exactly zero this month: 5310-META
 *      (June's €28.70 accrual+payment plus May's €6.00 rollover payment all
 *      clear) and 5710-09 (May's €7.22 payable cleared by C.11).
 *   4. Global Σdebit = Σcredit across all GL lines through 30.06.2026.
 *
 * Before soft-locking June (once the deferred Swedbank fee + P.1 close land),
 * also run the actual `/staff/accounting/period-close?period=2026-06` checklist
 * and a manual trial-balance review — this harness is a floor, not a full
 * substitute for that review given the volume increase over April/May.
 *
 * Tolerance: zero. Reads ALL journal_lines through 2026-06-30 (single roundtrip).
 */

import './_load-env';

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Bank + zero-out checkpoints @ 30.06.2026
// ---------------------------------------------------------------------------

export const BANK_CHECKPOINTS_2026_06_30: ReadonlyArray<{
  account: string;
  expected_cents: number;
  label: string;
}> = [
  // Statement closing (9947) + 72¢ deliberately-deferred Swedbank/EveryPay fee
  // (the 15.06 statement lines — VAT-bearing, invoice pending ~15 July, see
  // june-2026-backfill-data.ts header). GL is legitimately 72¢ "ahead of" the
  // statement until that fee posts; this checkpoint reflects that on purpose.
  { account: '2610', expected_cents: 10019, label: 'Swedbank operating — statement 30.06 (€99.47) + deferred €0.72 fee' },
  { account: '2620', expected_cents: 88635, label: 'Swedbank e-commerce — matches statement 30.06' },
  { account: '2630', expected_cents: 3410, label: 'EveryPay clearing — UJRJ still in-transit' }
];

export const ZERO_CHECKPOINTS_2026_06_30: ReadonlyArray<{
  account: string;
  label: string;
}> = [
  { account: '5310-META', label: 'Meta payable — June €28.70 accrual+payment + May €6.00 rollover payment, all clear' },
  { account: '5710-09', label: 'VAT payable to VID — May €7.22 cleared by C.11' }
];

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

interface TopContributor {
  entry_number: string;
  description: string;
  contribution_cents: number;
}

export class JuneReconciliationError extends Error {
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
      `JuneReconciliationError at ${args.checkpoint}:\n` +
      `  expected ${args.expected_cents}¢, observed ${args.observed_cents}¢, drift ${driftStr}¢\n` +
      `Top 3 contributors:\n${topStr}`
    );
    this.name = 'JuneReconciliationError';
    this.checkpoint = args.checkpoint;
    this.expected_cents = args.expected_cents;
    this.observed_cents = args.observed_cents;
    this.drift_cents = drift;
    this.top_contributors = args.top_contributors;
  }
}

interface GLLine {
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  posting_date: string;
  source_doc_id: string;
  entry_number: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function assertMatchesExpectedClosingState(supabase: SupabaseClient): Promise<void> {
  const allLines = await loadLinesThrough(supabase, '2026-06-30');
  const juneLines = allLines.filter((l) => l.posting_date >= '2026-06-01' && l.posting_date <= '2026-06-30');

  if (juneLines.length === 0) {
    throw new JuneReconciliationError({
      checkpoint: 'preflight',
      expected_cents: -1,
      observed_cents: 0,
      top_contributors: [{
        entry_number: '(none)',
        description: 'No June 2026 journal_lines found. Run `npx tsx scripts/june-2026-backfill.ts` first.',
        contribution_cents: 0
      }]
    });
  }

  assertBankCheckpoints(allLines);
  assertZeroCheckpoints(allLines);
  assertGlobalBalance(allLines);
}

export async function runReconcileOnly(
  supabase: SupabaseClient
): Promise<{ status: 'pass' } | { status: 'fail'; error: JuneReconciliationError }> {
  try {
    await assertMatchesExpectedClosingState(supabase);
    return { status: 'pass' };
  } catch (err) {
    if (err instanceof JuneReconciliationError) {
      return { status: 'fail', error: err };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

async function loadLinesThrough(supabase: SupabaseClient, throughDate: string): Promise<GLLine[]> {
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
        narrative,
        posting_context
      )
    `)
    .lte('journal_entries.posting_date', throughDate);

  if (error) {
    throw new Error(`reconcile: failed to load journal_lines through ${throughDate}: ${error.message}`);
  }
  if (!data) return [];

  return data.map((row): GLLine => {
    const je = row.journal_entries as unknown as {
      posting_date: string;
      source_doc_id: string;
      narrative: string;
      posting_context: {
        june_2026_entry_number?: string;
        may_2026_entry_number?: string;
        april_2026_entry_number?: string;
        phase0_entry_number?: string;
      };
    };
    const entry_number = je.posting_context?.june_2026_entry_number
      ?? je.posting_context?.may_2026_entry_number
      ?? je.posting_context?.april_2026_entry_number
      ?? je.posting_context?.phase0_entry_number
      ?? je.source_doc_id
      ?? '(unknown)';
    return {
      account_code: row.account_code as string,
      debit_cents: Number(row.debit_cents ?? 0),
      credit_cents: Number(row.credit_cents ?? 0),
      posting_date: je.posting_date,
      source_doc_id: je.source_doc_id,
      entry_number,
      description: je.narrative
    };
  });
}

function assertBankCheckpoints(allLines: ReadonlyArray<GLLine>): void {
  for (const chk of BANK_CHECKPOINTS_2026_06_30) {
    const lines = allLines.filter((l) => l.account_code === chk.account && l.posting_date <= '2026-06-30');
    const observed = sumNetDebit(lines);
    if (observed !== chk.expected_cents) {
      throw new JuneReconciliationError({
        checkpoint: `bank-walk ${chk.account} @ 2026-06-30 (${chk.label})`,
        expected_cents: chk.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(lines)
      });
    }
  }
}

function assertZeroCheckpoints(allLines: ReadonlyArray<GLLine>): void {
  for (const chk of ZERO_CHECKPOINTS_2026_06_30) {
    const lines = allLines.filter((l) => l.account_code === chk.account && l.posting_date <= '2026-06-30');
    const observed = sumNetDebit(lines);
    if (observed !== 0) {
      throw new JuneReconciliationError({
        checkpoint: `zero-out ${chk.account} @ 2026-06-30 (${chk.label})`,
        expected_cents: 0,
        observed_cents: observed,
        top_contributors: topContributors(lines)
      });
    }
  }
}

function assertGlobalBalance(allLines: ReadonlyArray<GLLine>): void {
  const totalDr = allLines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCr = allLines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDr !== totalCr) {
    throw new JuneReconciliationError({
      checkpoint: 'Σdr = Σcr across all GL lines through 30.06.2026',
      expected_cents: 0,
      observed_cents: totalDr - totalCr,
      top_contributors: []
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumNetDebit(lines: ReadonlyArray<GLLine>): number {
  return lines.reduce((s, l) => s + l.debit_cents - l.credit_cents, 0);
}

function topContributors(lines: ReadonlyArray<GLLine>): TopContributor[] {
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
    .map(([entry_number, info]) => ({ entry_number, description: info.description, contribution_cents: info.total }))
    .sort((a, b) => Math.abs(b.contribution_cents) - Math.abs(a.contribution_cents))
    .slice(0, 3);
}
