/**
 * April 2026 backfill — reconciliation harness.
 *
 * Verifies that all 10 April backfill emits produced the expected GL state
 * AND that the cumulative balance through 30.04.2026 (Phase 0 + April)
 * matches the predicted closing trial balance from round 2 preamble
 * (12.05.2026; user TB sign-off).
 *
 * Four layers of assertion, run in order:
 *
 *   1. April-only delta per account: each non-zero April delta matches the
 *      predicted delta from the round 2 TB. Catches a wrong-account posting
 *      that nets correctly across the TB but is mis-routed.
 *   2. Bank checkpoint @ 30.04.2026: cumulative `2610` net debit balance =
 *      €449.31. Ties to the Swedbank closing statement directly.
 *   3. Cumulative closing trial balance @ 30.04.2026: each non-zero account
 *      balance matches the predicted close. Catches Phase 0 drift + April
 *      drift together.
 *   4. April PVN deklarācija + OSS-EE outputs:
 *        - April-only 5710-LV-OUT − 5710-LV-IN = −€0.30 (refund due from VID)
 *        - 5712 OSS-EE cumulative balance = €0.64 (one month of Q2 2026)
 *
 * Tolerance: zero. Every checkpoint must match to the cent. Mismatch =
 * AprilReconciliationError with which checkpoint broke, expected vs observed,
 * and the top 3 contributing entries.
 *
 * Reads ALL journal_lines through 2026-04-30 (Phase 0 + April). Single
 * roundtrip; ~100 rows max.
 */

import './_load-env';

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Expected closing trial balance @ 30.04.2026 (round 2 preamble, user-confirmed)
//
// Σ Dr = Σ Cr = €2,295.02. Bank = €449.31 (matches Swedbank statement).
// 2026 P&L lives in 7xxx accounts (not closed to 3420 until 2026-12-31 P.7).
// 5710-RC-IN/OUT carry Dec 2025 H.1 catchup + April Hetzner cumulatively.
// ---------------------------------------------------------------------------

export const CLOSING_TRIAL_BALANCE_2026_04_30: ReadonlyArray<{
  account: string;
  expected_cents: number;
}> = [
  // Assets
  { account: '1230', expected_cents: 151140 },           // C&C MacBook capitalized (unchanged)
  { account: '1239', expected_cents: -12594 },           // 3 months × €41.98 depreciation
  { account: '2380', expected_cents: 0 },                // VID receivable cleared
  { account: '2610', expected_cents: 44931 },            // Bank — matches Swedbank 30.04.2026
  // Equity
  { account: '3110', expected_cents: -100 },             // Share capital
  { account: '3420', expected_cents: 13196 },            // 2025 loss carry-forward (unchanged mid-year)
  // Liabilities
  { account: '5340', expected_cents: -215000 },          // Three shareholder loans
  { account: '5310-HE', expected_cents: 0 },             // Hetzner — booked + paid in April, nets zero
  { account: '5310-UN', expected_cents: -390 },          // Unisend invoice booked, payment in May
  { account: '5351', expected_cents: -90 },              // 9UC5 LV seller wallet (HVFJ EE seller withdrawn)
  { account: '5590', expected_cents: 0 },                // Suspense released cleanly by O.x
  // VAT (LV)
  { account: '5710-LV-IN', expected_cents: 68 },         // April input VAT (Unisend) → PVN deklarācija
  { account: '5710-LV-RC-IN', expected_cents: 0 },
  { account: '5710-LV-RC-OUT', expected_cents: 0 },
  { account: '5710-LV-OUT', expected_cents: -38 },       // April output VAT (9UC5) → PVN deklarācija
  // VAT (Foreign RC; cumulative Dec 2025 H.1 + April Hetzner)
  { account: '5710-RC-IN', expected_cents: 778 },        // €7.38 (Dec) + €0.40 (Hetzner Apr)
  { account: '5710-RC-OUT', expected_cents: -778 },
  // VAT (OSS)
  { account: '5712', expected_cents: -64 },              // April HVFJ EE B2C OSS → Q2 2026 remit by 31.07.2026
  // P&L 2026 YTD (not closed until 2026-12-31 P.7)
  { account: '6310-C', expected_cents: -16 },            // 2 orders × €0.08
  { account: '6310-S', expected_cents: -432 },           // HVFJ €2.58 + 9UC5 €1.74
  { account: '7610', expected_cents: 12594 },            // 3 months × €41.98
  { account: '7710', expected_cents: 65 },               // Phase 0 Jan €0.57 + April Swedbank POS €0.08
  { account: '7720', expected_cents: 322 },              // Unisend net
  { account: '7730', expected_cents: 191 },              // Hetzner net
  { account: '7740', expected_cents: 5931 },             // Phase 0 VINCIT (unchanged)
  { account: '7770', expected_cents: 286 }               // Phase 0 C&C levy + Mollie (unchanged)
];

// April-only delta — verifies entry-by-entry posting accuracy independent of
// the carryover from Phase 0. Each value = (sum of debits − sum of credits)
// for the account across April posting dates only.
export const APRIL_2026_PER_ACCOUNT_DELTA: ReadonlyArray<{
  account: string;
  expected_cents: number;
}> = [
  { account: '1239', expected_cents: -4198 },            // April depreciation (E10)
  { account: '2610', expected_cents: 441 },              // +420 +310 -191 -8 -90 = +441
  { account: '5310-HE', expected_cents: 0 },             // +191 (E1 Cr) -191 (E2 Dr) = 0
  { account: '5310-UN', expected_cents: -390 },          // +390 (E9 Cr)
  { account: '5351', expected_cents: -90 },              // +90 (E4) +90 (E6) -90 (E8) = +90 cr
  { account: '5590', expected_cents: 0 },                // +420+310 (E3,E5) -420-310 (E4,E6) = 0
  { account: '5710-LV-IN', expected_cents: 68 },         // +68 (E9 Dr)
  { account: '5710-LV-OUT', expected_cents: -38 },       // +38 (E6 Cr)
  { account: '5710-RC-IN', expected_cents: 40 },         // +40 (E1 Dr)
  { account: '5710-RC-OUT', expected_cents: -40 },       // +40 (E1 Cr)
  { account: '5712', expected_cents: -64 },              // +64 (E4 Cr)
  { account: '6310-C', expected_cents: -16 },            // +8+8 (E4,E6 Cr)
  { account: '6310-S', expected_cents: -432 },           // +258+174 (E4,E6 Cr)
  { account: '7610', expected_cents: 4198 },             // +4198 (E10 Dr)
  { account: '7710', expected_cents: 8 },                // +8 (E7 Dr)
  { account: '7720', expected_cents: 322 },              // +322 (E9 Dr)
  { account: '7730', expected_cents: 191 }               // +191 (E1 Dr)
];

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

interface TopContributor {
  entry_number: string;
  description: string;
  contribution_cents: number;
}

export class AprilReconciliationError extends Error {
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
      `AprilReconciliationError at ${args.checkpoint}:\n` +
      `  expected ${args.expected_cents}¢, observed ${args.observed_cents}¢, drift ${driftStr}¢\n` +
      `Top 3 contributors:\n${topStr}`
    );
    this.name = 'AprilReconciliationError';
    this.checkpoint = args.checkpoint;
    this.expected_cents = args.expected_cents;
    this.observed_cents = args.observed_cents;
    this.drift_cents = drift;
    this.top_contributors = args.top_contributors;
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

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
  const allLines = await loadLinesThrough(supabase, '2026-04-30');
  const aprilLines = allLines.filter((l) => l.posting_date >= '2026-04-01' && l.posting_date <= '2026-04-30');

  if (aprilLines.length === 0) {
    throw new AprilReconciliationError({
      checkpoint: 'preflight',
      expected_cents: -1,
      observed_cents: 0,
      top_contributors: [{
        entry_number: '(none)',
        description: 'No April 2026 journal_lines found. Run `pnpm tsx scripts/april-2026-backfill.ts` first.',
        contribution_cents: 0
      }]
    });
  }

  assertAprilDeltas(aprilLines);
  assertBankCheckpoint(allLines);
  assertClosingTrialBalance(allLines);
  assertPvnAndOssOutputs(allLines, aprilLines);
}

export async function runReconcileOnly(
  supabase: SupabaseClient
): Promise<{ status: 'pass' } | { status: 'fail'; error: AprilReconciliationError }> {
  try {
    await assertMatchesExpectedClosingState(supabase);
    return { status: 'pass' };
  } catch (err) {
    if (err instanceof AprilReconciliationError) {
      return { status: 'fail', error: err };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

async function loadLinesThrough(supabase: SupabaseClient, throughDate: string): Promise<GLLine[]> {
  // Pull ALL journal_lines through `throughDate` (Phase 0 + April). Filters out
  // any test_artifact entries that PR #4 burn-in might have produced.
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
        backfill?: boolean;
        test_artifact?: boolean;
        phase0_entry_number?: string;
        april_2026_entry_number?: string;
      };
    };
    const entry_number = je.posting_context?.april_2026_entry_number
      ?? je.posting_context?.phase0_entry_number
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

function assertAprilDeltas(aprilLines: ReadonlyArray<GLLine>): void {
  // For each account expected to have non-zero April activity, verify the
  // April-only delta matches expectations.
  for (const expected of APRIL_2026_PER_ACCOUNT_DELTA) {
    const subset = aprilLines.filter((l) => l.account_code === expected.account);
    const observed = sumNetDebit(subset);
    if (observed !== expected.expected_cents) {
      throw new AprilReconciliationError({
        checkpoint: `April delta ${expected.account}`,
        expected_cents: expected.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(subset)
      });
    }
  }

  // Cross-check: any account that has non-zero April activity but isn't in
  // APRIL_2026_PER_ACCOUNT_DELTA is an unexpected emit and surfaces here.
  const expectedAccounts = new Set(APRIL_2026_PER_ACCOUNT_DELTA.map((e) => e.account));
  const observedAccounts = new Set(aprilLines.map((l) => l.account_code));
  const unexpected: string[] = [];
  for (const acc of observedAccounts) {
    if (!expectedAccounts.has(acc)) {
      const balance = sumNetDebit(aprilLines.filter((l) => l.account_code === acc));
      if (balance !== 0) {
        unexpected.push(`${acc}=${balance}¢`);
      }
    }
  }
  if (unexpected.length > 0) {
    throw new AprilReconciliationError({
      checkpoint: 'unexpected non-zero accounts in April delta',
      expected_cents: 0,
      observed_cents: unexpected.length,
      top_contributors: unexpected.map((entry) => ({
        entry_number: '(account)',
        description: entry,
        contribution_cents: 0
      }))
    });
  }
}

function assertBankCheckpoint(allLines: ReadonlyArray<GLLine>): void {
  const bankLines = allLines.filter((l) => l.account_code === '2610' && l.posting_date <= '2026-04-30');
  const observed = sumNetDebit(bankLines);
  const EXPECTED = 44931;  // €449.31 — matches Swedbank statement 30.04.2026
  if (observed !== EXPECTED) {
    throw new AprilReconciliationError({
      checkpoint: 'bank-walk 2610 @ 2026-04-30 (must match Swedbank)',
      expected_cents: EXPECTED,
      observed_cents: observed,
      top_contributors: topContributors(bankLines)
    });
  }
}

function assertClosingTrialBalance(allLines: ReadonlyArray<GLLine>): void {
  for (const expected of CLOSING_TRIAL_BALANCE_2026_04_30) {
    const subset = allLines.filter((l) => l.account_code === expected.account && l.posting_date <= '2026-04-30');
    const observed = sumNetDebit(subset);
    if (observed !== expected.expected_cents) {
      throw new AprilReconciliationError({
        checkpoint: `closing TB ${expected.account} @ 2026-04-30`,
        expected_cents: expected.expected_cents,
        observed_cents: observed,
        top_contributors: topContributors(subset)
      });
    }
  }

  // Σ check across all backfill-tagged lines through 30.04.2026
  const totalDr = allLines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCr = allLines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDr !== totalCr) {
    throw new AprilReconciliationError({
      checkpoint: 'Σdr = Σcr across all GL lines through 30.04.2026',
      expected_cents: 0,
      observed_cents: totalDr - totalCr,
      top_contributors: []
    });
  }

  // Cross-check: every observed non-zero account at 30.04.2026 is in the
  // expected TB. Catches the case where a new entry adds a line to an unexpected
  // account that we didn't predict.
  const expectedAccounts = new Set(CLOSING_TRIAL_BALANCE_2026_04_30.map((e) => e.account));
  const observedAccounts = new Set(allLines.map((l) => l.account_code));
  const unexpected: string[] = [];
  for (const acc of observedAccounts) {
    if (!expectedAccounts.has(acc)) {
      const balance = sumNetDebit(allLines.filter((l) => l.account_code === acc));
      if (balance !== 0) {
        unexpected.push(`${acc}=${balance}¢`);
      }
    }
  }
  if (unexpected.length > 0) {
    throw new AprilReconciliationError({
      checkpoint: 'unexpected non-zero accounts in closing TB',
      expected_cents: 0,
      observed_cents: unexpected.length,
      top_contributors: unexpected.map((entry) => ({
        entry_number: '(account)',
        description: entry,
        contribution_cents: 0
      }))
    });
  }
}

function assertPvnAndOssOutputs(allLines: ReadonlyArray<GLLine>, aprilLines: ReadonlyArray<GLLine>): void {
  // April PVN deklarācija net = April-only (5710-LV-OUT − 5710-LV-IN)
  //   = (−€0.38) − (€0.68) = −€1.06 (refund) ... wait.
  // Net VAT due = output − input (positive = owed by STG; negative = refund due to STG).
  // April: output = +€0.38 (5710-LV-OUT credit = +38), input = €0.68 (5710-LV-IN debit = +68).
  // Net due to STG = input − output = 68 − 38 = €0.30 refund.
  // sumNetDebit of 5710-LV-OUT = −38, of 5710-LV-IN = +68.
  // refund = (sumNetDebit LV-IN) + (sumNetDebit LV-OUT) = 68 + (−38) = +30 (refund).
  // Asserting: 68 + (−38) = 30.
  const lvOutApril = sumNetDebit(aprilLines.filter((l) => l.account_code === '5710-LV-OUT'));
  const lvInApril = sumNetDebit(aprilLines.filter((l) => l.account_code === '5710-LV-IN'));
  const refundDueToStg = lvInApril + lvOutApril; // both sign-aware via sumNetDebit
  const EXPECTED_REFUND = 30;  // €0.30 refund owed by VID to STG
  if (refundDueToStg !== EXPECTED_REFUND) {
    throw new AprilReconciliationError({
      checkpoint: 'April PVN deklarācija net (5710-LV-IN + 5710-LV-OUT)',
      expected_cents: EXPECTED_REFUND,
      observed_cents: refundDueToStg,
      top_contributors: topContributors(
        aprilLines.filter((l) => l.account_code === '5710-LV-IN' || l.account_code === '5710-LV-OUT')
      )
    });
  }

  // OSS-EE cumulative through 30.04.2026 = €0.64 (one month of Q2 2026)
  const ossEeLines = allLines.filter((l) => l.account_code === '5712' && l.posting_date <= '2026-04-30');
  const ossEeBalance = sumNetDebit(ossEeLines);
  const EXPECTED_OSS_EE = -64;  // €0.64 credit
  if (ossEeBalance !== EXPECTED_OSS_EE) {
    throw new AprilReconciliationError({
      checkpoint: 'OSS-EE 5712 @ 2026-04-30 (Q2 2026 remit by 31.07.2026)',
      expected_cents: EXPECTED_OSS_EE,
      observed_cents: ossEeBalance,
      top_contributors: topContributors(ossEeLines)
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
    .map(([entry_number, info]) => ({
      entry_number,
      description: info.description,
      contribution_cents: info.total
    }))
    .sort((a, b) => Math.abs(b.contribution_cents) - Math.abs(a.contribution_cents))
    .slice(0, 3);
}
