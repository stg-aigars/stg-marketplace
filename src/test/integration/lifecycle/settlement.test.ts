/**
 * Lifecycle integration — C.3 EveryPay settlement staff action (PR C
 * commit 11a). Scenario 13 from the commit-13 preamble.
 *
 * Exercises `recordEverypaySettlement` end-to-end against a real local
 * Supabase: server action builds the C.3 event, calls engine.emit()
 * directly (not a parent RPC — C.3 is staff-only manual emission per the
 * round-2 brief), engine writes Dr 2610 / Cr 2630 to journal_entries.
 *
 * The server action requires `requireServerAuth` which reads Next.js
 * cookies(); we mock at that border per the period-close.test.ts pattern.
 * Everything below auth (the emit pipeline + journal_entries write) hits
 * the real DB.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { mockRequireServerAuth, mockRevalidatePath } = vi.hoisted(() => ({
  mockRequireServerAuth: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireServerAuth: mockRequireServerAuth,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

import { recordEverypaySettlement } from '@/lib/accounting/everypay-settlement-actions';

import {
  supabase,
  TEST_PERIOD,
  TEST_PERIOD_LAST_DAY,
  ensureTestPeriod,
  assertJournalEntry,
  assertJournalLines,
} from './setup';

const STAFF_USER_ID = '00000000-0000-4000-8000-cccc11110001';

beforeAll(async () => {
  // Default auth: staff user, real service client
  mockRequireServerAuth.mockResolvedValue({
    isStaff: true,
    user: { id: STAFF_USER_ID },
    serviceClient: supabase,
  });

  await ensureTestPeriod(supabase, TEST_PERIOD);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Scenario 13 — C.3 EveryPay settlement', () => {
  it('records a card-rail settlement: Dr 2610 + Cr 2630 in journal_entries', async () => {
    const bankRef = `INT-LIFECYCLE-C3-SCEN-13-${Date.now()}`;
    const settlementCents = 12500;

    const result = await recordEverypaySettlement({
      bank_statement_reference: bankRef,
      settlement_cents: settlementCents,
      batch_date: TEST_PERIOD_LAST_DAY,
      settlement_value_date: TEST_PERIOD_LAST_DAY,
      included_txn_refs: ['ep-test-int-1', 'ep-test-int-2'],
    });

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.success).toBe(true);
    expect(['created', 'idempotent_skip']).toContain(result.status);

    // Verify the entry shape via direct GL query
    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'everypay_settlement',
      source_doc_id: bankRef,
      type_id: 'C.3',
    });

    expect(entry.accounting_period).toBe(TEST_PERIOD);
    expect(entry.posting_context.emission_source).toBe('staff_manual');

    await assertJournalLines(supabase, entry.id, [
      { account_code: '2610', debit_cents: settlementCents, credit_cents: 0 },
      { account_code: '2630', debit_cents: 0, credit_cents: settlementCents },
    ]);

    // Note: accounting.posted audit firing is NOT asserted here. logAuditEvent
    // is fire-and-forget AND requires actor_id to FK against auth.users — the
    // synthetic STAFF_USER_ID isn't a real auth.users row, so the audit INSERT
    // fails silently (Sentry-captured but not raised). Audit firing is verified
    // by unit tests in posting-engine.test.ts where logAuditEvent is mocked.
  });

  it('idempotent — re-submission with same bank_statement_reference returns status=idempotent_skip', async () => {
    const bankRef = `INT-LIFECYCLE-C3-IDEM-${Date.now()}`;

    const first = await recordEverypaySettlement({
      bank_statement_reference: bankRef,
      settlement_cents: 500,
      batch_date: TEST_PERIOD_LAST_DAY,
      settlement_value_date: TEST_PERIOD_LAST_DAY,
      included_txn_refs: ['ep-idem-1'],
    });
    expect('success' in first && first.success).toBe(true);
    if ('error' in first) return;
    expect(first.status).toBe('created');
    const firstId = first.entry_id;

    const second = await recordEverypaySettlement({
      bank_statement_reference: bankRef,
      settlement_cents: 500,
      batch_date: TEST_PERIOD_LAST_DAY,
      settlement_value_date: TEST_PERIOD_LAST_DAY,
      included_txn_refs: ['ep-idem-1'],
    });
    expect('success' in second && second.success).toBe(true);
    if ('error' in second) return;
    expect(second.status).toBe('idempotent_skip');
    expect(second.entry_id).toBe(firstId);
  });

  it('rejects non-staff caller', async () => {
    mockRequireServerAuth.mockResolvedValueOnce({
      isStaff: false,
      user: { id: STAFF_USER_ID },
      serviceClient: supabase,
    });

    const result = await recordEverypaySettlement({
      bank_statement_reference: `INT-LIFECYCLE-C3-AUTH-${Date.now()}`,
      settlement_cents: 100,
      batch_date: TEST_PERIOD_LAST_DAY,
      settlement_value_date: TEST_PERIOD_LAST_DAY,
      included_txn_refs: [],
    });

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('Not authorized');
    }
  });
});
