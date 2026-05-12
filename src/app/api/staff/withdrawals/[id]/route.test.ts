/**
 * Staff withdrawal handler tests — action='complete' wrap (PR C commit 10).
 *
 * Covers the ACCOUNTING_ENGINE_ENABLED flag-check at the completion branch.
 * Flag-OFF runs byte-identical to pre-PR-C behaviour (direct UPDATE on
 * withdrawal_requests with optimistic lock on status='approved'); flag-ON
 * delegates to withdrawalCompletionWithGL which composes the status flip +
 * completed_at stamp + C.4 GL emit through the
 * wallet_withdrawal_complete_with_event_atomic parent RPC.
 *
 * Scope here: the wrap-or-direct-update branch fires the right path with the
 * right inputs; error families translate to the right HTTP status codes
 * (403 KYC gate, 409 state conflict, 404 not found). What this file does NOT
 * test: the wrap's internals (assembled entry shape, RPC argument
 * construction, audit-log firing) — covered by lifecycle-events.test.ts,
 * mapping.test.ts, and the eventual lifecycle-wraps integration tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PostingComplianceGateError } from '@/lib/accounting/errors';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockIsAccountingEngineEnabled = vi.fn();
const mockWithdrawalCompletionWithGL = vi.fn();
const mockRequireStaffAuth = vi.fn();
const mockRequireBrowserOrigin = vi.fn();
const mockCreditBackRejectedWithdrawal = vi.fn();
const mockCreateServiceClient = vi.fn();

vi.mock('@/lib/accounting/feature-flag', () => ({
  isAccountingEngineEnabled: (...args: unknown[]) => mockIsAccountingEngineEnabled(...args),
}));
vi.mock('@/lib/accounting/lifecycle-wraps', () => ({
  withdrawalCompletionWithGL: (...args: unknown[]) => mockWithdrawalCompletionWithGL(...args),
}));
vi.mock('@/lib/auth/helpers', () => ({
  requireStaffAuth: (...args: unknown[]) => mockRequireStaffAuth(...args),
}));
vi.mock('@/lib/api/csrf', () => ({
  requireBrowserOrigin: (...args: unknown[]) => mockRequireBrowserOrigin(...args),
}));
vi.mock('@/lib/services/wallet', () => ({
  creditBackRejectedWithdrawal: (...args: unknown[]) => mockCreditBackRejectedWithdrawal(...args),
}));
vi.mock('@/lib/supabase', () => ({
  createServiceClient: (...args: unknown[]) => mockCreateServiceClient(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/staff/withdrawals/wd-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: 'wd-1' }) };
}

interface WithdrawalRowOverrides {
  id?: string;
  user_id?: string;
  amount_cents?: number;
  status?: 'pending' | 'approved' | 'completed' | 'rejected';
  bank_iban?: string;
  reference_number?: string;
  staff_notes?: string | null;
}

function withdrawalRow(overrides: WithdrawalRowOverrides = {}) {
  return {
    id: 'wd-1',
    user_id: 'seller-uuid-1',
    amount_cents: 10000,
    status: 'approved',
    bank_iban: 'LV12RIKO0000111122223',
    reference_number: 'WD-2027-00001',
    staff_notes: null,
    ...overrides,
  };
}

// Build a chainable Supabase mock for `from('withdrawal_requests')` with
// configurable fetch + update responses.
interface ClientOpts {
  fetchResult: { data: ReturnType<typeof withdrawalRow> | null; error: { message: string } | null };
  /** For the flag-OFF UPDATE path. Defaults to a successful row. */
  updateResult?: { data: { id: string } | null; error: { message: string } | null };
}

function makeClient(opts: ClientOpts) {
  const updateResult = opts.updateResult ?? { data: { id: 'wd-1' }, error: null };
  // Two .single() call sites in the handler:
  //   (1) initial fetch after .eq('id', ...).single() — returns the row
  //   (2) post-update with .update(...).eq(...).eq(...).select('id').single()
  // Discriminate via a counter — the post-update chain always passes through
  // .update() before .single(). Track flag per-builder so concurrent .from()
  // calls (one per handler operation) don't share state.
  return {
    from: vi.fn(() => {
      let updateCalled = false;
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.in = vi.fn(() => builder);
      builder.update = vi.fn(() => {
        updateCalled = true;
        return builder;
      });
      builder.single = vi.fn(() =>
        updateCalled ? Promise.resolve(updateResult) : Promise.resolve(opts.fetchResult)
      );
      return builder;
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /api/staff/withdrawals/[id] — action=complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBrowserOrigin.mockReturnValue(null);
    mockRequireStaffAuth.mockResolvedValue({ response: null, user: { id: 'staff-uuid-1' } });
    mockWithdrawalCompletionWithGL.mockResolvedValue({
      journal_entry_id: 'je_c4_1',
      idempotent_skip: false,
    });
    mockCreateServiceClient.mockReturnValue(makeClient({
      fetchResult: { data: withdrawalRow(), error: null },
    }));
  });

  describe('flag-OFF (byte-identical to pre-PR-C)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(false);
    });

    it('updates withdrawal_requests directly and does NOT call the wrap', async () => {
      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'complete' }), makeParams());

      expect(res.status).toBe(200);
      expect(mockWithdrawalCompletionWithGL).not.toHaveBeenCalled();
      // serviceClient.from() called twice — once for fetch, once for update
      const client = mockCreateServiceClient.mock.results[0]!.value as { from: ReturnType<typeof vi.fn> };
      expect(client.from).toHaveBeenCalledWith('withdrawal_requests');
    });
  });

  describe('flag-ON (happy path)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('delegates to withdrawalCompletionWithGL with the expected input shape', async () => {
      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'complete' }), makeParams());

      expect(res.status).toBe(200);
      expect(mockWithdrawalCompletionWithGL).toHaveBeenCalledTimes(1);

      const callArgs = mockWithdrawalCompletionWithGL.mock.calls[0]![1] as Record<string, unknown>;
      expect(callArgs).toMatchObject({
        withdrawal_request_id: 'wd-1',
        seller_user_id: 'seller-uuid-1',
        withdrawal_cents: 10000,
        withdrawal_ref: 'WD-2027-00001',
        seller_iban: 'LV12RIKO0000111122223',
        staff_user_id: 'staff-uuid-1',
      });
      // bank_confirmation_ref omitted from request body → undefined in wrap input
      expect(callArgs.bank_confirmation_ref).toBeUndefined();
    });

    it('threads bankConfirmationRef from request body when present', async () => {
      const { PATCH } = await import('./route');
      await PATCH(
        makeRequest({ action: 'complete', bankConfirmationRef: 'SWEDBANK-TXN-12345' }),
        makeParams()
      );

      const callArgs = mockWithdrawalCompletionWithGL.mock.calls[0]![1] as { bank_confirmation_ref: unknown };
      expect(callArgs.bank_confirmation_ref).toBe('SWEDBANK-TXN-12345');
    });

    it('treats empty / whitespace bankConfirmationRef as undefined', async () => {
      const { PATCH } = await import('./route');
      await PATCH(
        makeRequest({ action: 'complete', bankConfirmationRef: '   ' }),
        makeParams()
      );

      const callArgs = mockWithdrawalCompletionWithGL.mock.calls[0]![1] as { bank_confirmation_ref: unknown };
      expect(callArgs.bank_confirmation_ref).toBeUndefined();
    });
  });

  describe('flag-ON (KYC gate / compliance block)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it.each([
      ['kyc_gate', 'pending_kyc'],
      ['dac7_blocked', 'dac7_blocked'],
      ['negative_wallet', 'negative_wallet'],
      ['suspended', 'suspended'],
    ])('returns 403 + code=%s when gate raises for %s status', async (code, status) => {
      mockWithdrawalCompletionWithGL.mockRejectedValueOnce(
        new PostingComplianceGateError({
          code: code as never,
          reason: `Withdrawal blocked: legal_compliance_status='${status}'`,
          context: { counterparty_id: 'cp-1', status },
        })
      );

      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'complete' }), makeParams());
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toMatchObject({
        error: 'Withdrawal blocked by compliance gate',
        code,
      });
    });
  });

  describe('flag-ON (optimistic-lock + state-conflict translation)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('returns 409 when RPC raises LIFECYCLE:INVALID_WITHDRAWAL_STATUS', async () => {
      mockWithdrawalCompletionWithGL.mockRejectedValueOnce(
        new Error(
          'wallet_withdrawal_complete_with_event_atomic failed (P0001): LIFECYCLE:INVALID_WITHDRAWAL_STATUS expected approved, got rejected'
        )
      );

      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'complete' }), makeParams());
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('Withdrawal status has already changed');
    });

    it('returns 404 when RPC raises LIFECYCLE:WITHDRAWAL_NOT_FOUND', async () => {
      mockWithdrawalCompletionWithGL.mockRejectedValueOnce(
        new Error(
          'wallet_withdrawal_complete_with_event_atomic failed (P0001): LIFECYCLE:WITHDRAWAL_NOT_FOUND <uuid>'
        )
      );

      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'complete' }), makeParams());
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Withdrawal not found');
    });
  });

  describe('flag-ON (idempotent retry)', () => {
    beforeEach(() => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
    });

    it('returns 200 success when RPC returns idempotent_skip', async () => {
      mockWithdrawalCompletionWithGL.mockResolvedValueOnce({
        journal_entry_id: null,
        idempotent_skip: true,
      });

      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'complete' }), makeParams());

      expect(res.status).toBe(200);
      // idempotent_skip is a successful no-op from the wrap's POV — handler
      // treats it as success rather than surfacing the skip flag to the
      // client (which doesn't need to disambiguate first-call vs retry).
    });
  });

  describe('pre-RPC state validation (unchanged by flag)', () => {
    it('rejects action=complete on a pending withdrawal with 400', async () => {
      mockIsAccountingEngineEnabled.mockReturnValue(true);
      mockCreateServiceClient.mockReturnValueOnce(makeClient({
        fetchResult: { data: withdrawalRow({ status: 'pending' }), error: null },
      }));

      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'complete' }), makeParams());
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('Can only complete approved withdrawals');
      expect(mockWithdrawalCompletionWithGL).not.toHaveBeenCalled();
    });

    it('rejects unknown action with 400 before any DB fetch', async () => {
      const { PATCH } = await import('./route');
      const res = await PATCH(makeRequest({ action: 'archive' }), makeParams());
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid action');
    });
  });
});
