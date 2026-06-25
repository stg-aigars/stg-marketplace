/**
 * Lifecycle integration — withdrawal completion (PR C commit 13).
 *
 * Covers:
 *   - Scenario 8: KYC blocked withdrawal (legal_compliance_status='pending_kyc'
 *     → PostingComplianceGateError code 'kyc_gate'; no C.4 entry written)
 *   - Scenario 9: Happy-path withdrawal completion (C.4 entry Dr 5351 /
 *     Cr 2610; withdrawal_requests.status flips to 'completed',
 *     completed_at stamped)
 *   - F5: `dac7_blocked` variant (legal_compliance_status='dac7_blocked' →
 *     PostingComplianceGateError code 'dac7_blocked')
 *
 * Exercises `withdrawalCompletionWithGL` directly (bypasses the route's auth +
 * CSRF gate; those are unit-test territory). Hits real DB end-to-end:
 * counterparty resolution → KYC gate via assembleEntryForRpc → parent RPC
 * (`wallet_withdrawal_complete_with_event_atomic`, migration 109) which
 * composes the GL emit + status flip atomically.
 *
 * **Date control**: `withdrawalCompletionWithGL` derives posting_date /
 * accounting_period from `new Date()`. We use vi.useFakeTimers fixed at
 * 2027-01-15 so entries land in TEST_PERIOD per the test-artifact
 * convention (CLAUDE.md "Accounting Module → Test artifact convention").
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  withdrawalCompletionWithGL,
} from '@/lib/accounting/lifecycle-wraps';
import { PostingComplianceGateError } from '@/lib/accounting/errors';

import {
  supabase,
  TEST_PERIOD,
  ensureTestPeriod,
  ensureTestCounterparty,
  assertJournalEntry,
  assertJournalLines,
  assertNoJournalEntry,
} from './setup';

import { createTestUser, createTestWallet, cleanupTestData } from '../../helpers/factories';

const STAFF_USER_ID = '00000000-0000-4000-8000-cccc11110002';

beforeAll(async () => {
  // Pre-clean lingering @stg-test.local users from prior crashed runs.
  // With fake timers fixed to the same instant, createTestUser produces
  // identical email patterns across runs — colliding with stale rows.
  await cleanupTestData();
  await ensureTestPeriod(supabase, TEST_PERIOD);
});

beforeEach(() => {
  // Fix system time inside TEST_PERIOD so wrap-computed posting_date and
  // accounting_period land in 2027-01.
  // toFake: ['Date'] only -- faking setTimeout/setInterval too breaks Node's
  // built-in fetch (undici), which relies on real timers internally for
  // connection-pool/keep-alive handling. Under Node 22 (not Node 20) this
  // hangs any Supabase client call made while fake timers are active until
  // Vitest's own (real-timer) test timeout fires.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.UTC(2027, 0, 15, 12, 0, 0)));
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  vi.useRealTimers();
  await cleanupTestData();
});

/**
 * Insert a withdrawal_request row directly with status='approved'. Bypasses
 * `createWithdrawalRequest` (which would also debit the wallet via
 * `wallet_withdrawal_debit` RPC — not needed for the completion-side test
 * because the completion RPC doesn't read wallet balance) and the staff
 * approve action (which would require staff auth mocking).
 */
async function createApprovedWithdrawal(
  userId: string,
  amountCents: number,
  refNumber: string
): Promise<{ id: string; reference_number: string; bank_iban: string }> {
  // reviewed_by is intentionally null — `withdrawal_requests.reviewed_by` has
  // an FK to auth.users and our synthetic STAFF_USER_ID isn't a real user.
  // Approval-actor identity is unit-test territory (route.test.ts).
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .insert({
      user_id: userId,
      amount_cents: amountCents,
      bank_account_holder: 'Test Account Holder',
      bank_iban: 'LV80BANK0000435195001',
      reference_number: refNumber,
      status: 'approved',
      reviewed_by: null,
      reviewed_at: new Date().toISOString(),
    })
    .select('id, reference_number, bank_iban')
    .single<{ id: string; reference_number: string; bank_iban: string }>();
  if (error || !data) {
    throw new Error(`createApprovedWithdrawal failed: ${error?.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Scenario 9 — happy path
// ---------------------------------------------------------------------------

describe('Scenario 9 — withdrawal completion happy path', () => {
  it('emits C.4 (Dr 5351 / Cr 2610) and flips withdrawal_requests.status to completed', async () => {
    const seller = await createTestUser({ country: 'LV' });
    await createTestWallet({ userId: seller.id, balanceCents: 0 });
    await ensureTestCounterparty(supabase, {
      id: crypto.randomUUID(),
      type: 'seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'ok',
      user_id: seller.id,
      full_name: seller.full_name,
    });

    const refNumber = `WD-2027-${crypto.randomUUID().slice(0, 8)}`;
    const withdrawalCents = 8765;
    const withdrawal = await createApprovedWithdrawal(seller.id, withdrawalCents, refNumber);

    const result = await withdrawalCompletionWithGL(supabase, {
      withdrawal_request_id: withdrawal.id,
      seller_user_id: seller.id,
      withdrawal_cents: withdrawalCents,
      withdrawal_ref: refNumber,
      seller_iban: withdrawal.bank_iban,
      bank_confirmation_ref: `BANK-CONF-${Date.now()}`,
      staff_user_id: STAFF_USER_ID,
      is_staff_test: true,
    });

    expect(result.journal_entry_id).toBeTruthy();
    expect(result.idempotent_skip).toBe(false);

    // Verify C.4 entry shape via direct GL query
    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'withdrawal_request',
      source_doc_id: withdrawal.id,
      type_id: 'C.4',
    });
    expect(entry.accounting_period).toBe(TEST_PERIOD);
    expect(entry.posting_context.emission_source).toBe('lifecycle');
    // is_staff_test threads through wrap → builder → engine → posting_context.
    // PR #4 reporting views will filter on this tag to exclude stage-2 burn-in
    // entries from customer-traffic dashboards. See runbook §3.
    expect(entry.posting_context.is_staff_test).toBe(true);

    await assertJournalLines(supabase, entry.id, [
      { account_code: '5351', debit_cents: withdrawalCents, credit_cents: 0 },
      { account_code: '2610', debit_cents: 0, credit_cents: withdrawalCents },
    ]);

    // Verify withdrawal_requests row flipped to completed with completed_at set
    const { data: completedRow } = await supabase
      .from('withdrawal_requests')
      .select('status, completed_at')
      .eq('id', withdrawal.id)
      .single<{ status: string; completed_at: string | null }>();
    expect(completedRow?.status).toBe('completed');
    expect(completedRow?.completed_at).not.toBeNull();
  });

  it('idempotent — re-running with the same approved withdrawal returns idempotent_skip', async () => {
    const seller = await createTestUser({ country: 'LV' });
    await createTestWallet({ userId: seller.id, balanceCents: 0 });
    await ensureTestCounterparty(supabase, {
      id: crypto.randomUUID(),
      type: 'seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'ok',
      user_id: seller.id,
      full_name: seller.full_name,
    });

    const refNumber = `WD-2027-${crypto.randomUUID().slice(0, 8)}`;
    const withdrawal = await createApprovedWithdrawal(seller.id, 1000, refNumber);

    const first = await withdrawalCompletionWithGL(supabase, {
      withdrawal_request_id: withdrawal.id,
      seller_user_id: seller.id,
      withdrawal_cents: 1000,
      withdrawal_ref: refNumber,
      seller_iban: withdrawal.bank_iban,
      staff_user_id: STAFF_USER_ID,
    });
    expect(first.journal_entry_id).toBeTruthy();
    expect(first.idempotent_skip).toBe(false);

    // Second call: completed_at IS NOT NULL → RPC's idempotent-retry guard fires
    const second = await withdrawalCompletionWithGL(supabase, {
      withdrawal_request_id: withdrawal.id,
      seller_user_id: seller.id,
      withdrawal_cents: 1000,
      withdrawal_ref: refNumber,
      seller_iban: withdrawal.bank_iban,
      staff_user_id: STAFF_USER_ID,
    });
    expect(second.journal_entry_id).toBeNull();
    expect(second.idempotent_skip).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 8 — KYC blocked (pending_kyc)
// ---------------------------------------------------------------------------

describe('Scenario 8 — withdrawal completion KYC blocked (pending_kyc)', () => {
  it('throws PostingComplianceGateError with code=kyc_gate; no C.4 written; withdrawal stays approved', async () => {
    const seller = await createTestUser({ country: 'LV' });
    await createTestWallet({ userId: seller.id, balanceCents: 0 });
    await ensureTestCounterparty(supabase, {
      id: crypto.randomUUID(),
      type: 'seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'pending_kyc',
      user_id: seller.id,
      full_name: seller.full_name,
    });

    const refNumber = `WD-2027-${crypto.randomUUID().slice(0, 8)}`;
    const withdrawal = await createApprovedWithdrawal(seller.id, 500, refNumber);

    let caught: unknown;
    try {
      await withdrawalCompletionWithGL(supabase, {
        withdrawal_request_id: withdrawal.id,
        seller_user_id: seller.id,
        withdrawal_cents: 500,
        withdrawal_ref: refNumber,
        seller_iban: withdrawal.bank_iban,
        staff_user_id: STAFF_USER_ID,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PostingComplianceGateError);
    expect((caught as PostingComplianceGateError).code).toBe('kyc_gate');

    // No C.4 entry should have been written
    await assertNoJournalEntry(supabase, {
      source_doc_type: 'withdrawal_request',
      source_doc_id: withdrawal.id,
      type_id: 'C.4',
    });

    // Withdrawal still in 'approved' state — no completed_at stamp
    const { data: row } = await supabase
      .from('withdrawal_requests')
      .select('status, completed_at')
      .eq('id', withdrawal.id)
      .single<{ status: string; completed_at: string | null }>();
    expect(row?.status).toBe('approved');
    expect(row?.completed_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F5 — dac7_blocked variant
// ---------------------------------------------------------------------------

describe('F5 — withdrawal completion dac7_blocked variant', () => {
  it('throws PostingComplianceGateError with code=dac7_blocked; no C.4 written', async () => {
    const seller = await createTestUser({ country: 'LV' });
    await createTestWallet({ userId: seller.id, balanceCents: 0 });
    await ensureTestCounterparty(supabase, {
      id: crypto.randomUUID(),
      type: 'seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'dac7_blocked',
      user_id: seller.id,
      full_name: seller.full_name,
    });

    const refNumber = `WD-2027-${crypto.randomUUID().slice(0, 8)}`;
    const withdrawal = await createApprovedWithdrawal(seller.id, 750, refNumber);

    let caught: unknown;
    try {
      await withdrawalCompletionWithGL(supabase, {
        withdrawal_request_id: withdrawal.id,
        seller_user_id: seller.id,
        withdrawal_cents: 750,
        withdrawal_ref: refNumber,
        seller_iban: withdrawal.bank_iban,
        staff_user_id: STAFF_USER_ID,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PostingComplianceGateError);
    expect((caught as PostingComplianceGateError).code).toBe('dac7_blocked');

    await assertNoJournalEntry(supabase, {
      source_doc_type: 'withdrawal_request',
      source_doc_id: withdrawal.id,
      type_id: 'C.4',
    });
  });
});
