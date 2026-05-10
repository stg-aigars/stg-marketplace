/**
 * Period-close checklist composition (PR #4, Task 5).
 *
 * Composes 9 read-side gates over the queries module + Phase 0 fixture into
 * a single PeriodCloseChecklist consumed by the period-close UI (Task 11)
 * and the soft/hard-lock server actions (Task 6). The can_* flags encoded
 * here are the safety invariants for state mutations on the periods table.
 *
 * Item 10 (Phase 0 reconciliation tie-out) is deferred to PR #4b alongside
 * bank-statement ingestion.
 *
 * Conventions:
 *   - All monetary values are integer cents.
 *   - Status taxonomy: 'pass' (gate satisfied) | 'fail' (gate violated) |
 *     'manual_pending' (data not yet ingested — bank statement gap) |
 *     'not_applicable' (gate doesn't apply this period — e.g. no VAT
 *     activity).
 *   - Items 4-7 (account closing = 0) never return 'not_applicable' — the
 *     account always has a closing balance, even if zero. Pass iff zero.
 *   - English-only detail strings (Decision #10: staff UI is English-only).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { getPhase0BankCloseForPeriod } from './phase0-reconciliation-constants';
import {
  getAccountLedger,
  getEntriesPostedSince,
  getPeriodRow,
  getTrialBalance,
  getWalletIntegrityAsOf
} from './queries';
import type { PeriodStatus, PeriodType } from './types';

// =============================================================================
// Types
// =============================================================================

export type ChecklistStatus = 'pass' | 'fail' | 'manual_pending' | 'not_applicable';

export interface ChecklistItem {
  id: number;
  label: string;
  status: ChecklistStatus;
  detail: string;
  drillDownHref?: string;
}

export interface PeriodCloseChecklist {
  period_key: string;
  period_type: PeriodType;
  period_status: PeriodStatus;
  items: ChecklistItem[];
  /** True when items 1-9 are all 'pass' or 'not_applicable' (no fail/manual_pending). */
  all_pass: boolean;
  /** open AND all_pass. */
  can_soft_lock: boolean;
  /** soft_locked AND no entries posted since locked_at. */
  can_hard_lock: boolean;
  /** soft_locked. */
  can_unsoft_lock: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Return the last calendar day of a `YYYY-MM` period as `YYYY-MM-DD`.
 * Same idiom as getPhase0BankCloseForPeriod — `new Date(year, month, 0)`
 * rolls back to the last day of the previous month, which is the last day
 * of the requested month when `month` is passed as the 1-indexed value.
 */
function lastDayOfMonthlyPeriod(periodKey: string): string {
  const [yearStr, monthStr] = periodKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
}

function isMonthlyPeriodKey(periodKey: string): boolean {
  return /^\d{4}-\d{2}$/.test(periodKey);
}

/**
 * Closing balance of a single account as of `asOf`, in net-debit-cents
 * convention (positive = debit). Phase 0 + early-production volumes are low
 * enough to walk the full ledger; Task 3's TODO covers paginating once any
 * single account exceeds ~10k lines.
 */
async function getAccountClosingBalance(
  supabase: SupabaseClient,
  accountCode: string,
  asOf: string
): Promise<number> {
  const ledger = await getAccountLedger(
    supabase,
    accountCode,
    { from: '1900-01-01', to: asOf },
    { includeBackfill: true }
  );
  return ledger.closing_balance_cents;
}

/**
 * Sum of closing balances across `5410-*` sub-accounts (5410-UN, 5410-EP).
 * Hardcoded set per migration 096 seeds — if a new accrual sub-account is
 * added, extend this list. Matches the canonical chart of accounts; querying
 * `accounts WHERE code LIKE '5410-%'` would also work but is overkill for
 * a list this stable.
 */
const ACCRUAL_SUB_ACCOUNTS: readonly string[] = ['5410-UN', '5410-EP'];

async function sumAccrualClosingBalances(
  supabase: SupabaseClient,
  asOf: string
): Promise<number> {
  let total = 0;
  for (const code of ACCRUAL_SUB_ACCOUNTS) {
    total += await getAccountClosingBalance(supabase, code, asOf);
  }
  return total;
}

/**
 * Format an integer-cents value as a euro string for detail messages. Cents
 * stay integer in storage and arithmetic; this only formats for display.
 */
function formatEur(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}€${euros}.${String(remainder).padStart(2, '0')}`;
}

// =============================================================================
// Item builders
// =============================================================================

/** Item 1 — Σ debits = Σ credits across the period. */
async function buildItem1(
  supabase: SupabaseClient,
  asOf: string
): Promise<ChecklistItem> {
  const tb = await getTrialBalance(supabase, asOf, { includeBackfill: true });
  if (tb.is_balanced) {
    return {
      id: 1,
      label: 'Σ debits = Σ credits',
      status: 'pass',
      detail: `Total debits ${formatEur(tb.total_debit_cents)} = total credits ${formatEur(tb.total_credit_cents)}.`
    };
  }
  return {
    id: 1,
    label: 'Σ debits = Σ credits',
    status: 'fail',
    detail: `Imbalance: debits ${formatEur(tb.total_debit_cents)} vs credits ${formatEur(tb.total_credit_cents)} (delta ${formatEur(tb.total_debit_cents - tb.total_credit_cents)}).`,
    drillDownHref: '/staff/accounting/trial-balance'
  };
}

/** Item 2 — Bank reconciliation: GL 2610 close matches Phase 0 fixture. */
async function buildItem2(
  supabase: SupabaseClient,
  periodKey: string,
  asOf: string
): Promise<ChecklistItem> {
  const expected = getPhase0BankCloseForPeriod(periodKey);
  if (expected === null) {
    return {
      id: 2,
      label: 'Bank reconciliation (GL 2610 vs Swedbank statement)',
      status: 'manual_pending',
      detail: `Bank statement not yet ingested for ${periodKey}; PR #4b ships ingestion.`,
      drillDownHref: '/staff/accounting/account-ledger/2610'
    };
  }
  const actual = await getAccountClosingBalance(supabase, '2610', asOf);
  if (actual === expected) {
    return {
      id: 2,
      label: 'Bank reconciliation (GL 2610 vs Swedbank statement)',
      status: 'pass',
      detail: `GL 2610 closing ${formatEur(actual)} matches Swedbank statement.`,
      drillDownHref: '/staff/accounting/account-ledger/2610'
    };
  }
  return {
    id: 2,
    label: 'Bank reconciliation (GL 2610 vs Swedbank statement)',
    status: 'fail',
    detail: `GL 2610 closing ${formatEur(actual)} vs Swedbank ${formatEur(expected)} (delta ${formatEur(actual - expected)}).`,
    drillDownHref: '/staff/accounting/account-ledger/2610'
  };
}

/** Item 3 — Wallet integrity: GL 5351 vs wallet table, period-scoped to asOf. */
async function buildItem3(
  supabase: SupabaseClient,
  asOf: string
): Promise<ChecklistItem> {
  const integrity = await getWalletIntegrityAsOf(supabase, asOf);
  const reconciled =
    integrity.delta_cents === 0 && integrity.unattributed_gl_cents === 0;
  if (reconciled) {
    return {
      id: 3,
      label: 'Wallet integrity (GL 5351 vs wallets table)',
      status: 'pass',
      detail: `As of ${asOf}: GL 5351 ${formatEur(integrity.gl_5351_sum_cents)} = wallet table ${formatEur(integrity.wallet_table_sum_cents)}; no unattributed lines.`,
      drillDownHref: '/staff/accounting/wallet-integrity'
    };
  }
  return {
    id: 3,
    label: 'Wallet integrity (GL 5351 vs wallets table)',
    status: 'fail',
    detail: `As of ${asOf}: delta ${formatEur(integrity.delta_cents)}; unattributed ${formatEur(integrity.unattributed_gl_cents)}; ${integrity.per_seller_deltas.length} seller(s) mismatched.`,
    drillDownHref: '/staff/accounting/wallet-integrity'
  };
}

/** Item 4 — Suspense cleared: 5590 closing = 0. */
async function buildItem4(
  supabase: SupabaseClient,
  asOf: string
): Promise<ChecklistItem> {
  const balance = await getAccountClosingBalance(supabase, '5590', asOf);
  if (balance === 0) {
    return {
      id: 4,
      label: 'Suspense cleared (5590)',
      status: 'pass',
      detail: '5590 closing balance is zero.'
    };
  }
  return {
    id: 4,
    label: 'Suspense cleared (5590)',
    status: 'fail',
    detail: `5590 closing balance ${formatEur(balance)}; clear before close.`,
    drillDownHref: '/staff/accounting/account-ledger/5590'
  };
}

/** Item 5 — Refund clearing cleared: 2351 closing = 0. */
async function buildItem5(
  supabase: SupabaseClient,
  asOf: string
): Promise<ChecklistItem> {
  const balance = await getAccountClosingBalance(supabase, '2351', asOf);
  if (balance === 0) {
    return {
      id: 5,
      label: 'Refund clearing cleared (2351)',
      status: 'pass',
      detail: '2351 closing balance is zero.'
    };
  }
  return {
    id: 5,
    label: 'Refund clearing cleared (2351)',
    status: 'fail',
    detail: `2351 closing balance ${formatEur(balance)}; clear before close.`,
    drillDownHref: '/staff/accounting/account-ledger/2351'
  };
}

/** Item 6 — Accruals cleared: sum of 5410-* closing = 0. */
async function buildItem6(
  supabase: SupabaseClient,
  asOf: string
): Promise<ChecklistItem> {
  const balance = await sumAccrualClosingBalances(supabase, asOf);
  if (balance === 0) {
    return {
      id: 6,
      label: 'Accruals cleared (5410-*)',
      status: 'pass',
      detail: 'All 5410-* sub-accounts closing balance sum to zero.'
    };
  }
  return {
    id: 6,
    label: 'Accruals cleared (5410-*)',
    status: 'fail',
    detail: `5410-* sub-account closing balance sum ${formatEur(balance)}; reverse pending accruals before close.`
  };
}

/** Item 7 — EveryPay clearing reconciled: 2630 closing = 0 for Phase 0. */
async function buildItem7(
  supabase: SupabaseClient,
  asOf: string
): Promise<ChecklistItem> {
  const balance = await getAccountClosingBalance(supabase, '2630', asOf);
  if (balance === 0) {
    return {
      id: 7,
      label: 'EveryPay clearing reconciled (2630)',
      status: 'pass',
      detail: '2630 closing balance is zero (no PIS activity yet in Phase 0).'
    };
  }
  return {
    id: 7,
    label: 'EveryPay clearing reconciled (2630)',
    status: 'fail',
    detail: `2630 closing balance ${formatEur(balance)}; reconcile before close.`,
    drillDownHref: '/staff/accounting/account-ledger/2630'
  };
}

/**
 * Item 8 — VAT consolidation posted: a P.1 or P.3 entry exists with
 * accounting_period = periodKey. `not_applicable` if the period has no
 * 5710-* movement at all (no VAT activity to consolidate).
 */
async function buildItem8(
  supabase: SupabaseClient,
  periodKey: string
): Promise<ChecklistItem> {
  // Check for an existing P.1 or P.3 consolidation entry for this period.
  const { data: closeEntries, error: closeError } = await supabase
    .from('journal_entries')
    .select('id, type_id')
    .eq('accounting_period', periodKey)
    .in('type_id', ['P.1', 'P.3']);

  if (closeError) {
    throw new Error(`buildItem8: journal_entries P.1/P.3 SELECT failed: ${(closeError as { message: string }).message}`);
  }

  const consolidations = (closeEntries ?? []) as Array<{ id: string; type_id: string }>;
  if (consolidations.length > 0) {
    return {
      id: 8,
      label: 'VAT consolidation posted (P.1 / P.3)',
      status: 'pass',
      detail: `${consolidations.length} consolidation entr${consolidations.length === 1 ? 'y' : 'ies'} found for ${periodKey}.`
    };
  }

  // No consolidation entry. Check whether any 5710-* movement happened in
  // the period at all — if not, the gate is not applicable. We look for
  // any journal_lines on a 5710-* account whose entry's accounting_period
  // matches; PostgREST `like` filter on the embedded column does the prefix
  // match.
  const { data: vatLines, error: vatError } = await supabase
    .from('journal_lines')
    .select('account_code, journal_entries!inner(accounting_period)')
    .like('account_code', '5710-%')
    .eq('journal_entries.accounting_period', periodKey)
    .limit(1);

  if (vatError) {
    throw new Error(`buildItem8: journal_lines 5710-* SELECT failed: ${(vatError as { message: string }).message}`);
  }

  const hasVatMovement = (vatLines ?? []).length > 0;
  if (!hasVatMovement) {
    return {
      id: 8,
      label: 'VAT consolidation posted (P.1 / P.3)',
      status: 'not_applicable',
      detail: `No 5710-* movement in ${periodKey}; nothing to consolidate.`
    };
  }

  return {
    id: 8,
    label: 'VAT consolidation posted (P.1 / P.3)',
    status: 'fail',
    detail: `5710-* movement exists in ${periodKey} but no P.1 or P.3 consolidation entry posted.`
  };
}

/**
 * Item 9 — All counterparty wallets non-negative. Phase 0 has no wallet
 * rows; this trivially passes (count = 0). Once seller wallets exist,
 * negative balances signal a refund-without-funds bug and must block close.
 */
async function buildItem9(supabase: SupabaseClient): Promise<ChecklistItem> {
  const { data: negativeRows, error: walletError } = await supabase
    .from('wallets')
    .select('user_id, balance_cents')
    .lt('balance_cents', 0);

  if (walletError) {
    throw new Error(`buildItem9: wallets SELECT failed: ${(walletError as { message: string }).message}`);
  }

  const negatives = (negativeRows ?? []) as Array<{ user_id: string; balance_cents: number }>;
  if (negatives.length === 0) {
    return {
      id: 9,
      label: 'All counterparty wallets non-negative',
      status: 'pass',
      detail: 'No wallet rows with balance_cents < 0.'
    };
  }
  return {
    id: 9,
    label: 'All counterparty wallets non-negative',
    status: 'fail',
    detail: `${negatives.length} wallet${negatives.length === 1 ? '' : 's'} with negative balance.`,
    drillDownHref: '/staff/accounting/wallet-integrity'
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Compose the 9-item period-close checklist for a monthly period. Currently
 * monthly-only per Decision #5 (quarterly UI deferred to PR #4b+).
 *
 * Throws if `periodKey` is not a `YYYY-MM` string. Throws if the period row
 * doesn't exist (caller passes a key outside the seeded 2025-05 → 2030-12
 * window or uses the wrong period_type).
 */
export async function getPeriodCloseChecklist(
  supabase: SupabaseClient,
  periodKey: string
): Promise<PeriodCloseChecklist> {
  if (!isMonthlyPeriodKey(periodKey)) {
    throw new Error(
      `Period ${periodKey} is not a monthly period; quarterly checklist UI is deferred to PR #4b+`
    );
  }

  const period = await getPeriodRow(supabase, periodKey, 'month');
  if (!period) {
    throw new Error(
      `getPeriodCloseChecklist: period ${periodKey} not found in periods table (period_type=month)`
    );
  }

  const asOf = lastDayOfMonthlyPeriod(periodKey);

  // Items 1-9 — independent reads, but kept sequential for predictable test
  // ordering and clear failure-source attribution. Volumes are tiny.
  const item1 = await buildItem1(supabase, asOf);
  const item2 = await buildItem2(supabase, periodKey, asOf);
  const item3 = await buildItem3(supabase, asOf);
  // TODO(post-launch): items 4-7 could derive closing balances from item 1's
  // trial balance (tb.rows) instead of issuing per-account getAccountLedger calls.
  // Each item currently triggers a full-history fetch + accounts-table roundtrip.
  // Acceptable for Phase 0 volumes; revisit when any single account's history
  // exceeds the natural in-memory partition threshold (~10k lines).
  const item4 = await buildItem4(supabase, asOf);
  const item5 = await buildItem5(supabase, asOf);
  const item6 = await buildItem6(supabase, asOf);
  const item7 = await buildItem7(supabase, asOf);
  const item8 = await buildItem8(supabase, periodKey);
  const item9 = await buildItem9(supabase);

  const items: ChecklistItem[] = [item1, item2, item3, item4, item5, item6, item7, item8, item9];

  const all_pass = items.every(
    (item) => item.status === 'pass' || item.status === 'not_applicable'
  );

  // Gating for the three transitions on the periods state machine.
  const can_soft_lock = period.status === 'open' && all_pass;
  const can_unsoft_lock = period.status === 'soft_locked';

  let can_hard_lock = false;
  if (period.status === 'soft_locked' && period.locked_at) {
    // gte (inclusive) is intentional: an entry created at exactly locked_at is
    // treated as "posted since soft-lock," which is the false-conservative choice.
    const since = await getEntriesPostedSince(supabase, periodKey, period.locked_at);
    can_hard_lock = since.length === 0;
  }

  return {
    period_key: periodKey,
    period_type: 'month',
    period_status: period.status,
    items,
    all_pass,
    can_soft_lock,
    can_hard_lock,
    can_unsoft_lock
  };
}
