/**
 * May 2026 backfill — reconciliation harness.
 *
 * Verifies the 19 May backfill emits + the cron's May P.6 depreciation produced
 * the expected GL state, and that the cumulative balance through 31.05.2026
 * (Phase 0 + April + May) matches the predicted closing trial balance.
 *
 * Four layers (run in order):
 *   1. May-only per-account delta: each non-zero May delta matches prediction.
 *      Catches a mis-routed posting that nets across the TB. 5710-LV-IN and
 *      5710-LV-OUT are intentionally absent — their May activity nets to zero
 *      after close_2026_05 P.1. The cron depreciation (1239 / 7610) IS in the
 *      map even though the backfill didn't emit it — the harness reads ALL
 *      lines, so the cron's month-4 P.6 must be accounted for.
 *   2. Bank checkpoints @ 31.05.2026:
 *        - 2610 net-debit = €383.78 (Swedbank operating statement)
 *        - 2620 net-debit = €149.20 (Swedbank e-commerce settlement statement)
 *      Plus 2630 EveryPay clearing = €150.44 (orders 4 + 6 in transit; settle
 *      1–2 June).
 *   3. Cumulative closing trial balance @ 31.05.2026: every non-zero account
 *      balance matches. Σ Dr = Σ Cr.
 *   4. VAT outputs: 5710-09 = −€7.22 (May payable to VID); 5712 OSS-EE = −€0.64
 *      (unchanged — no May OSS); 5710-LV-IN / 5710-LV-OUT cleared to zero by P.1.
 *
 * Tolerance: zero. Reads ALL journal_lines through 2026-05-31 (single roundtrip).
 */

import './_load-env';

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Expected cumulative closing trial balance @ 31.05.2026
//   Σ Dr = Σ Cr. Bank 2610 = €383.78, 2620 = €149.20 (match Swedbank statements).
//   5710-LV-IN / 5710-LV-OUT cleared by close_2026_05 P.1; €7.22 payable on 5710-09.
//   Foreign RC (5710-RC-IN/OUT) carries cumulatively, P.1 does NOT clear it.
// ---------------------------------------------------------------------------

export const CLOSING_TRIAL_BALANCE_2026_05_31: ReadonlyArray<{
  account: string;
  expected_cents: number;
}> = [
  // Assets
  { account: '1230', expected_cents: 151140 },   // C&C MacBook capitalized (unchanged)
  { account: '1239', expected_cents: -16792 },   // 4 months × €41.98 accumulated depreciation
  { account: '2380', expected_cents: 0 },         // April VID refund received in May (was +30)
  { account: '2610', expected_cents: 38378 },     // Swedbank operating — matches statement 31.05
  { account: '2620', expected_cents: 14920 },     // Swedbank e-commerce — matches statement 31.05
  { account: '2630', expected_cents: 15044 },     // EveryPay clearing — orders 4+6 in transit
  // Equity
  { account: '3110', expected_cents: -100 },      // Share capital
  { account: '3420', expected_cents: 13196 },     // 2025 loss carry-forward (unchanged mid-year)
  // Liabilities
  { account: '5340', expected_cents: -215000 },   // Three shareholder loans
  { account: '5310-UN', expected_cents: 0 },      // Unisend April invoice paid in May (was -390)
  { account: '5310-META', expected_cents: -600 }, // Meta: €13 invoiced, €7 paid; €6 payable
  { account: '5351', expected_cents: -2250 },     // Aigars wallet: €0.90 (April) + €21.60 (May orders 1+3)
  { account: '5590', expected_cents: -27164 },    // Suspense — 4 in-flight orders (2 + 4 + 5 + 6)
  // VAT (LV) — cleared to zero by close_2026_05 P.1
  { account: '5710-LV-IN', expected_cents: 0 },
  { account: '5710-LV-OUT', expected_cents: 0 },
  { account: '5710-09', expected_cents: -722 },   // May VAT payable to VID (€7.22)
  // VAT (Foreign RC; cumulative; P.1 does NOT clear) — Dec H.1 + April Hetzner + May Anthropic + Meta
  { account: '5710-RC-IN', expected_cents: 2941 },   // 778 (Apr cum.) + 2163 (Anthropic 1890 + Meta 273)
  { account: '5710-RC-OUT', expected_cents: -2941 },
  // VAT (OSS) — unchanged (no May OSS completions)
  { account: '5712', expected_cents: -64 },       // April HVFJ EE B2C OSS → Q2 2026
  // P&L 2026 YTD (not closed until 2026-12-31 P.7)
  { account: '6310-C', expected_cents: -214 },    // April -16 + May -198 (orders 1+3)
  { account: '6310-S', expected_cents: -763 },    // April -432 + May -331
  { account: '7610', expected_cents: 16792 },     // 4 months × €41.98 depreciation expense
  { account: '7710', expected_cents: 134 },       // April 65 + May 69 (Swedbank €0.09 + EveryPay €0.60)
  { account: '7720', expected_cents: 322 },       // Unisend net (unchanged — May was payment only)
  { account: '7730', expected_cents: 9191 },      // April 191 (Hetzner) + May 9000 (Anthropic)
  { account: '7740', expected_cents: 2966 },      // Phase 0 5931 − May 2965 (Vincit 50% refund)
  { account: '7750', expected_cents: 1300 },      // May Meta ads €13.00
  { account: '7770', expected_cents: 286 }        // Phase 0 C&C levy + Mollie (unchanged)
];

// May-only per-account delta (sum of debits − credits across May posting dates).
// 5710-LV-IN / 5710-LV-OUT omitted — May activity nets to zero via close_2026_05 P.1.
// 1239 / 7610 ARE here: the monthly-depreciation cron's month-4 P.6 is real May
// activity even though this backfill didn't emit it.
export const MAY_2026_PER_ACCOUNT_DELTA: ReadonlyArray<{
  account: string;
  expected_cents: number;
}> = [
  { account: '1239', expected_cents: -4198 },     // cron May depreciation
  { account: '2380', expected_cents: -30 },       // C.8 VID refund clears receivable
  { account: '2610', expected_cents: -6553 },     // matches statement A delta (449.31 → 383.78)
  { account: '2620', expected_cents: 14920 },     // matches statement B closing (opened at 0)
  { account: '2630', expected_cents: 15044 },     // orders 4+6 card clearing in transit
  { account: '5310-UN', expected_cents: 390 },    // I.7 settles April payable
  { account: '5310-META', expected_cents: -600 }, // €13 invoiced − €7 paid
  { account: '5351', expected_cents: -2160 },     // orders 1+3 seller net (€18.00 + €3.60)
  { account: '5590', expected_cents: -27164 },    // 6 payments − 2 completions
  { account: '5710-09', expected_cents: -722 },   // P.1 payable
  { account: '5710-RC-IN', expected_cents: 2163 },// Anthropic 1890 + Meta 273
  { account: '5710-RC-OUT', expected_cents: -2163 },
  { account: '6310-C', expected_cents: -198 },    // orders 1+3 commission revenue
  { account: '6310-S', expected_cents: -331 },    // orders 1+3 shipping revenue
  { account: '7610', expected_cents: 4198 },      // cron May depreciation
  { account: '7710', expected_cents: 69 },        // Swedbank €0.09 + EveryPay €0.60
  { account: '7730', expected_cents: 9000 },      // Anthropic net
  { account: '7740', expected_cents: -2965 },     // Vincit refund (expense reversal)
  { account: '7750', expected_cents: 1300 }       // Meta ads net
];

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

interface TopContributor {
  entry_number: string;
  description: string;
  contribution_cents: number;
}

export class MayReconciliationError extends Error {
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
      `MayReconciliationError at ${args.checkpoint}:\n` +
      `  expected ${args.expected_cents}¢, observed ${args.observed_cents}¢, drift ${driftStr}¢\n` +
      `Top 3 contributors:\n${topStr}`
    );
    this.name = 'MayReconciliationError';
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
  const allLines = await loadLinesThrough(supabase, '2026-05-31');
  const mayLines = allLines.filter((l) => l.posting_date >= '2026-05-01' && l.posting_date <= '2026-05-31');

  if (mayLines.length === 0) {
    throw new MayReconciliationError({
      checkpoint: 'preflight',
      expected_cents: -1,
      observed_cents: 0,
      top_contributors: [{
        entry_number: '(none)',
        description: 'No May 2026 journal_lines found. Run `npx tsx scripts/may-2026-backfill.ts` first.',
        contribution_cents: 0
      }]
    });
  }

  assertMayDeltas(mayLines);
  assertBankCheckpoints(allLines);
  assertClosingTrialBalance(allLines);
  assertVatOutputs(allLines);
}

export async function runReconcileOnly(
  supabase: SupabaseClient
): Promise<{ status: 'pass' } | { status: 'fail'; error: MayReconciliationError }> {
  try {
    await assertMatchesExpectedClosingState(supabase);
    return { status: 'pass' };
  } catch (err) {
    if (err instanceof MayReconciliationError) {
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
        may_2026_entry_number?: string;
        april_2026_entry_number?: string;
        phase0_entry_number?: string;
      };
    };
    const entry_number = je.posting_context?.may_2026_entry_number
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

function assertMayDeltas(mayLines: ReadonlyArray<GLLine>): void {
  for (const expected of MAY_2026_PER_ACCOUNT_DELTA) {
    const subset = mayLines.filter((l) => l.account_code === expected.account);
    const observed = sumNetDebit(subset);
    if (observed !== expected.expected_cents) {
      throw new MayReconciliationError({
        checkpoint: `May delta ${expected.account}`,
        expected_cents: expected.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(subset)
      });
    }
  }

  // Any account with non-zero May activity not in the delta map is unexpected.
  const expectedAccounts = new Set(MAY_2026_PER_ACCOUNT_DELTA.map((e) => e.account));
  const unexpected: string[] = [];
  for (const acc of new Set(mayLines.map((l) => l.account_code))) {
    if (!expectedAccounts.has(acc)) {
      const balance = sumNetDebit(mayLines.filter((l) => l.account_code === acc));
      if (balance !== 0) unexpected.push(`${acc}=${balance}¢`);
    }
  }
  if (unexpected.length > 0) {
    throw new MayReconciliationError({
      checkpoint: 'unexpected non-zero accounts in May delta',
      expected_cents: 0,
      observed_cents: unexpected.length,
      top_contributors: unexpected.map((entry) => ({ entry_number: '(account)', description: entry, contribution_cents: 0 }))
    });
  }
}

function assertBankCheckpoints(allLines: ReadonlyArray<GLLine>): void {
  const CHECKS: Array<{ account: string; expected: number; label: string }> = [
    { account: '2610', expected: 38378, label: 'Swedbank operating (statement A)' },
    { account: '2620', expected: 14920, label: 'Swedbank e-commerce (statement B)' },
    { account: '2630', expected: 15044, label: 'EveryPay clearing (orders 4+6 in transit)' }
  ];
  for (const chk of CHECKS) {
    const lines = allLines.filter((l) => l.account_code === chk.account && l.posting_date <= '2026-05-31');
    const observed = sumNetDebit(lines);
    if (observed !== chk.expected) {
      throw new MayReconciliationError({
        checkpoint: `bank-walk ${chk.account} @ 2026-05-31 (${chk.label})`,
        expected_cents: chk.expected,
        observed_cents: observed,
        top_contributors: topContributors(lines)
      });
    }
  }
}

function assertClosingTrialBalance(allLines: ReadonlyArray<GLLine>): void {
  for (const expected of CLOSING_TRIAL_BALANCE_2026_05_31) {
    const subset = allLines.filter((l) => l.account_code === expected.account && l.posting_date <= '2026-05-31');
    const observed = sumNetDebit(subset);
    if (observed !== expected.expected_cents) {
      throw new MayReconciliationError({
        checkpoint: `closing TB ${expected.account} @ 2026-05-31`,
        expected_cents: expected.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(subset)
      });
    }
  }

  const totalDr = allLines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCr = allLines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDr !== totalCr) {
    throw new MayReconciliationError({
      checkpoint: 'Σdr = Σcr across all GL lines through 31.05.2026',
      expected_cents: 0,
      observed_cents: totalDr - totalCr,
      top_contributors: []
    });
  }

  const expectedAccounts = new Set(CLOSING_TRIAL_BALANCE_2026_05_31.map((e) => e.account));
  const unexpected: string[] = [];
  for (const acc of new Set(allLines.map((l) => l.account_code))) {
    if (!expectedAccounts.has(acc)) {
      const balance = sumNetDebit(allLines.filter((l) => l.account_code === acc));
      if (balance !== 0) unexpected.push(`${acc}=${balance}¢`);
    }
  }
  if (unexpected.length > 0) {
    throw new MayReconciliationError({
      checkpoint: 'unexpected non-zero accounts in closing TB',
      expected_cents: 0,
      observed_cents: unexpected.length,
      top_contributors: unexpected.map((entry) => ({ entry_number: '(account)', description: entry, contribution_cents: 0 }))
    });
  }
}

function assertVatOutputs(allLines: ReadonlyArray<GLLine>): void {
  const CHECKS: Array<{ account: string; expected: number; label: string }> = [
    { account: '5710-09', expected: -722, label: 'May VAT payable to VID (€7.22)' },
    { account: '5710-LV-IN', expected: 0, label: 'LV input VAT cleared by P.1' },
    { account: '5710-LV-OUT', expected: 0, label: 'LV output VAT cleared by P.1' },
    { account: '5712', expected: -64, label: 'OSS-EE unchanged (no May OSS)' }
  ];
  for (const chk of CHECKS) {
    const lines = allLines.filter((l) => l.account_code === chk.account && l.posting_date <= '2026-05-31');
    const observed = sumNetDebit(lines);
    if (observed !== chk.expected) {
      throw new MayReconciliationError({
        checkpoint: `VAT output ${chk.account} @ 2026-05-31 (${chk.label})`,
        expected_cents: chk.expected,
        observed_cents: observed,
        top_contributors: topContributors(lines)
      });
    }
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
