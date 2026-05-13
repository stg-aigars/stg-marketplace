/**
 * recordEverypaySettlement server-action unit tests (PR C commit 11a).
 *
 * Mocks `requireServerAuth`, `emit`, `revalidatePath`. Each scenario tests
 * a specific path through the action — auth gating, validation, happy path,
 * idempotency, emit failure, optional-notes normalization.
 *
 * What this file does NOT test: the lifecycle-events.ts builder (covered by
 * lifecycle-events.test.ts); the parseIncludedTxnRefs helper (covered by
 * everypay-settlement-parse.test.ts); the full engine emit() pipeline
 * (covered by posting-engine.test.ts + integration tests in commit 13).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRequireServerAuth,
  mockEmit,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireServerAuth: vi.fn(),
  mockEmit: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireServerAuth: mockRequireServerAuth,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('./posting-engine', () => ({
  emit: mockEmit,
}));

import { recordEverypaySettlement } from './everypay-settlement-actions';

const STAFF_USER = { id: '00000000-0000-4000-8000-000000000001' };
const SERVICE_CLIENT = {} as never; // emit() is mocked; we don't exercise the real client

function baseInput() {
  return {
    bank_statement_reference: 'SWB-2027-01-15-001',
    settlement_cents: 12500,
    batch_date: '2027-01-14',
    settlement_value_date: '2027-01-15',
    included_txn_refs: ['ep-1', 'ep-2', 'ep-3'],
  };
}

beforeEach(() => {
  mockRequireServerAuth.mockResolvedValue({
    isStaff: true,
    user: STAFF_USER,
    serviceClient: SERVICE_CLIENT,
  });
  mockEmit.mockResolvedValue({ status: 'created', entry_id: 'je-c3-1' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('recordEverypaySettlement', () => {
  it('happy path — valid input fires emit() and returns { success, entry_id, status: created }', async () => {
    const result = await recordEverypaySettlement(baseInput());

    expect(result).toEqual({
      success: true,
      entry_id: 'je-c3-1',
      status: 'created',
    });
    expect(mockEmit).toHaveBeenCalledTimes(1);

    const [, event] = mockEmit.mock.calls[0]!;
    expect(event).toMatchObject({
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: 'everypay_settlement',
      source_doc_id: 'SWB-2027-01-15-001',
      emission_source: 'staff_manual',
      created_by: STAFF_USER.id,
    });
    expect((event as { payload: Record<string, unknown> }).payload).toMatchObject({
      settlement_cents: 12500,
      batch_date: '2027-01-14',
      settlement_value_date: '2027-01-15',
      included_txn_refs: ['ep-1', 'ep-2', 'ep-3'],
    });

    // Affected ledger pages revalidated
    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting/account-ledger/2610');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting/account-ledger/2630');
  });

  it('idempotent retry — engine returns idempotent_skip; action passes through with status', async () => {
    mockEmit.mockResolvedValueOnce({ status: 'idempotent_skip', entry_id: 'je-c3-1' });

    const result = await recordEverypaySettlement(baseInput());

    expect(result).toEqual({
      success: true,
      entry_id: 'je-c3-1',
      status: 'idempotent_skip',
    });
  });

  it('emit failure — engine returns failed; error bubbles to caller', async () => {
    mockEmit.mockResolvedValueOnce({
      status: 'failed',
      error: "Period 2027-01 is hard_locked; corrections must post to current open period as reversal entries",
    });

    const result = await recordEverypaySettlement({
      ...baseInput(),
      settlement_value_date: '2027-01-15',
    });

    expect(result).toEqual({
      error: "Period 2027-01 is hard_locked; corrections must post to current open period as reversal entries",
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  describe('validation', () => {
    it('rejects missing bank_statement_reference', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), bank_statement_reference: '' });
      expect(result).toEqual({ error: 'Bank statement reference is required' });
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only bank_statement_reference', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), bank_statement_reference: '   ' });
      expect(result).toEqual({ error: 'Bank statement reference is required' });
    });

    it('rejects zero settlement_cents', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), settlement_cents: 0 });
      expect(result).toEqual({ error: 'Settlement amount must be a positive integer (cents)' });
    });

    it('rejects negative settlement_cents', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), settlement_cents: -100 });
      expect(result).toEqual({ error: 'Settlement amount must be a positive integer (cents)' });
    });

    it('rejects non-integer settlement_cents', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), settlement_cents: 12.5 });
      expect(result).toEqual({ error: 'Settlement amount must be a positive integer (cents)' });
    });

    it('rejects malformed batch_date', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), batch_date: '2027/01/14' });
      expect(result).toEqual({ error: 'Batch date must be in YYYY-MM-DD format' });
    });

    it('rejects malformed settlement_value_date', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), settlement_value_date: 'Jan 15, 2027' });
      expect(result).toEqual({ error: 'Settlement value date must be in YYYY-MM-DD format' });
    });
  });

  describe('optional notes normalization (commit-10 §6 convention)', () => {
    it('threads non-empty notes into payload.staff_notes', async () => {
      await recordEverypaySettlement({
        ...baseInput(),
        posting_context_notes: 'Reconciled against Swedbank statement #4521',
      });

      const [, event] = mockEmit.mock.calls[0]!;
      expect((event as { payload: Record<string, unknown> }).payload.staff_notes).toBe(
        'Reconciled against Swedbank statement #4521'
      );
    });

    it('treats empty-string notes as absent — field omitted from payload', async () => {
      await recordEverypaySettlement({ ...baseInput(), posting_context_notes: '' });

      const [, event] = mockEmit.mock.calls[0]!;
      expect((event as { payload: Record<string, unknown> }).payload.staff_notes).toBeUndefined();
    });

    it('treats whitespace-only notes as absent', async () => {
      await recordEverypaySettlement({ ...baseInput(), posting_context_notes: '   \n\t  ' });

      const [, event] = mockEmit.mock.calls[0]!;
      expect((event as { payload: Record<string, unknown> }).payload.staff_notes).toBeUndefined();
    });

    it('trims surrounding whitespace from notes before persisting', async () => {
      await recordEverypaySettlement({
        ...baseInput(),
        posting_context_notes: '  Reconciled with statement  ',
      });

      const [, event] = mockEmit.mock.calls[0]!;
      expect((event as { payload: Record<string, unknown> }).payload.staff_notes).toBe(
        'Reconciled with statement'
      );
    });
  });

  describe('messy-paste cases (via parseIncludedTxnRefs upstream from the form)', () => {
    // The server action receives the parsed array; the parser is exercised
    // separately in everypay-settlement-parse.test.ts. These tests assert
    // the action correctly accepts the parser's outputs without rejecting
    // them or mutating them.

    it('accepts empty included_txn_refs (staff records before reconciling)', async () => {
      const result = await recordEverypaySettlement({ ...baseInput(), included_txn_refs: [] });
      expect(result).toMatchObject({ success: true });
      const [, event] = mockEmit.mock.calls[0]!;
      expect((event as { payload: Record<string, unknown> }).payload.included_txn_refs).toEqual([]);
    });

    it('accepts a large list of refs (typical end-of-day settlement)', async () => {
      const refs = Array.from({ length: 50 }, (_, i) => `ep-${i + 1}`);
      const result = await recordEverypaySettlement({ ...baseInput(), included_txn_refs: refs });
      expect(result).toMatchObject({ success: true });
      const [, event] = mockEmit.mock.calls[0]!;
      expect((event as { payload: Record<string, unknown> }).payload.included_txn_refs).toEqual(refs);
    });

    it('rejects non-array included_txn_refs as caller bug', async () => {
      const result = await recordEverypaySettlement({
        ...baseInput(),
        // simulate a caller mistake (form transmitting a string instead of array)
        included_txn_refs: 'ep-1,ep-2' as unknown as string[],
      });
      expect(result).toEqual({ error: 'included_txn_refs must be an array (caller bug)' });
    });
  });

  describe('auth gating', () => {
    it('rejects non-staff caller', async () => {
      mockRequireServerAuth.mockResolvedValueOnce({
        isStaff: false,
        user: STAFF_USER,
        serviceClient: SERVICE_CLIENT,
      });

      const result = await recordEverypaySettlement(baseInput());
      expect(result).toEqual({ error: 'Not authorized' });
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated caller (user null)', async () => {
      mockRequireServerAuth.mockResolvedValueOnce({
        isStaff: true,
        user: null,
        serviceClient: SERVICE_CLIENT,
      });

      const result = await recordEverypaySettlement(baseInput());
      expect(result).toEqual({ error: 'Not authorized' });
    });
  });
});
