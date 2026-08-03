/**
 * July 2026 backfill — reconciliation harness (FULL PASS).
 *
 * Mirrors june-2026-backfill-reconcile.ts's rigor:
 *   1. Bank checkpoints @ 31.07.2026 — 2610, 2620, 2630.
 *   2. Zero-out checkpoints — 5310-HE, 5310-UN (both fully cleared this pass).
 *   3. A documented NON-zero checkpoint — 5310-META (€5.00 rollover payable to
 *      August, same shape as May's €6.00 rollover into June).
 *   4. Wallet integrity — no `5351` line with a non-null counterparty_type but
 *      a null counterparty_id (unattributed wallet line).
 *   5. Global Σdebit = Σcredit across all GL lines through 31.07.2026.
 *
 * KNOWN, DOCUMENTED GAP — the 2610 checkpoint is deliberately NOT the raw
 * statement closing. The statement shows €376.67 @ 31.07 (before the 02.08-
 * booked Meta charge); this backfill leaves the Q2.2026 VID payment (€10.35,
 * 11.07, ref EDS003091DD) UNPOSTED pending human resolution of what it
 * actually is (see july-2026-backfill-data.ts header, open question 1). Real
 * cash left the account for that payment regardless of whether GL reflects
 * it, so GL's 2610 will sit exactly €10.35 "ahead of" the statement until a
 * follow-up posts the correct entry — mirrors June's own reconcile
 * precedent (BANK_CHECKPOINTS_2026_06_30's 2610 entry, "legitimately 72¢
 * ahead of the statement until that fee posts").
 *
 * This harness intentionally does NOT reconcile 5710-09 to zero — see the
 * open 7-cent discrepancy flagged in july_2026_entry_16 / the report. Adding
 * a strict zero-checkpoint there would either mask that gap (by fudging the
 * expected value) or fail every run for a reason already known and flagged;
 * neither is more useful than leaving it out of this harness and calling it
 * out in prose.
 *
 * Also does NOT check 2630's "expected in-transit" against marketplace state
 * the way the live checklist's item 7 does — UJRJ (€34.10, still unresolved
 * per explicit user decision) + 4DUR (€63.10, settles 01.08) are both known,
 * named amounts; the checkpoint below asserts their sum directly.
 *
 * Tolerance: zero. Reads ALL journal_lines through 2026-07-31 (single
 * roundtrip).
 */

import './_load-env';

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Bank checkpoints @ 31.07.2026
// ---------------------------------------------------------------------------

export const BANK_CHECKPOINTS_2026_07_31: ReadonlyArray<{
  account: string;
  expected_cents: number;
  label: string;
}> = [
  // Statement closing €376.67 (before the 02.08-booked Meta charge) + €10.35
  // deferred Q2.2026 VID payment (NOT posted — open question, see header).
  { account: '2610', expected_cents: 38702, label: 'Swedbank operating — statement 31.07 (€376.67) + deferred €10.35 Q2.2026 VID payment (unresolved)' },
  { account: '2620', expected_cents: 63089, label: 'Swedbank e-commerce — matches statement 31.07 exactly, no gaps' },
  { account: '2630', expected_cents: 9720, label: 'EveryPay clearing — UJRJ (€34.10, still unresolved) + 4DUR (€63.10, settles 01.08)' }
];

export const ZERO_CHECKPOINTS_2026_07_31: ReadonlyArray<{
  account: string;
  label: string;
}> = [
  { account: '5310-HE', label: 'Hetzner payable — June-accrued €13.47 cleared in full by july_2026_entry_9' },
  { account: '5310-UN', label: 'Unisend payable — june_2026_entry_69\'s €43.92 cleared in full by july_2026_entry_13' }
];

/**
 * Non-zero-by-design checkpoints — a payable that deliberately rolls to next
 * month. Checked via sumNetDebit, same as ZERO_CHECKPOINTS but asserting a
 * specific non-zero expected value instead of zero. Mirrors May's own
 * €6.00-rollover-into-June shape (verified during June's backfill).
 */
export const ROLLOVER_CHECKPOINTS_2026_07_31: ReadonlyArray<{
  account: string;
  expected_cents: number;
  label: string;
}> = [
  { account: '5310-META', expected_cents: -500, label: 'Meta payable — €19.42 July accrual less €14.42 July payment = €5.00 rollover to August (net-debit convention: credit balance is negative)' }
];

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

interface TopContributor {
  entry_number: string;
  description: string;
  contribution_cents: number;
}

export class JulyReconciliationError extends Error {
  readonly checkpoint: string;
  readonly expected_cents: number;
  readonly observed_cents: number;
  readonly drift_cents: number;
  readonly top_contributors: TopContributor[];

  constructor(args: {
    checkpoint: string;
    expected_cents: number;
    observed_cents: number;
    top_contributors?: TopContributor[];
  }) {
    const drift = args.observed_cents - args.expected_cents;
    const driftStr = drift >= 0 ? `+${drift}` : `${drift}`;
    const contributors = args.top_contributors ?? [];
    const topStr = contributors
      .map((c) => `  ${c.entry_number}: ${c.description} (${c.contribution_cents}¢)`)
      .join('\n');
    super(
      `JulyReconciliationError at ${args.checkpoint}:\n` +
      `  expected ${args.expected_cents}¢, observed ${args.observed_cents}¢, drift ${driftStr}¢` +
      (topStr ? `\nTop contributors:\n${topStr}` : '')
    );
    this.name = 'JulyReconciliationError';
    this.checkpoint = args.checkpoint;
    this.expected_cents = args.expected_cents;
    this.observed_cents = args.observed_cents;
    this.drift_cents = drift;
    this.top_contributors = contributors;
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
  counterparty_type: string | null;
  counterparty_id: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function assertMatchesExpectedClosingState(supabase: SupabaseClient): Promise<void> {
  const allLines = await loadLinesThrough(supabase, '2026-07-31');
  const julyLines = allLines.filter((l) => l.posting_date >= '2026-07-01' && l.posting_date <= '2026-07-31');

  if (julyLines.length === 0) {
    throw new JulyReconciliationError({
      checkpoint: 'preflight',
      expected_cents: -1,
      observed_cents: 0,
      top_contributors: [{
        entry_number: '(none)',
        description: 'No July 2026 journal_lines found. Run `npx tsx scripts/july-2026-backfill.ts` first.',
        contribution_cents: 0
      }]
    });
  }

  assertBankCheckpoints(allLines);
  assertZeroCheckpoints(allLines);
  assertRolloverCheckpoints(allLines);
  assertWalletIntegrity(julyLines);
  assertGlobalBalance(allLines);
}

export async function runReconcileOnly(
  supabase: SupabaseClient
): Promise<{ status: 'pass' } | { status: 'fail'; error: JulyReconciliationError }> {
  try {
    await assertMatchesExpectedClosingState(supabase);
    return { status: 'pass' };
  } catch (err) {
    if (err instanceof JulyReconciliationError) {
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
      counterparty_type,
      counterparty_id,
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
        july_2026_entry_number?: string;
        june_2026_entry_number?: string;
        may_2026_entry_number?: string;
        april_2026_entry_number?: string;
        phase0_entry_number?: string;
      };
    };
    const entry_number = je.posting_context?.july_2026_entry_number
      ?? je.posting_context?.june_2026_entry_number
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
      description: je.narrative,
      counterparty_type: (row.counterparty_type as string | null) ?? null,
      counterparty_id: (row.counterparty_id as string | null) ?? null
    };
  });
}

function assertBankCheckpoints(allLines: ReadonlyArray<GLLine>): void {
  for (const chk of BANK_CHECKPOINTS_2026_07_31) {
    const lines = allLines.filter((l) => l.account_code === chk.account && l.posting_date <= '2026-07-31');
    const observed = sumNetDebit(lines);
    if (observed !== chk.expected_cents) {
      throw new JulyReconciliationError({
        checkpoint: `bank-walk ${chk.account} @ 2026-07-31 (${chk.label})`,
        expected_cents: chk.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(lines)
      });
    }
  }
}

function assertZeroCheckpoints(allLines: ReadonlyArray<GLLine>): void {
  for (const chk of ZERO_CHECKPOINTS_2026_07_31) {
    const lines = allLines.filter((l) => l.account_code === chk.account && l.posting_date <= '2026-07-31');
    const observed = sumNetDebit(lines);
    if (observed !== 0) {
      throw new JulyReconciliationError({
        checkpoint: `zero-out ${chk.account} @ 2026-07-31 (${chk.label})`,
        expected_cents: 0,
        observed_cents: observed,
        top_contributors: topContributors(lines)
      });
    }
  }
}

function assertRolloverCheckpoints(allLines: ReadonlyArray<GLLine>): void {
  for (const chk of ROLLOVER_CHECKPOINTS_2026_07_31) {
    const lines = allLines.filter((l) => l.account_code === chk.account && l.posting_date <= '2026-07-31');
    const observed = sumNetDebit(lines);
    if (observed !== chk.expected_cents) {
      throw new JulyReconciliationError({
        checkpoint: `rollover ${chk.account} @ 2026-07-31 (${chk.label})`,
        expected_cents: chk.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(lines)
      });
    }
  }
}

/**
 * Wallet integrity (narrow form) — every `5351` line this backfill posts
 * with a non-null counterparty_type must carry a non-null counterparty_id.
 * Does NOT reproduce the live checklist's full item-3 check (GL 5351 sum vs
 * `wallets` table) — that requires reading marketplace state this harness
 * doesn't otherwise touch; run the real `/staff/accounting` checklist after
 * posting for that full check. This catches the specific failure mode June's
 * close-repair fixed (a buyer/seller line with counterparty_type set but
 * counterparty_id left null).
 */
function assertWalletIntegrity(julyLines: ReadonlyArray<GLLine>): void {
  const unattributed = julyLines.filter(
    (l) => l.account_code === '5351' && l.counterparty_type !== null && l.counterparty_id === null
  );
  if (unattributed.length > 0) {
    throw new JulyReconciliationError({
      checkpoint: 'wallet integrity — 5351 lines with counterparty_type set but counterparty_id null',
      expected_cents: 0,
      observed_cents: unattributed.length,
      top_contributors: unattributed.map((l) => ({
        entry_number: l.entry_number,
        description: l.description,
        contribution_cents: l.debit_cents - l.credit_cents
      }))
    });
  }
}

function assertGlobalBalance(allLines: ReadonlyArray<GLLine>): void {
  const totalDr = allLines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCr = allLines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDr !== totalCr) {
    throw new JulyReconciliationError({
      checkpoint: 'Σdr = Σcr across all GL lines through 31.07.2026',
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
