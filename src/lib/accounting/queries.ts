/**
 * Accounting read-side queries (PR #4).
 *
 * The posting engine in posting-engine.ts is the only writer. This module is
 * its read counterpart — pure data primitives consumed by the staff UI in
 * Tasks 5–12 (trial balance, account ledger, journal entry detail, wallet
 * integrity, recent activity dashboard, period-close checklist).
 *
 * Conventions:
 *   - All monetary values are integer cents (number in TS, bigint in DB). No
 *     floats. Sign convention: net_debit_cents = debit_cents - credit_cents
 *     (positive = debit normal — assets, expenses).
 *   - includeBackfill=false filters journal_entries.posting_context.backfill
 *     entries (Phase 0 historical catch-up). Default is true (show everything)
 *     so backfill rows are visible by default and the UI surfaces a toggle.
 *   - excludeTestArtifacts=true (default) filters journal_entries.posting_context.test_artifact
 *     entries. Per CLAUDE.md, integration tests post entries to synthetic period
 *     2027-01 with `posting_context.test_artifact=true`; those entries persist
 *     permanently (immutability trigger blocks DELETE) but must not pollute
 *     production reporting once the system date crosses the synthetic posting_date.
 *   - Σ debit = Σ credit must hold for every entry and the trial balance as a
 *     whole. is_balanced surfaces violations loudly — they should never occur
 *     against a healthy GL (the deferred constraint trigger from migration
 *     094 prevents inserts that don't balance), but the UI shows the flag
 *     anyway so a corrupted row is caught visually.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AccountRow,
  AccountType,
  JournalEntryRow,
  JournalLineRow,
  PeriodRow,
  PeriodType
} from './types';

// =============================================================================
// Types
// =============================================================================

export interface TrialBalanceRow {
  account_code: string;
  account_name_lv: string;
  account_name_en: string;
  account_type: AccountRow['type'];
  debit_cents: number;
  credit_cents: number;
  /** Signed: debit_cents - credit_cents. Positive = debit normal. */
  net_debit_cents: number;
}

export interface TrialBalance {
  as_of: string;
  rows: TrialBalanceRow[];
  total_debit_cents: number;
  total_credit_cents: number;
  is_balanced: boolean;
}

export interface AccountLedgerLine {
  line: JournalLineRow;
  entry: JournalEntryRow;
  /** Signed; positive = debit. Same convention across all account types. */
  running_balance_cents: number;
}

export interface AccountLedger {
  account: AccountRow;
  range: { from: string; to: string };
  opening_balance_cents: number;
  lines: AccountLedgerLine[];
  closing_balance_cents: number;
}

export interface JournalEntryDetail {
  entry: JournalEntryRow;
  lines: Array<JournalLineRow & { account_name_lv: string; account_name_en: string }>;
  total_debit_cents: number;
  total_credit_cents: number;
  is_balanced: boolean;
}

export interface WalletIntegrityCheck {
  as_of: string;
  gl_5351_sum_cents: number;
  wallet_table_sum_cents: number;
  delta_cents: number;
  is_reconciled: boolean;
  /**
   * Net GL balance of any 5351 lines whose counterparty cannot be resolved
   * to a user_id (null counterparty_id, missing counterparty row, or
   * counterparty.user_id IS NULL — e.g. a system counterparty). Such lines
   * still contribute to gl_5351_sum_cents and therefore delta_cents, but
   * cannot land in per_seller_deltas. Surfacing them separately keeps the
   * arithmetic explainable: delta_cents = sum(per_seller_deltas) +
   * unattributed_gl_cents − (wallet rows without a GL counterpart, captured
   * inversely in per_seller_deltas as negative deltas). UI in Task 10
   * surfaces this when non-zero.
   */
  unattributed_gl_cents: number;
  per_seller_deltas: Array<{
    /** Canonical user_id (user_profiles.id), not the counterparty_id. */
    seller_user_id: string;
    seller_handle: string | null;
    gl_balance_cents: number;
    wallet_balance_cents: number;
    delta_cents: number;
  }>;
}


// =============================================================================
// Helpers
// =============================================================================

/** Embedded shape returned by PostgREST `journal_entries!inner(...)` join. */
interface EmbeddedEntryFields {
  posting_date: string;
  posting_context: Record<string, unknown> | null;
}

interface JoinedLineRow {
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  journal_entries: EmbeddedEntryFields | null;
}

/**
 * True if the embedded entry is a Phase 0 backfill entry. Used to filter
 * trial balance and account ledger when includeBackfill=false.
 *
 * Match shape: `posting_context.backfill === true` (boolean). Anything else
 * (null context, missing key, false, "true" as string) is treated as
 * non-backfill — the backfill script in scripts/phase0-backfill-data.ts
 * always writes the boolean true.
 */
function isBackfillEntry(entry: EmbeddedEntryFields | null | undefined): boolean {
  if (!entry || !entry.posting_context) return false;
  return entry.posting_context.backfill === true;
}

/**
 * True if the embedded entry is a test_artifact entry written by integration
 * tests. Used to exclude such entries from production reporting views by
 * default (excludeTestArtifacts=true).
 *
 * Match shape: `posting_context.test_artifact === true` (boolean), strict
 * equality — same convention as isBackfillEntry. Per CLAUDE.md, integration
 * tests post to synthetic period 2027-01 with this flag set; entries persist
 * permanently because the immutability trigger blocks DELETE.
 */
function isTestArtifactEntry(entry: EmbeddedEntryFields | null | undefined): boolean {
  if (!entry || !entry.posting_context) return false;
  return entry.posting_context.test_artifact === true;
}

function throwIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

// =============================================================================
// getTrialBalance
// =============================================================================

/**
 * Aggregate all journal lines whose entries have posting_date <= asOf into a
 * per-account trial balance. Joins accounts(name_lv, name_en, type) so the UI
 * doesn't need a second roundtrip.
 *
 * Σ debit must equal Σ credit across the whole GL. is_balanced surfaces any
 * violation — the deferred constraint trigger from migration 094 makes this
 * impossible against a healthy GL, but the flag is shown to staff anyway so
 * a corrupted row would be caught visually.
 */
export async function getTrialBalance(
  supabase: SupabaseClient,
  asOf: string,
  options: { includeBackfill?: boolean; excludeTestArtifacts?: boolean } = {}
): Promise<TrialBalance> {
  const includeBackfill = options.includeBackfill ?? true;
  const excludeTestArtifacts = options.excludeTestArtifacts ?? true;

  const { data: lineRows, error: linesError } = await supabase
    .from('journal_lines')
    .select(
      'account_code, debit_cents, credit_cents, journal_entries!inner(posting_date, posting_context)'
    )
    .lte('journal_entries.posting_date', asOf);

  throwIfError(linesError, 'getTrialBalance: journal_lines SELECT failed');

  const lines = (lineRows ?? []) as unknown as JoinedLineRow[];

  // Aggregate per account_code, filtering out backfill and test_artifact entries
  // when requested. test_artifact defaults to excluded (production reports must
  // not see synthetic-period test rows).
  const totals = new Map<string, { debit_cents: number; credit_cents: number }>();
  for (const row of lines) {
    if (!includeBackfill && isBackfillEntry(row.journal_entries)) continue;
    if (excludeTestArtifacts && isTestArtifactEntry(row.journal_entries)) continue;
    const current = totals.get(row.account_code) ?? { debit_cents: 0, credit_cents: 0 };
    current.debit_cents += row.debit_cents;
    current.credit_cents += row.credit_cents;
    totals.set(row.account_code, current);
  }

  // Empty trial balance — early return without an accounts roundtrip.
  if (totals.size === 0) {
    return {
      as_of: asOf,
      rows: [],
      total_debit_cents: 0,
      total_credit_cents: 0,
      is_balanced: true
    };
  }

  const codes = Array.from(totals.keys());
  const { data: accountRows, error: accountsError } = await supabase
    .from('accounts')
    .select('code, name_lv, name_en, type')
    .in('code', codes);

  throwIfError(accountsError, 'getTrialBalance: accounts SELECT failed');

  const accountsByCode = new Map<
    string,
    { name_lv: string; name_en: string; type: AccountType }
  >();
  for (const acc of (accountRows ?? []) as Array<{
    code: string;
    name_lv: string;
    name_en: string;
    type: AccountType;
  }>) {
    accountsByCode.set(acc.code, { name_lv: acc.name_lv, name_en: acc.name_en, type: acc.type });
  }

  const rows: TrialBalanceRow[] = codes.map((code) => {
    const sums = totals.get(code) ?? { debit_cents: 0, credit_cents: 0 };
    const acc = accountsByCode.get(code);
    return {
      account_code: code,
      account_name_lv: acc?.name_lv ?? '',
      account_name_en: acc?.name_en ?? '',
      account_type: acc?.type ?? 'asset',
      debit_cents: sums.debit_cents,
      credit_cents: sums.credit_cents,
      net_debit_cents: sums.debit_cents - sums.credit_cents
    };
  });

  // Sort by account_code lexicographically so reports are stable across runs.
  rows.sort((a, b) => a.account_code.localeCompare(b.account_code));

  const total_debit_cents = rows.reduce((acc, r) => acc + r.debit_cents, 0);
  const total_credit_cents = rows.reduce((acc, r) => acc + r.credit_cents, 0);

  return {
    as_of: asOf,
    rows,
    total_debit_cents,
    total_credit_cents,
    is_balanced: total_debit_cents === total_credit_cents
  };
}

// =============================================================================
// getAccountLedger
// =============================================================================

/**
 * Per-account ledger over a date range. Opening = sum of net_debit before
 * range.from; closing = opening + sum of in-range net_debit. Running balance
 * is uniform sign convention (positive = debit) regardless of account type;
 * callers translate for credit-normal accounts (liabilities/equity/revenue).
 *
 * TODO(post-launch): currently fetches the full lifetime of the account
 * (no opening lower bound) and partitions opening vs in-range in memory.
 * Justified for Phase 0 + initial activity (small volume); revisit when
 * any single account exceeds ~10k lines. Switch to two roundtrips:
 * one for opening balance aggregation, one for in-range lines.
 */
export async function getAccountLedger(
  supabase: SupabaseClient,
  accountCode: string,
  range: { from: string; to: string },
  options: { includeBackfill?: boolean; excludeTestArtifacts?: boolean } = {}
): Promise<AccountLedger> {
  const includeBackfill = options.includeBackfill ?? true;
  const excludeTestArtifacts = options.excludeTestArtifacts ?? true;

  const { data: accountData, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('code', accountCode)
    .maybeSingle();

  throwIfError(accountError, 'getAccountLedger: accounts SELECT failed');
  if (!accountData) {
    throw new Error(`getAccountLedger: account ${accountCode} not found`);
  }
  const account = accountData as AccountRow;

  // Pull every line for this account, joined with its entry header for
  // posting_date / posting_context filtering and date sorting. Two sweeps:
  // one for opening balance (lines before range.from), one for in-range.
  // We do this in a single query and partition in memory rather than two
  // queries, since the line count per account in the seed window is small
  // (Phase 0 + initial production = ~hundreds at most).
  const { data: lineRows, error: linesError } = await supabase
    .from('journal_lines')
    .select(
      '*, journal_entries!inner(id, posting_date, accounting_period, tax_period, entry_type, type_id, source_doc_type, source_doc_id, reverses_entry_id, correction_reason, narrative, posting_context, created_by, created_at, period_close_adjustment)'
    )
    .eq('account_code', accountCode)
    .lte('journal_entries.posting_date', range.to)
    .order('posting_date', { foreignTable: 'journal_entries', ascending: true });

  throwIfError(linesError, 'getAccountLedger: journal_lines SELECT failed');

  type JoinedRow = JournalLineRow & { journal_entries: JournalEntryRow };
  const allRows = ((lineRows ?? []) as unknown as JoinedRow[]).filter((row) => {
    if (!row.journal_entries) return false;
    if (!includeBackfill && isBackfillEntry(row.journal_entries)) return false;
    if (excludeTestArtifacts && isTestArtifactEntry(row.journal_entries)) return false;
    return true;
  });

  // Stable secondary sort by created_at then line_number. PostgREST already
  // sorted by posting_date ASC; we re-sort the in-memory array to apply the
  // tiebreakers deterministically.
  allRows.sort((a, b) => {
    const dateCmp = a.journal_entries.posting_date.localeCompare(
      b.journal_entries.posting_date
    );
    if (dateCmp !== 0) return dateCmp;
    const createdCmp = a.journal_entries.created_at.localeCompare(
      b.journal_entries.created_at
    );
    if (createdCmp !== 0) return createdCmp;
    return a.line_number - b.line_number;
  });

  let opening_balance_cents = 0;
  const inRange: JoinedRow[] = [];
  for (const row of allRows) {
    const date = row.journal_entries.posting_date;
    if (date < range.from) {
      opening_balance_cents += row.debit_cents - row.credit_cents;
    } else {
      inRange.push(row);
    }
  }

  let running = opening_balance_cents;
  const lines: AccountLedgerLine[] = inRange.map((row) => {
    running += row.debit_cents - row.credit_cents;
    // Strip the embedded entry from the line shape — the API contract is
    // { line, entry, running_balance_cents } as separate fields.
    const { journal_entries: entry, ...lineCore } = row;
    return {
      line: lineCore as JournalLineRow,
      entry,
      running_balance_cents: running
    };
  });

  return {
    account,
    range,
    opening_balance_cents,
    lines,
    closing_balance_cents: running
  };
}

// =============================================================================
// getJournalEntry
// =============================================================================

/**
 * One entry with its full line tape and joined account names. is_balanced
 * surfaces any sum mismatch — should never happen against a healthy GL but
 * the UI flags it visually so corruption isn't silent.
 */
export async function getJournalEntry(
  supabase: SupabaseClient,
  entryId: string
): Promise<JournalEntryDetail> {
  const { data: entryData, error: entryError } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .maybeSingle();

  throwIfError(entryError, 'getJournalEntry: journal_entries SELECT failed');
  if (!entryData) {
    throw new Error(`getJournalEntry: entry ${entryId} not found`);
  }
  const entry = entryData as JournalEntryRow;

  const { data: lineRows, error: linesError } = await supabase
    .from('journal_lines')
    .select('*, accounts!inner(name_lv, name_en)')
    .eq('entry_id', entryId)
    .order('line_number', { ascending: true });

  throwIfError(linesError, 'getJournalEntry: journal_lines SELECT failed');

  type JoinedLine = JournalLineRow & {
    accounts: { name_lv: string; name_en: string } | null;
  };
  const lines = ((lineRows ?? []) as unknown as JoinedLine[]).map((row) => {
    const { accounts, ...lineCore } = row;
    return {
      ...(lineCore as JournalLineRow),
      account_name_lv: accounts?.name_lv ?? '',
      account_name_en: accounts?.name_en ?? ''
    };
  });

  const total_debit_cents = lines.reduce((acc, l) => acc + l.debit_cents, 0);
  const total_credit_cents = lines.reduce((acc, l) => acc + l.credit_cents, 0);

  return {
    entry,
    lines,
    total_debit_cents,
    total_credit_cents,
    is_balanced: total_debit_cents === total_credit_cents
  };
}

// =============================================================================
// getWalletIntegrity
// =============================================================================

/**
 * Cross-check the GL seller wallet liability (account 5351) against the
 * canonical wallets.balance_cents totals. delta=0 = reconciled. Per-seller
 * deltas surface mismatches with seller handle for staff investigation.
 *
 * 5351 is credit-normal (liability), so the GL balance is computed as
 * SUM(credit) - SUM(debit). Wallet table balances are unsigned positive cents
 * (the wallets.balance_cents CHECK enforces >= 0).
 *
 * Phase 0 case (no live wallets): both sums are 0, delta is 0, per_seller_deltas
 * is empty.
 */
export async function getWalletIntegrity(
  supabase: SupabaseClient
): Promise<WalletIntegrityCheck> {
  const as_of = new Date().toISOString();

  // 1. GL side: every line on account 5351, with counterparty for per-seller.
  const { data: glLineRows, error: glError } = await supabase
    .from('journal_lines')
    .select('debit_cents, credit_cents, counterparty_id')
    .eq('account_code', '5351');

  throwIfError(glError, 'getWalletIntegrity: journal_lines 5351 SELECT failed');

  const glRows = (glLineRows ?? []) as Array<{
    debit_cents: number;
    credit_cents: number;
    counterparty_id: string | null;
  }>;

  let gl_5351_sum_cents = 0;
  // GL balance per counterparty_id (signed credit-normal: credit - debit).
  const glPerCounterparty = new Map<string, number>();
  // GL balance for lines with no counterparty_id at all — accumulated
  // separately so we don't silently drop them during the per-seller
  // resolution pass below. Lines with a counterparty_id whose row is
  // missing or whose user_id is null also flow into unattributed_gl_cents
  // (handled in the resolution loop further down).
  let unattributed_gl_cents = 0;
  for (const row of glRows) {
    const signed = row.credit_cents - row.debit_cents;
    gl_5351_sum_cents += signed;
    if (row.counterparty_id) {
      glPerCounterparty.set(
        row.counterparty_id,
        (glPerCounterparty.get(row.counterparty_id) ?? 0) + signed
      );
    } else {
      unattributed_gl_cents += signed;
    }
  }

  // 2. Wallet table side: every wallet balance.
  const { data: walletRows, error: walletError } = await supabase
    .from('wallets')
    .select('user_id, balance_cents');

  throwIfError(walletError, 'getWalletIntegrity: wallets SELECT failed');

  const wallets = (walletRows ?? []) as Array<{ user_id: string; balance_cents: number }>;
  const walletByUserId = new Map<string, number>();
  let wallet_table_sum_cents = 0;
  for (const w of wallets) {
    walletByUserId.set(w.user_id, w.balance_cents);
    wallet_table_sum_cents += w.balance_cents;
  }

  // 3. Resolve seller counterparties (id → user_id) for the per-seller diff.
  // Only counterparties that touch 5351 in the GL OR have a wallet row matter.
  const counterpartyIds = Array.from(glPerCounterparty.keys());
  const cpUserIdById = new Map<string, string | null>();
  if (counterpartyIds.length > 0) {
    const { data: cpRows, error: cpError } = await supabase
      .from('counterparties')
      .select('id, user_id')
      .in('id', counterpartyIds);

    throwIfError(cpError, 'getWalletIntegrity: counterparties SELECT failed');

    for (const cp of (cpRows ?? []) as Array<{ id: string; user_id: string | null }>) {
      cpUserIdById.set(cp.id, cp.user_id);
    }
  }

  // Walk the GL counterparties and resolve to user_ids. Counterparties
  // missing from cpUserIdById (deleted row) or whose user_id is null
  // (system counterparty like VID / STG_INTERNAL) cannot be attributed to
  // a seller — their balance flows into unattributed_gl_cents so the
  // global delta_cents stays explainable.
  const gl_by_user = new Map<string, number>();
  for (const [cpId, balance] of glPerCounterparty) {
    const userId = cpUserIdById.get(cpId);
    if (!userId) {
      unattributed_gl_cents += balance;
      continue;
    }
    gl_by_user.set(userId, (gl_by_user.get(userId) ?? 0) + balance);
  }

  const allUserIds = new Set<string>([...gl_by_user.keys(), ...walletByUserId.keys()]);
  const userIdsWithDelta: string[] = [];
  const perSellerNoHandle: Array<{
    seller_user_id: string;
    gl_balance_cents: number;
    wallet_balance_cents: number;
    delta_cents: number;
  }> = [];

  for (const userId of allUserIds) {
    const glBalance = gl_by_user.get(userId) ?? 0;
    const walletBalance = walletByUserId.get(userId) ?? 0;
    const delta = glBalance - walletBalance;
    if (delta !== 0) {
      userIdsWithDelta.push(userId);
      perSellerNoHandle.push({
        seller_user_id: userId,
        gl_balance_cents: glBalance,
        wallet_balance_cents: walletBalance,
        delta_cents: delta
      });
    }
  }

  // Resolve seller handles via public_profiles (full_name is the closest
  // thing we have to a user-facing handle; null-tolerant).
  const handlesByUserId = new Map<string, string | null>();
  if (userIdsWithDelta.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('public_profiles')
      .select('id, full_name')
      .in('id', userIdsWithDelta);

    throwIfError(profileError, 'getWalletIntegrity: public_profiles SELECT failed');

    for (const p of (profileRows ?? []) as Array<{ id: string; full_name: string | null }>) {
      handlesByUserId.set(p.id, p.full_name);
    }
  }

  const per_seller_deltas = perSellerNoHandle
    .map((row) => ({
      ...row,
      seller_handle: handlesByUserId.get(row.seller_user_id) ?? null
    }))
    .sort((a, b) => Math.abs(b.delta_cents) - Math.abs(a.delta_cents));

  const delta_cents = gl_5351_sum_cents - wallet_table_sum_cents;

  return {
    as_of,
    gl_5351_sum_cents,
    wallet_table_sum_cents,
    delta_cents,
    is_reconciled: delta_cents === 0,
    unattributed_gl_cents,
    per_seller_deltas
  };
}

// =============================================================================
// getWalletIntegrityAsOf
// =============================================================================

/**
 * Period-scoped variant of getWalletIntegrity — answers "as of date X, was the
 * GL 5351 liability in balance with seller wallet state at that time?" Used by
 * the period-close checklist (item 3) to gate soft-lock on period-scoped
 * reconciliation, not global present-tense reconciliation.
 *
 * Trust level: balance_after_cents is a denormalized snapshot maintained by the
 * wallet RPCs at write time (same denormalization pattern as wallets.balance_cents
 * in getWalletIntegrity). Both functions trust the denormalization; if we ever
 * distrust either, they migrate together to compute from raw
 * wallet_transactions.amount_cents + type. Don't change just one side.
 *
 * Phase 0 case (no live wallet_transactions ≤ 2026-03-31): both sums are 0,
 * delta is 0, per_seller_deltas is empty.
 */
export async function getWalletIntegrityAsOf(
  supabase: SupabaseClient,
  asOf: string
): Promise<WalletIntegrityCheck> {
  // 1. GL side: every line on account 5351 with posting_date <= asOf, with
  // counterparty for per-seller. The `journal_entries!inner(posting_date)`
  // join + .lte('journal_entries.posting_date', asOf) mirrors getTrialBalance
  // and getAccountLedger.
  const { data: glLineRows, error: glError } = await supabase
    .from('journal_lines')
    .select('debit_cents, credit_cents, counterparty_id, journal_entries!inner(posting_date)')
    .eq('account_code', '5351')
    .lte('journal_entries.posting_date', asOf);

  throwIfError(glError, 'getWalletIntegrityAsOf: journal_lines 5351 SELECT failed');

  const glRows = (glLineRows ?? []) as Array<{
    debit_cents: number;
    credit_cents: number;
    counterparty_id: string | null;
  }>;

  let gl_5351_sum_cents = 0;
  // GL balance per counterparty_id (signed credit-normal: credit - debit).
  const glPerCounterparty = new Map<string, number>();
  // GL balance for lines with no counterparty_id at all — accumulated
  // separately so we don't silently drop them during the per-seller
  // resolution pass below. Lines with a counterparty_id whose row is
  // missing or whose user_id is null also flow into unattributed_gl_cents
  // (handled in the resolution loop further down).
  let unattributed_gl_cents = 0;
  for (const row of glRows) {
    const signed = row.credit_cents - row.debit_cents;
    gl_5351_sum_cents += signed;
    if (row.counterparty_id) {
      glPerCounterparty.set(
        row.counterparty_id,
        (glPerCounterparty.get(row.counterparty_id) ?? 0) + signed
      );
    } else {
      unattributed_gl_cents += signed;
    }
  }

  // 2. Wallet table side: per-user balance_after_cents AS OF asOf. Read every
  // wallet_transactions row with created_at <= asOf, ordered DESC, then take
  // the FIRST (most recent) balance_after_cents per user_id. Users with no
  // rows ≤ asOf have wallet balance = 0 (lazily-created wallet pattern from
  // migration 018).
  //
  // balance_after_cents is a denormalized snapshot maintained by the wallet
  // RPCs (migrations 070/071) — same trust level as wallets.balance_cents in
  // getWalletIntegrity. See JSDoc above for the joint-migration discipline.
  const { data: walletTxRows, error: walletError } = await supabase
    .from('wallet_transactions')
    .select('user_id, balance_after_cents, created_at')
    .lte('created_at', asOf)
    .order('created_at', { ascending: false });

  throwIfError(walletError, 'getWalletIntegrityAsOf: wallet_transactions SELECT failed');

  const walletTxs = (walletTxRows ?? []) as Array<{
    user_id: string;
    balance_after_cents: number;
    created_at: string;
  }>;
  const walletByUserId = new Map<string, number>();
  let wallet_table_sum_cents = 0;
  // Rows are DESC by created_at — first row per user_id is the most recent
  // ≤ asOf, which is the canonical "balance as of asOf" for that user.
  for (const tx of walletTxs) {
    if (walletByUserId.has(tx.user_id)) continue;
    walletByUserId.set(tx.user_id, tx.balance_after_cents);
    wallet_table_sum_cents += tx.balance_after_cents;
  }

  // 3. Resolve seller counterparties (id → user_id) for the per-seller diff.
  // Identical to getWalletIntegrity from this point on.
  const counterpartyIds = Array.from(glPerCounterparty.keys());
  const cpUserIdById = new Map<string, string | null>();
  if (counterpartyIds.length > 0) {
    const { data: cpRows, error: cpError } = await supabase
      .from('counterparties')
      .select('id, user_id')
      .in('id', counterpartyIds);

    throwIfError(cpError, 'getWalletIntegrityAsOf: counterparties SELECT failed');

    for (const cp of (cpRows ?? []) as Array<{ id: string; user_id: string | null }>) {
      cpUserIdById.set(cp.id, cp.user_id);
    }
  }

  // Walk the GL counterparties and resolve to user_ids. Counterparties
  // missing from cpUserIdById (deleted row) or whose user_id is null
  // (system counterparty like VID / STG_INTERNAL) cannot be attributed to
  // a seller — their balance flows into unattributed_gl_cents so the
  // global delta_cents stays explainable.
  const gl_by_user = new Map<string, number>();
  for (const [cpId, balance] of glPerCounterparty) {
    const userId = cpUserIdById.get(cpId);
    if (!userId) {
      unattributed_gl_cents += balance;
      continue;
    }
    gl_by_user.set(userId, (gl_by_user.get(userId) ?? 0) + balance);
  }

  const allUserIds = new Set<string>([...gl_by_user.keys(), ...walletByUserId.keys()]);
  const userIdsWithDelta: string[] = [];
  const perSellerNoHandle: Array<{
    seller_user_id: string;
    gl_balance_cents: number;
    wallet_balance_cents: number;
    delta_cents: number;
  }> = [];

  for (const userId of allUserIds) {
    const glBalance = gl_by_user.get(userId) ?? 0;
    const walletBalance = walletByUserId.get(userId) ?? 0;
    const delta = glBalance - walletBalance;
    if (delta !== 0) {
      userIdsWithDelta.push(userId);
      perSellerNoHandle.push({
        seller_user_id: userId,
        gl_balance_cents: glBalance,
        wallet_balance_cents: walletBalance,
        delta_cents: delta
      });
    }
  }

  // Resolve seller handles via public_profiles (full_name is the closest
  // thing we have to a user-facing handle; null-tolerant).
  const handlesByUserId = new Map<string, string | null>();
  if (userIdsWithDelta.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('public_profiles')
      .select('id, full_name')
      .in('id', userIdsWithDelta);

    throwIfError(profileError, 'getWalletIntegrityAsOf: public_profiles SELECT failed');

    for (const p of (profileRows ?? []) as Array<{ id: string; full_name: string | null }>) {
      handlesByUserId.set(p.id, p.full_name);
    }
  }

  const per_seller_deltas = perSellerNoHandle
    .map((row) => ({
      ...row,
      seller_handle: handlesByUserId.get(row.seller_user_id) ?? null
    }))
    .sort((a, b) => Math.abs(b.delta_cents) - Math.abs(a.delta_cents));

  const delta_cents = gl_5351_sum_cents - wallet_table_sum_cents;

  return {
    as_of: asOf,
    gl_5351_sum_cents,
    wallet_table_sum_cents,
    delta_cents,
    is_reconciled: delta_cents === 0,
    unattributed_gl_cents,
    per_seller_deltas
  };
}

// =============================================================================
// getPeriodRow
// =============================================================================

export async function getPeriodRow(
  supabase: SupabaseClient,
  periodKey: string,
  periodType: PeriodType
): Promise<PeriodRow | null> {
  const { data, error } = await supabase
    .from('periods')
    .select('*')
    .eq('period_key', periodKey)
    .eq('period_type', periodType)
    .maybeSingle();

  throwIfError(error, 'getPeriodRow: periods SELECT failed');
  return (data as PeriodRow | null) ?? null;
}

// =============================================================================
// getEntriesPostedSince
// =============================================================================

/**
 * Used by the period-close checklist: when staff is about to hard-lock a
 * soft-locked period, this confirms whether any entries were posted between
 * soft-lock and now. created_at (not posting_date) — we're asking "what
 * entries appeared after the lock", not "what financial events happened".
 */
export async function getEntriesPostedSince(
  supabase: SupabaseClient,
  periodKey: string,
  since: string
): Promise<JournalEntryRow[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('accounting_period', periodKey)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  throwIfError(error, 'getEntriesPostedSince: journal_entries SELECT failed');
  return (data ?? []) as JournalEntryRow[];
}

// =============================================================================
// getRecentJournalEntries
// =============================================================================

/**
 * Returns the most recent N journal entries by created_at DESC. Used by the
 * /staff/accounting dashboard's recent activity tile. Sorted by created_at
 * (when posted) rather than posting_date (financial event date) so backfill
 * batches show as a clustered block — that's the truthful presentation.
 *
 * excludeTestArtifacts defaults to true so the dashboard's recent-activity
 * tile doesn't pollute with test_artifact entries from integration tests.
 * Filter is applied in-memory (the table column is jsonb, and PostgREST
 * filtering on jsonb keys would complicate the select for negligible gain at
 * this scale). To compensate for filtered rows, we fetch a buffered window
 * (limit * 2 + 10) and then trim to the requested limit after filtering.
 */
export async function getRecentJournalEntries(
  supabase: SupabaseClient,
  limit: number,
  options: { excludeTestArtifacts?: boolean } = {}
): Promise<JournalEntryRow[]> {
  const excludeTestArtifacts = options.excludeTestArtifacts ?? true;

  // Buffer the SELECT to absorb a small number of filtered test_artifact
  // rows without a second roundtrip. In healthy production state this overrun
  // is wasted bytes but the dataset is tiny; in test-heavy environments it
  // keeps the dashboard correct without paginating.
  const fetchLimit = excludeTestArtifacts ? limit * 2 + 10 : limit;

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  throwIfError(error, 'getRecentJournalEntries: journal_entries SELECT failed');

  const rows = (data ?? []) as JournalEntryRow[];
  if (!excludeTestArtifacts) return rows.slice(0, limit);

  // JournalEntryRow.posting_context is the same shape EmbeddedEntryFields
  // uses for the field; pass the row directly through the helper.
  const filtered = rows.filter((row) => !isTestArtifactEntry(row));
  return filtered.slice(0, limit);
}

// =============================================================================
// getInFlightCartReceiptsTotal — PR D (period-close checklist item 4 gate)
// =============================================================================

/**
 * Sum of expected 5590 suspense balance contributed by in-flight cart receipts
 * as of `asOf`. Used by `buildItem4` in checklist.ts to reconcile the actual
 * GL 5590 closing balance against marketplace state, replacing the legacy
 * "5590 closing = 0" gate (which fails for every cart that spans a month
 * boundary post-PR-C-cutover).
 *
 * Algorithm:
 *   1. Find cart_group_ids with a C.1 or C.2 entry posted on or before asOf
 *      (the GL antecedent that credited 5590 at cart fulfillment).
 *   2. Load candidate orders pointing at those cart groups.
 *   3. For each candidate, look up any release entries in journal_entries:
 *        - O.1–O.5 / O.7 / O.8 → full release; contribute 0
 *        - O.9 → partial release; subtract `posting_context.refund_cents`
 *          (the canonical per-entry total — mapping.ts derives this from
 *          refund_item_cents + refund_shipping_cents) summed across all O.9
 *          entries for the order
 *   4. Sum (gross_cart − partial_refunds) across not-fully-released candidates.
 *
 * **Type-catalog coupling assumptions (named here so future PRs touching the
 * type catalog know to look at this query):**
 *
 *   (A) **Cart-receipt assumption.** This query assumes cart receipts come
 *       from C.1 (card) or C.2 (bank_link). If a future payment method
 *       introduces a new cart-receipt type ID (e.g., a stablecoin rail or a
 *       wallet-only-cart receipt entry), update this query and the in-flight
 *       predicate to include that type id under the C.1/C.2 sentinel filter.
 *
 *   (B) **Release-type assumption.** This query assumes O.1–O.5, O.7, O.8,
 *       O.9 are the only journal-entry types that release 5590 suspense for
 *       an order. If a future type does so (e.g., O.10 account-closure
 *       releases unclaimed suspense as STG revenue), add it to the appropriate
 *       release-type list below. The "fully released" branch covers types
 *       that drain the full gross_cart; the "partial refund" branch covers
 *       types that drain a payload-specified amount.
 *
 * Returns integer cents; always >= 0. Wallet-only carts (cart-wallet-pay
 * route, no C.1/C.2 antecedent) are excluded naturally by step 1.
 */
export async function getInFlightCartReceiptsTotal(
  supabase: SupabaseClient,
  asOf: string
): Promise<number> {
  // Assumption (A) — cart receipts come from C.1 (card) or C.2 (bank_link).
  // See JSDoc above. Add new cart-receipt type IDs here when introduced.
  const CART_RECEIPT_TYPE_IDS = ['C.1', 'C.2'] as const;
  // Assumption (B) — release types that drain 5590 for an order. See JSDoc.
  const FULL_RELEASE_TYPE_IDS = ['O.1', 'O.2', 'O.3', 'O.4', 'O.5', 'O.7', 'O.8'] as const;
  const PARTIAL_RELEASE_TYPE_ID = 'O.9' as const;
  const ALL_RELEASE_TYPE_IDS = [...FULL_RELEASE_TYPE_IDS, PARTIAL_RELEASE_TYPE_ID] as const;

  // Step 1 — cart-receipt antecedents posted by asOf.
  const { data: cartReceipts, error: receiptsError } = await supabase
    .from('journal_entries')
    .select('source_doc_id')
    .eq('source_doc_type', 'cart_payment')
    .in('type_id', CART_RECEIPT_TYPE_IDS)
    .lte('posting_date', asOf);
  throwIfError(receiptsError, 'getInFlightCartReceiptsTotal: cart_receipts SELECT failed');
  if (!cartReceipts || cartReceipts.length === 0) return 0;

  // De-duplicate cart_group_ids (a single cart could have multiple C.x rows
  // if a future flow ever splits them; defensive). source_doc_id is text.
  const cartGroupIds = Array.from(
    new Set(cartReceipts.map((r) => (r as { source_doc_id: string }).source_doc_id))
  );

  // Step 2 — candidate orders pointing at those cart groups.
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, items_total_cents, shipping_cost_cents, cart_group_id')
    .in('cart_group_id', cartGroupIds);
  throwIfError(ordersError, 'getInFlightCartReceiptsTotal: orders SELECT failed');
  if (!orders || orders.length === 0) return 0;

  const orderIds = orders.map((o) => (o as { id: string }).id);

  // Step 3 — release entries for those orders.
  const { data: releases, error: releasesError } = await supabase
    .from('journal_entries')
    .select('source_doc_id, type_id, posting_context')
    .eq('source_doc_type', 'order')
    .in('source_doc_id', orderIds)
    .in('type_id', ALL_RELEASE_TYPE_IDS)
    .lte('posting_date', asOf);
  throwIfError(releasesError, 'getInFlightCartReceiptsTotal: releases SELECT failed');

  // Bucket releases by source_doc_id (order id, stored as text on the journal
  // entry) for O(1) per-order lookup during aggregation.
  type ReleaseRow = {
    source_doc_id: string;
    type_id: string;
    posting_context: Record<string, unknown> | null;
  };
  const releasesByOrder = new Map<string, ReleaseRow[]>();
  for (const r of (releases ?? []) as ReleaseRow[]) {
    const arr = releasesByOrder.get(r.source_doc_id) ?? [];
    arr.push(r);
    releasesByOrder.set(r.source_doc_id, arr);
  }

  // Step 4 — per-order aggregation.
  let total = 0;
  for (const orderRaw of orders) {
    const order = orderRaw as {
      id: string;
      items_total_cents: number;
      shipping_cost_cents: number;
    };
    const grossCart = order.items_total_cents + order.shipping_cost_cents;
    const releases = releasesByOrder.get(order.id) ?? [];
    const fullyReleased = releases.some((r) =>
      (FULL_RELEASE_TYPE_IDS as readonly string[]).includes(r.type_id)
    );
    if (fullyReleased) continue;

    // Partial refunds (O.9) — sum `posting_context.refund_cents` across all
    // O.9 entries for this order. mapping.ts derives this field as
    // refund_item_cents + refund_shipping_cents at compute time.
    const partialRefundCents = releases
      .filter((r) => r.type_id === PARTIAL_RELEASE_TYPE_ID)
      .reduce((sum, r) => {
        const ctx = r.posting_context ?? {};
        const v = Number(ctx.refund_cents ?? 0);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0);

    total += Math.max(0, grossCart - partialRefundCents);
  }
  return total;
}
