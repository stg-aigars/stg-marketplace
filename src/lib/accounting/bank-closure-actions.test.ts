/**
 * recordBankStatementClosing server-action unit tests (PR #4b).
 *
 * Mocks requireServerAuth, getPeriodRow, logAuditEvent, revalidatePath, and a
 * focused service-client (accounts lookup + closures upsert). Covers auth
 * gating, validation, the account-flag + period-status preconditions, the
 * happy-path upsert, and the audit fire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireServerAuth, mockGetPeriodRow, mockLogAuditEvent, mockRevalidatePath } = vi.hoisted(() => ({
  mockRequireServerAuth: vi.fn(),
  mockGetPeriodRow: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockRevalidatePath: vi.fn()
}));

vi.mock('@/lib/auth/helpers', () => ({ requireServerAuth: mockRequireServerAuth }));
vi.mock('./queries', () => ({ getPeriodRow: mockGetPeriodRow }));
vi.mock('@/lib/services/audit', () => ({ logAuditEvent: mockLogAuditEvent }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import { recordBankStatementClosing } from './bank-closure-actions';

const STAFF_USER = { id: '00000000-0000-4000-8000-000000000001' };

const upsertSpy = vi.fn();

function buildServiceClient(opts: { account?: unknown; upsertError?: { message: string } | null }) {
  return {
    from: (table: string) => {
      if (table === 'accounts') {
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.maybeSingle = () => Promise.resolve({ data: opts.account ?? null, error: null });
        return b;
      }
      if (table === 'bank_statement_closures') {
        return {
          upsert: (...args: unknown[]) => {
            upsertSpy(...args);
            return Promise.resolve({ error: opts.upsertError ?? null });
          }
        };
      }
      return {};
    }
  } as never;
}

function baseInput() {
  return {
    account_code: '2620',
    period_key: '2026-05',
    closing_balance_cents: 14920,
    statement_ref: 'Swedbank B 31.05.2026'
  };
}

function setup(opts: {
  isStaff?: boolean;
  account?: unknown;
  periodStatus?: string | null;
  upsertError?: { message: string } | null;
} = {}) {
  // Distinguish "not provided" (use default) from an explicit null (account
  // missing) — `??` would collapse the explicit null to the default.
  const account = 'account' in opts ? opts.account : { code: '2620', is_bank_reconcilable: true };
  mockRequireServerAuth.mockResolvedValue({
    isStaff: opts.isStaff ?? true,
    user: STAFF_USER,
    serviceClient: buildServiceClient({
      account,
      upsertError: opts.upsertError ?? null
    })
  });
  mockGetPeriodRow.mockResolvedValue(
    opts.periodStatus === null ? null : { period_key: '2026-05', status: opts.periodStatus ?? 'open' }
  );
}

beforeEach(() => setup());
afterEach(() => vi.clearAllMocks());

describe('recordBankStatementClosing', () => {
  it('rejects a non-staff caller', async () => {
    setup({ isStaff: false });
    expect(await recordBankStatementClosing(baseInput())).toEqual({ error: 'Not authorized' });
  });

  it('rejects a malformed period_key', async () => {
    const result = await recordBankStatementClosing({ ...baseInput(), period_key: '2026/05' });
    expect(result).toEqual({ error: 'Period must be in YYYY-MM format' });
  });

  it('rejects a non-integer closing balance', async () => {
    const result = await recordBankStatementClosing({ ...baseInput(), closing_balance_cents: 149.2 });
    expect(result).toEqual({ error: 'Closing balance must be an integer number of cents' });
  });

  it('rejects an account that is not bank-reconcilable', async () => {
    setup({ account: { code: '6310-C', is_bank_reconcilable: false } });
    const result = await recordBankStatementClosing({ ...baseInput(), account_code: '6310-C' });
    expect(result).toEqual({ error: 'Account 6310-C is not a bank-reconcilable account.' });
  });

  it('rejects when the account does not exist', async () => {
    setup({ account: null });
    const result = await recordBankStatementClosing({ ...baseInput(), account_code: '9999' });
    expect(result).toEqual({ error: 'Account 9999 not found.' });
  });

  it('rejects when the period is not open', async () => {
    setup({ periodStatus: 'soft_locked' });
    const result = await recordBankStatementClosing(baseInput());
    expect(result).toMatchObject({ error: expect.stringContaining('soft_locked') });
  });

  it('upserts the closing and fires a regulatory audit event on the happy path', async () => {
    const result = await recordBankStatementClosing(baseInput());
    expect(result).toEqual({ success: true });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const [payload] = upsertSpy.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({
      account_code: '2620',
      period_key: '2026-05',
      closing_balance_cents: 14920,
      recorded_by: STAFF_USER.id
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'bank_closure.recorded',
        resourceType: 'bank_statement_closure',
        resourceId: '2620:2026-05',
        retentionClass: 'regulatory'
      })
    );
  });

  it('returns an error when the upsert fails', async () => {
    setup({ upsertError: { message: 'db down' } });
    const result = await recordBankStatementClosing(baseInput());
    expect(result).toMatchObject({ error: expect.stringContaining('Could not record') });
  });
});
