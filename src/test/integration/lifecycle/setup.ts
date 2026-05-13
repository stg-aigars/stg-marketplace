/**
 * Shared scaffolding for PR C commit 13 lifecycle integration tests.
 *
 * Reuses canonical factories from `src/test/helpers/factories.ts`
 * (createTestUser / createTestListing / createTestOrder / createTestWallet /
 * cleanupTestData) where possible. Adds lifecycle-specific helpers:
 *
 *   - `ensureTestPeriod` — ensures synthetic test period exists as 'open'
 *   - `resetPeriodStatus` — operator-style bypass for test-only un-lock
 *   - `setBuyerWalletBalance` — direct UPSERT for wallet balance scaffolding
 *   - `createSyntheticCart` — minimal cart_checkout_groups + orders fixture
 *   - `ensureTestCounterparty` — UPSERT a counterparty row directly (bypasses
 *     the lifecycle wraps' lazy-init path; useful when tests need a known-shape
 *     counterparty before exercising the wrap)
 *   - `assertJournalEntry` / `assertNoJournalEntry` / `assertJournalLines`
 *     — query + shape assertions
 *
 * **Test artifact convention** (matches existing project pattern): all
 * lifecycle tests post entries to synthetic period 2027-01 with
 * `posting_context.test_artifact=true`. Entries persist (immutability
 * trigger blocks DELETE); production views filter via `isTestArtifactEntry`
 * in queries.ts. Mutable test fixtures (cart_checkout_groups, orders,
 * wallet_transactions) are cleaned via `cleanupTestData` afterAll.
 */

import { expect } from 'vitest';

import { createTestServiceClient } from '../../helpers/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabase = createTestServiceClient();

// ===========================================================================
// Synthetic test period constants
// ===========================================================================

/**
 * Canonical test period — 2027-01. Well outside Phase 0 (2025-05 → 2026-03)
 * and current production reporting periods. Already seeded as 'open' per
 * migration 096 period seed window (2025-05 → 2030-12). Tests should NEVER
 * leave it in a non-'open' state at suite end.
 */
export const TEST_PERIOD = '2027-01';

/**
 * Secondary test period for cross-period scenarios (e.g., O.8 cross-period
 * refund where the original entry lives in TEST_PERIOD and the refund posts
 * to TEST_PERIOD_NEXT).
 */
export const TEST_PERIOD_NEXT = '2027-02';

/**
 * Last day of TEST_PERIOD — drives the posting_date for entries closing
 * out the synthetic period (P.1 close, etc.).
 */
export const TEST_PERIOD_LAST_DAY = '2027-01-31';
export const TEST_PERIOD_NEXT_LAST_DAY = '2027-02-28';

// ===========================================================================
// Period management
// ===========================================================================

/**
 * Ensure the synthetic test period exists and is 'open'. Idempotent — UPSERT
 * with status='open' so prior test runs that left the period soft/hard-locked
 * are reset. Service-role bypass; periods table is staff-write per RLS.
 *
 * Test-only operator bypass — this UPDATE would be forbidden via the
 * application-layer state machine (which doesn't allow un-hard-locking).
 * Mirrors the `period-close.test.ts` afterEach reset pattern.
 */
export async function ensureTestPeriod(
  client: SupabaseClient,
  periodKey: string = TEST_PERIOD
): Promise<void> {
  // Periods table is pre-seeded per migration 096 (2025-05 → 2030-12 monthly).
  // We never INSERT here; we only ensure status='open' for the test period.
  const { error } = await client
    .from('periods')
    .update({ status: 'open', locked_at: null, locked_by: null })
    .eq('period_key', periodKey)
    .eq('period_type', 'month');
  if (error) {
    throw new Error(`ensureTestPeriod(${periodKey}) failed: ${error.message}`);
  }
}

/**
 * Test-only period state reset. Forces status to a target value, bypassing
 * the application-layer state machine. Use in `afterEach` / `afterAll` to
 * clean up after tests that lock periods (period-lock.test.ts).
 */
export async function resetPeriodStatus(
  client: SupabaseClient,
  periodKey: string,
  targetStatus: 'open' | 'soft_locked' | 'hard_locked' = 'open'
): Promise<void> {
  // locked_by is left null even when locking — `periods.locked_by` has an FK
  // to auth.users and our synthetic test UUIDs aren't real auth.users rows.
  // The lock state itself is what tests verify; actor identity is unit-test
  // territory (period-actions.test.ts asserts the audit-event actor metadata).
  const update: Record<string, unknown> = {
    status: targetStatus,
    locked_at: targetStatus === 'open' ? null : new Date().toISOString(),
    locked_by: null,
  };
  const { error } = await client
    .from('periods')
    .update(update)
    .eq('period_key', periodKey)
    .eq('period_type', 'month');
  if (error) {
    throw new Error(`resetPeriodStatus(${periodKey}, ${targetStatus}) failed: ${error.message}`);
  }
}

// ===========================================================================
// Counterparty helpers
// ===========================================================================

export interface SyntheticCounterparty {
  id: string;
  type: 'seller' | 'vendor' | 'tax_authority' | 'internal';
  country?: 'LV' | 'LT' | 'EE';
  tax_status?: 'private' | 'sole_proprietor' | 'vat_registered';
  vat_number?: string;
  vies_verified_at?: string;
  vendor_code?: string;
  legal_compliance_status?:
    | 'ok'
    | 'pending_kyc'
    | 'dac7_blocked'
    | 'negative_wallet'
    | 'suspended'
    | 'dormant';
  user_id?: string | null;
  full_name?: string;
}

/**
 * UPSERT a counterparty row with a deterministic id. Bypasses the lifecycle
 * wraps' `resolveSellerCounterparty` lazy-init — useful when tests need to
 * preload a specific legal_compliance_status (`pending_kyc`, `dac7_blocked`)
 * to exercise the KYC gate branch.
 */
export async function ensureTestCounterparty(
  client: SupabaseClient,
  cp: SyntheticCounterparty
): Promise<void> {
  const { error } = await client.from('counterparties').upsert(
    {
      id: cp.id,
      type: cp.type,
      country: cp.country ?? null,
      tax_status: cp.tax_status ?? null,
      vat_number: cp.vat_number ?? null,
      vies_verified_at: cp.vies_verified_at ?? null,
      vendor_code: cp.vendor_code ?? null,
      legal_compliance_status: cp.legal_compliance_status ?? 'ok',
      kyc_status: 'not_required',
      user_id: cp.user_id ?? null,
      full_name: cp.full_name ?? `LIFECYCLE_TEST counterparty ${cp.id.slice(0, 8)}`,
    },
    { onConflict: 'id' }
  );
  if (error) {
    throw new Error(`ensureTestCounterparty(${cp.id}) failed: ${error.message}`);
  }
}

// ===========================================================================
// Wallet helpers
// ===========================================================================

/**
 * Direct UPSERT helper for test scaffolding. Sets `balance_cents` only; other
 * columns rely on table defaults. Update if the `wallets` schema adds
 * required NOT NULL columns without defaults (per Q13-5 sign-off).
 *
 * Bypasses `creditWallet` / `debitWallet` RPCs because this is test
 * scaffolding (setting initial state), not behavior under test. Tests that
 * verify wallet RPCs themselves use the canonical factory in
 * `src/test/helpers/factories.ts`.
 */
export async function setBuyerWalletBalance(
  client: SupabaseClient,
  userId: string,
  balanceCents: number
): Promise<void> {
  const { error } = await client
    .from('wallets')
    .upsert({ user_id: userId, balance_cents: balanceCents }, { onConflict: 'user_id' });
  if (error) {
    throw new Error(`setBuyerWalletBalance(${userId}, ${balanceCents}) failed: ${error.message}`);
  }
}

// ===========================================================================
// Cart fixture
// ===========================================================================

export interface SyntheticCartOptions {
  buyer_id: string;
  /** Deterministic cart_group_id for re-runnable tests. Optional — defaults to crypto.randomUUID(). */
  cart_group_id?: string;
  terminal_id?: string;
  terminal_name?: string;
  terminal_country?: 'LV' | 'LT' | 'EE';
  buyer_phone?: string;
  total_amount_cents: number;
  wallet_debit_cents?: number;
  /** Always assigned an everypay_payment_reference even for fully-wallet carts (for test consistency). */
  everypay_payment_reference?: string;
}

/**
 * Minimal cart_checkout_groups fixture for tests that exercise the
 * fulfillCartPayment wrap. NOT a full create-cart-flow simulation — just
 * the row shape the wrap reads. Returns the cart id + payment reference
 * so the test can pass them into the wrap call.
 */
export async function createSyntheticCart(
  client: SupabaseClient,
  opts: SyntheticCartOptions
): Promise<{ cart_group_id: string; everypay_payment_reference: string }> {
  const cartId = opts.cart_group_id ?? crypto.randomUUID();
  const epRef = opts.everypay_payment_reference ?? `ep-test-${cartId.slice(0, 8)}`;
  const orderNumber = `STG-TEST-${cartId.slice(0, 8)}`;

  const { error } = await client.from('cart_checkout_groups').upsert(
    {
      id: cartId,
      order_number: orderNumber,
      callback_token: `tok-test-${cartId.slice(0, 8)}`,
      buyer_id: opts.buyer_id,
      terminal_id: opts.terminal_id ?? 'lv-test-terminal-001',
      terminal_name: opts.terminal_name ?? 'Test Terminal',
      terminal_country: opts.terminal_country ?? 'LV',
      buyer_phone: opts.buyer_phone ?? '+37120000001',
      total_amount_cents: opts.total_amount_cents,
      wallet_debit_cents: opts.wallet_debit_cents ?? 0,
      wallet_allocation: {},
      listing_ids: [],
      status: 'pending',
      everypay_payment_reference: epRef,
    },
    { onConflict: 'id' }
  );
  if (error) {
    throw new Error(`createSyntheticCart failed: ${error.message}`);
  }
  return { cart_group_id: cartId, everypay_payment_reference: epRef };
}

// ===========================================================================
// Journal entry assertions
// ===========================================================================

export interface JournalEntryPredicate {
  source_doc_type: string;
  source_doc_id: string;
  type_id: string;
}

interface JournalEntryRow {
  id: string;
  source_doc_type: string;
  source_doc_id: string;
  type_id: string;
  posting_date: string;
  accounting_period: string;
  tax_period: string;
  narrative: string;
  posting_context: Record<string, unknown>;
  created_by: string;
}

/**
 * Assert exactly one journal_entries row matches the predicate; return it.
 * The triple (source_doc_type, source_doc_id, type_id) is the engine's
 * UNIQUE index, so at most one row can ever match a successful emit.
 */
export async function assertJournalEntry(
  client: SupabaseClient,
  predicate: JournalEntryPredicate
): Promise<JournalEntryRow> {
  const { data, error } = await client
    .from('journal_entries')
    .select('*')
    .eq('source_doc_type', predicate.source_doc_type)
    .eq('source_doc_id', predicate.source_doc_id)
    .eq('type_id', predicate.type_id)
    .maybeSingle();
  expect(error, `assertJournalEntry SELECT failed: ${error?.message}`).toBeNull();
  expect(
    data,
    `expected exactly one journal_entries row for ${JSON.stringify(predicate)}; got none`
  ).not.toBeNull();
  return data as JournalEntryRow;
}

/**
 * Assert NO journal_entries row matches the predicate. Used for orphan/skip
 * scenarios where the test must confirm the engine did NOT emit.
 */
export async function assertNoJournalEntry(
  client: SupabaseClient,
  predicate: JournalEntryPredicate
): Promise<void> {
  const { data, error } = await client
    .from('journal_entries')
    .select('id')
    .eq('source_doc_type', predicate.source_doc_type)
    .eq('source_doc_id', predicate.source_doc_id)
    .eq('type_id', predicate.type_id)
    .maybeSingle();
  expect(error, `assertNoJournalEntry SELECT failed: ${error?.message}`).toBeNull();
  expect(
    data,
    `expected no journal_entries row for ${JSON.stringify(predicate)}; found one`
  ).toBeNull();
}

interface ExpectedLine {
  account_code: string;
  debit_cents?: number;
  credit_cents?: number;
  counterparty_type?: string | null;
}

/**
 * Assert the journal entry's lines match the expected shape. Matches by
 * account_code; debit/credit/counterparty_type are optional shape assertions.
 * Line ordering is NOT asserted (caller-supplied lines vs compute-emitted
 * shape may reorder); use a Map-based check.
 */
export async function assertJournalLines(
  client: SupabaseClient,
  entryId: string,
  expected: ExpectedLine[]
): Promise<void> {
  const { data, error } = await client
    .from('journal_lines')
    .select('account_code, debit_cents, credit_cents, counterparty_type')
    .eq('entry_id', entryId);
  expect(error, `assertJournalLines SELECT failed: ${error?.message}`).toBeNull();
  const actual = (data ?? []) as Array<{
    account_code: string;
    debit_cents: number;
    credit_cents: number;
    counterparty_type: string | null;
  }>;
  expect(actual.length, `entry ${entryId} line count mismatch`).toBe(expected.length);

  for (const expectedLine of expected) {
    const match = actual.find((a) => a.account_code === expectedLine.account_code);
    expect(match, `entry ${entryId} missing line ${expectedLine.account_code}`).toBeDefined();
    if (!match) continue;
    if (expectedLine.debit_cents !== undefined) {
      expect(match.debit_cents, `entry ${entryId} ${expectedLine.account_code} debit mismatch`).toBe(
        expectedLine.debit_cents
      );
    }
    if (expectedLine.credit_cents !== undefined) {
      expect(match.credit_cents, `entry ${entryId} ${expectedLine.account_code} credit mismatch`).toBe(
        expectedLine.credit_cents
      );
    }
    if (expectedLine.counterparty_type !== undefined) {
      expect(match.counterparty_type).toBe(expectedLine.counterparty_type);
    }
  }
}

// ===========================================================================
// Audit log assertions (per the Q13-3 sign-off — integration tests verify
// audit_log only; PostHog telemetry is unit-test territory)
// ===========================================================================

/**
 * Assert at least one audit_log row for the given accounting.posted event.
 * Used to verify the wrap fired the audit-log side effect alongside the GL
 * emit (per the CLAUDE.md regulatory retention convention).
 *
 * **Fire-and-forget polling discipline:** `logAuditEvent` is fire-and-forget
 * (`void logAuditEvent(...)` in posting-engine.ts:101) — the GL emit's
 * `await supabase.rpc(...)` resolves BEFORE the audit-log INSERT commits.
 * This helper polls up to 1 second so the test doesn't race the audit
 * write. If 1s isn't enough, something's wrong (audit-write path Sentry-
 * captures any error so a real failure would surface separately).
 */
export async function assertAccountingPostedAudit(
  client: SupabaseClient,
  journalEntryId: string,
  options: { maxWaitMs?: number; pollIntervalMs?: number } = {}
): Promise<void> {
  const maxWaitMs = options.maxWaitMs ?? 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 50;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const { data, error } = await client
      .from('audit_log')
      .select('id')
      .eq('action', 'accounting.posted')
      .eq('resource_id', journalEntryId)
      .limit(1);
    if (error) {
      throw new Error(`assertAccountingPostedAudit SELECT failed: ${error.message}`);
    }
    if (data && data.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Final failure with a clear message
  expect.fail(
    `expected at least one audit_log row for accounting.posted resource_id=${journalEntryId} ` +
      `within ${maxWaitMs}ms; none found`
  );
}
