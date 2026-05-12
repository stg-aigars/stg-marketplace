/**
 * Lifecycle integration — Shape-2 wallet-integrity invariant (PR C commit 13).
 * Scenario 16 from the commit-13 preamble.
 *
 * Exercises the post-commit-11b reconciliation contract: during the Shape-2
 * lag between withdrawal request (wallet debited immediately at request via
 * `wallet_withdrawal_debit`) and staff completion (GL 5351 debited via C.4),
 * `getWalletIntegrity` must report `is_reconciled=true` because
 * `delta_cents === in_flight_withdrawals_cents`. After completion both
 * `delta` and `in_flight` drop back to their pre-withdrawal levels.
 *
 * **Assertion strategy — relative deltas, not absolute snapshots.** The
 * global `journal_lines` 5351 contributions and `wallets` rows can carry
 * arbitrary state from prior test runs (immutable journal_lines + the
 * fact that local Supabase isn't reset between test files). Asserting
 * absolute `is_reconciled` is brittle. We instead assert the Shape-2
 * invariant **relative** to a pre-test snapshot: `(delta - in_flight)`
 * stays constant across the request + completion sequence.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { withdrawalCompletionWithGL } from '@/lib/accounting/lifecycle-wraps';
import { getWalletIntegrity } from '@/lib/accounting/queries';

import {
  supabase,
  TEST_PERIOD,
  TEST_PERIOD_LAST_DAY,
  ensureTestPeriod,
  ensureTestCounterparty,
} from './setup';

import { createTestUser, createTestWallet, cleanupTestData } from '../../helpers/factories';

beforeAll(async () => {
  await cleanupTestData();
  await ensureTestPeriod(supabase, TEST_PERIOD);
});

beforeEach(() => {
  vi.useFakeTimers();
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
 * Insert a balanced manual journal entry that credits 5351 for a specific
 * counterparty (the seller side of an O.x slice, minus the splits — we
 * just need the seller's 5351 liability built up before the withdrawal).
 * Uses H.1 (manual) type so we sidestep the v3 mapping table's compute path.
 * Balanced via Dr 2610 (cash, debit-normal) on the opposite side.
 */
async function seedSellerWalletLiability(
  counterpartyId: string,
  amountCents: number,
  tag: string
): Promise<void> {
  const entry = {
    posting_date: TEST_PERIOD_LAST_DAY,
    accounting_period: TEST_PERIOD,
    tax_period: TEST_PERIOD,
    entry_type: 'manual',
    type_id: 'H.1',
    source_doc_type: 'integration_test_wallet_seed',
    source_doc_id: `wallet-seed-${tag}-${counterpartyId.slice(0, 8)}-${amountCents}`,
    narrative: `Seller 5351 liability seed — ${amountCents}c`,
    posting_context: { test_artifact: true, override_type: 'pre_registration_gross' },
    created_by: 'integration-test-scenario-16',
    period_close_adjustment: false,
  };
  const lines = [
    {
      line_number: 1,
      account_code: '2610',
      debit_cents: amountCents,
      credit_cents: 0,
      currency: 'EUR',
    },
    {
      line_number: 2,
      account_code: '5351',
      debit_cents: 0,
      credit_cents: amountCents,
      currency: 'EUR',
      counterparty_id: counterpartyId,
      counterparty_type: 'seller',
    },
  ];
  const { error } = await supabase.rpc('insert_journal_entry', {
    p_entry: entry,
    p_lines: lines,
  });
  if (error && !error.message.includes('duplicate')) {
    throw new Error(`seedSellerWalletLiability failed: ${error.message}`);
  }
}

describe('Scenario 16 — Shape-2 wallet-integrity lag invariant', () => {
  it('delta - in_flight stays constant: request increases both equally; completion clears both equally', async () => {
    const seller = await createTestUser({ country: 'LV' });

    const counterpartyId = crypto.randomUUID();
    await ensureTestCounterparty(supabase, {
      id: counterpartyId,
      type: 'seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'ok',
      user_id: seller.id,
      full_name: seller.full_name,
    });

    const initialBalance = 10_000;
    const withdrawalCents = 4_321;

    // Wallet starts at full balance; corresponding GL 5351 credit seeded for
    // this seller so wallet/GL agree before the withdrawal cycle starts.
    await createTestWallet({ userId: seller.id, balanceCents: initialBalance });
    await seedSellerWalletLiability(counterpartyId, initialBalance, 'scen-16');

    // ──────────────────────────────────────────────────────────────────
    // SNAPSHOT A — balanced state (wallet & GL agree for this seller; no
    //   in-flight withdrawal yet).
    // ──────────────────────────────────────────────────────────────────
    const snapshotA = await getWalletIntegrity(supabase);
    const reconciledOffsetA = snapshotA.delta_cents - snapshotA.in_flight_withdrawals_cents;

    // Insert an APPROVED withdrawal (status='approved', completed_at=null);
    // simulate Shape 2's wallet-debited-at-request by direct UPDATE on wallets
    // (bypasses the wallet_withdrawal_debit RPC — that's not under test here).
    const refNumber = `WD-2027-${crypto.randomUUID().slice(0, 8)}`;
    const { data: wd, error: wdError } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: seller.id,
        amount_cents: withdrawalCents,
        bank_account_holder: 'Test Account Holder',
        bank_iban: 'LV80BANK0000435195001',
        reference_number: refNumber,
        status: 'approved',
        reviewed_by: null,
        reviewed_at: new Date().toISOString(),
      })
      .select('id, bank_iban')
      .single<{ id: string; bank_iban: string }>();
    expect(wdError, `withdrawal insert failed: ${wdError?.message}`).toBeNull();

    const { error: debitError } = await supabase
      .from('wallets')
      .update({ balance_cents: initialBalance - withdrawalCents })
      .eq('user_id', seller.id);
    expect(debitError, `wallet debit failed: ${debitError?.message}`).toBeNull();

    // ──────────────────────────────────────────────────────────────────
    // SNAPSHOT B — pre-completion (Shape-2 lag: wallet debited, GL 5351 not).
    //   Expected: delta increased by withdrawalCents (wallet decreased);
    //             in_flight increased by withdrawalCents;
    //             (delta - in_flight) unchanged.
    // ──────────────────────────────────────────────────────────────────
    const snapshotB = await getWalletIntegrity(supabase);
    expect(snapshotB.delta_cents - snapshotA.delta_cents).toBe(withdrawalCents);
    expect(snapshotB.in_flight_withdrawals_cents - snapshotA.in_flight_withdrawals_cents).toBe(
      withdrawalCents
    );
    const reconciledOffsetB = snapshotB.delta_cents - snapshotB.in_flight_withdrawals_cents;
    expect(reconciledOffsetB).toBe(reconciledOffsetA);

    // ──────────────────────────────────────────────────────────────────
    // Run completion — C.4 fires Dr 5351 / Cr 2610; status flips to completed.
    // ──────────────────────────────────────────────────────────────────
    const result = await withdrawalCompletionWithGL(supabase, {
      withdrawal_request_id: wd!.id,
      seller_user_id: seller.id,
      withdrawal_cents: withdrawalCents,
      withdrawal_ref: refNumber,
      seller_iban: wd!.bank_iban,
      staff_user_id: '00000000-0000-4000-8000-cccc11110002',
    });
    expect(result.journal_entry_id).toBeTruthy();

    // ──────────────────────────────────────────────────────────────────
    // SNAPSHOT C — post-completion. GL 5351 now debited (delta drops by
    //   withdrawalCents); withdrawal no longer in-flight (in_flight drops).
    //   Both should return to snapshot-A levels for this seller.
    // ──────────────────────────────────────────────────────────────────
    const snapshotC = await getWalletIntegrity(supabase);
    expect(snapshotC.delta_cents).toBe(snapshotA.delta_cents);
    expect(snapshotC.in_flight_withdrawals_cents).toBe(snapshotA.in_flight_withdrawals_cents);

    // Shape-2 invariant: the reconciled-offset (delta - in_flight) is
    // preserved across the full cycle.
    const reconciledOffsetC = snapshotC.delta_cents - snapshotC.in_flight_withdrawals_cents;
    expect(reconciledOffsetC).toBe(reconciledOffsetA);
  });
});
