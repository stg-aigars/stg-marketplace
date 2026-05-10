/**
 * Period state-transition server-action unit tests (PR #4, Task 6).
 *
 * Mocks `requireServerAuth`, `logAuditEvent`, `revalidatePath`, plus the
 * checklist composer and queries module. Each action is tested for: auth
 * gating, illegal transitions, and the success path including audit-event
 * shape and revalidatePath calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks. vi.mock() runs before imports, so factory references must be
// hoisted via vi.hoisted() to be available at mock-factory eval time.
const {
  mockRequireServerAuth,
  mockLogAuditEvent,
  mockRevalidatePath,
  mockGetPeriodRow,
  mockGetEntriesPostedSince,
  mockGetPeriodCloseChecklist,
} = vi.hoisted(() => ({
  mockRequireServerAuth: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockGetPeriodRow: vi.fn(),
  mockGetEntriesPostedSince: vi.fn(),
  mockGetPeriodCloseChecklist: vi.fn(),
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireServerAuth: mockRequireServerAuth,
}));

vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('./queries', () => ({
  getPeriodRow: mockGetPeriodRow,
  getEntriesPostedSince: mockGetEntriesPostedSince,
}));

vi.mock('./checklist', () => ({
  getPeriodCloseChecklist: mockGetPeriodCloseChecklist,
}));

import { hardLockPeriod, softLockPeriod, unsoftLockPeriod } from './period-actions';

// =============================================================================
// Mock supabase client builder — only used to track update() chains
// =============================================================================
//
// The actions call serviceClient.from('periods').update(...).eq(...).eq(...).
// The update chain's terminal `.eq()` resolves to { error: null } on success.
// We capture the update payload via a vi.fn so tests can assert on it.

interface UpdateCapture {
  table: string;
  payload: Record<string, unknown>;
}

interface RpcCapture {
  fn: string;
  args: Record<string, unknown>;
}

interface RpcResponse {
  data: unknown;
  error: { message: string } | null;
}

function buildMockServiceClient(
  updateError: { message: string } | null = null,
  rpcResponse: RpcResponse = { data: null, error: null },
): {
  client: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };
  captures: UpdateCapture[];
  rpcCalls: RpcCapture[];
} {
  const captures: UpdateCapture[] = [];
  const rpcCalls: RpcCapture[] = [];

  const fromMock = vi.fn((table: string) => {
    const builder: Record<string, ReturnType<typeof vi.fn>> & {
      then?: (
        onFulfilled: (value: { error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise<unknown>;
    } = {
      update: vi.fn((payload: Record<string, unknown>) => {
        captures.push({ table, payload });
        return builder;
      }),
      eq: vi.fn(),
    };
    builder.eq.mockReturnValue(builder);
    builder.then = (onFulfilled, onRejected) =>
      Promise.resolve({ error: updateError }).then(onFulfilled, onRejected);
    return builder;
  });

  const rpcMock = vi.fn((fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    return {
      maybeSingle: () => Promise.resolve(rpcResponse),
    };
  });

  return { client: { from: fromMock, rpc: rpcMock }, captures, rpcCalls };
}

// =============================================================================
// Fixtures
// =============================================================================

const PERIOD_KEY = '2027-01';
const STAFF_USER_ID = '00000000-0000-0000-0000-000000000001';

const STAFF_AUTH = (serviceClient: unknown) => ({
  user: { id: STAFF_USER_ID },
  profile: { is_staff: true },
  isStaff: true,
  serviceClient,
});

const NON_STAFF_AUTH = (serviceClient: unknown) => ({
  user: { id: STAFF_USER_ID },
  profile: { is_staff: false },
  isStaff: false,
  serviceClient,
});

const periodOpen = {
  period_key: PERIOD_KEY,
  period_type: 'month' as const,
  status: 'open' as const,
  locked_at: null,
  locked_by: null,
  created_at: '2027-01-01T00:00:00Z',
};

const periodSoftLocked = {
  period_key: PERIOD_KEY,
  period_type: 'month' as const,
  status: 'soft_locked' as const,
  locked_at: '2027-02-05T10:00:00Z',
  locked_by: STAFF_USER_ID,
  created_at: '2027-01-01T00:00:00Z',
};

const periodHardLocked = {
  period_key: PERIOD_KEY,
  period_type: 'month' as const,
  status: 'hard_locked' as const,
  locked_at: '2027-02-05T10:00:00Z',
  locked_by: STAFF_USER_ID,
  created_at: '2027-01-01T00:00:00Z',
};

const checklistAllPass = {
  period_key: PERIOD_KEY,
  period_type: 'month' as const,
  period_status: 'open' as const,
  items: [
    { id: 1, label: 'Σ debits = Σ credits', status: 'pass', detail: '' },
  ],
  all_pass: true,
  can_soft_lock: true,
  can_hard_lock: false,
  can_unsoft_lock: false,
};

const checklistFailing = {
  period_key: PERIOD_KEY,
  period_type: 'month' as const,
  period_status: 'open' as const,
  items: [
    { id: 1, label: 'Σ debits = Σ credits', status: 'fail', detail: 'Imbalance: debits €100.00 vs credits €99.00' },
    { id: 2, label: 'Bank reconciliation', status: 'pass', detail: '' },
  ],
  all_pass: false,
  can_soft_lock: false,
  can_hard_lock: false,
  can_unsoft_lock: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// softLockPeriod
// =============================================================================

describe('softLockPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Not authorized when caller is not staff', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(NON_STAFF_AUTH(client));

    const result = await softLockPeriod(PERIOD_KEY);

    expect(result).toEqual({ error: 'Not authorized' });
    expect(mockGetPeriodRow).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns error when period is not found', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(null);

    const result = await softLockPeriod(PERIOD_KEY);

    expect(result).toEqual({ error: `Period ${PERIOD_KEY} not found.` });
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('returns error when period is already soft_locked', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);

    const result = await softLockPeriod(PERIOD_KEY);

    expect(result).toEqual({
      error: `Period ${PERIOD_KEY} is soft_locked; only open periods can be soft-locked.`,
    });
    expect(mockGetPeriodCloseChecklist).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('returns error when period is hard_locked', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodHardLocked);

    const result = await softLockPeriod(PERIOD_KEY);

    expect('error' in result && result.error.includes('hard_locked')).toBe(true);
  });

  it('returns checklist gate error with failing item context when can_soft_lock=false', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodOpen);
    mockGetPeriodCloseChecklist.mockResolvedValue(checklistFailing);

    const result = await softLockPeriod(PERIOD_KEY);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Cannot soft-lock');
      expect(result.error).toContain('Σ debits = Σ credits');
      expect(result.error).toContain('Imbalance');
    }
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('soft-locks the period and fires regulatory audit event with correct shape', async () => {
    const { client, captures } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodOpen);
    mockGetPeriodCloseChecklist.mockResolvedValue(checklistAllPass);

    const result = await softLockPeriod(PERIOD_KEY);

    expect(result).toEqual({ success: true });
    expect(captures).toHaveLength(1);
    expect(captures[0].table).toBe('periods');
    expect(captures[0].payload.status).toBe('soft_locked');
    expect(captures[0].payload.locked_by).toBe(STAFF_USER_ID);
    expect(typeof captures[0].payload.locked_at).toBe('string');

    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.anything(), {
      actorType: 'user',
      actorId: STAFF_USER_ID,
      action: 'accounting.period_status_changed',
      resourceType: 'period',
      resourceId: PERIOD_KEY,
      metadata: {
        period_type: 'month',
        from_status: 'open',
        to_status: 'soft_locked',
      },
      retentionClass: 'regulatory',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting/period-close');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting');
  });

  it('returns error and skips audit when the periods update fails', async () => {
    const { client } = buildMockServiceClient({ message: 'connection lost' });
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodOpen);
    mockGetPeriodCloseChecklist.mockResolvedValue(checklistAllPass);

    const result = await softLockPeriod(PERIOD_KEY);

    expect('error' in result).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// =============================================================================
// hardLockPeriod
// =============================================================================

describe('hardLockPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Not authorized when caller is not staff', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(NON_STAFF_AUTH(client));

    const result = await hardLockPeriod(PERIOD_KEY);

    expect(result).toEqual({ error: 'Not authorized' });
    expect(mockGetPeriodRow).not.toHaveBeenCalled();
  });

  it('returns error when period is not found', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(null);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect(result).toEqual({ error: `Period ${PERIOD_KEY} not found.` });
  });

  it('returns error when period is open (not yet soft_locked)', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodOpen);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect('error' in result && result.error.includes('open')).toBe(true);
    expect(mockGetEntriesPostedSince).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('returns error when period is already hard_locked', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodHardLocked);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect('error' in result && result.error.includes('hard_locked')).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('refuses to hard-lock a soft_locked row with no locked_at (corrupted state)', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue({ ...periodSoftLocked, locked_at: null });

    const result = await hardLockPeriod(PERIOD_KEY);

    expect('error' in result && result.error.includes('corrupted')).toBe(true);
    expect(mockGetEntriesPostedSince).not.toHaveBeenCalled();
  });

  it('returns entries-since error via diagnostic re-read when RPC reports precondition failed and entries were posted', async () => {
    // RPC returns NULL (precondition failed: e.g. entries posted since
    // soft-lock); the action's diagnostic re-read finds those entries and
    // surfaces the precise UX message.
    const { client } = buildMockServiceClient(null, { data: null, error: null });
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);
    mockGetEntriesPostedSince.mockResolvedValue([
      { id: 'e1' },
      { id: 'e2' },
    ]);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('2 entries');
      expect(result.error).toContain('soft-lock');
    }
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('singularises the entries-since diagnostic when exactly one entry was posted', async () => {
    const { client } = buildMockServiceClient(null, { data: null, error: null });
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);
    mockGetEntriesPostedSince.mockResolvedValue([{ id: 'e1' }]);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('1 entry');
      expect(result.error).not.toContain('1 entries');
    }
  });

  it('returns generic state-changed error when RPC reports precondition failed and no entries were posted', async () => {
    // RPC returns NULL (precondition failed: status drift, e.g. someone else
    // hard-locked first or the period was unsoft-locked + re-soft-locked at a
    // different timestamp). The diagnostic re-read finds no entries since,
    // so the action surfaces the generic reload-and-retry message.
    const { client } = buildMockServiceClient(null, { data: null, error: null });
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);
    mockGetEntriesPostedSince.mockResolvedValue([]);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/state changed|reload and retry/);
    }
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('hard-locks the period via RPC and fires regulatory audit event with correct shape', async () => {
    const periodHardLockedReturn = { ...periodSoftLocked, status: 'hard_locked' as const };
    const { client, rpcCalls } = buildMockServiceClient(null, {
      data: periodHardLockedReturn,
      error: null,
    });
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect(result).toEqual({ success: true });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('hard_lock_period_atomic');
    expect(rpcCalls[0].args).toEqual({
      p_period_key: PERIOD_KEY,
      p_period_type: 'month',
      p_expected_locked_at: periodSoftLocked.locked_at,
    });
    // The action does not call .from('periods').update(...) anymore on the
    // happy path — the RPC owns the UPDATE.
    expect(mockGetEntriesPostedSince).not.toHaveBeenCalled();

    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.anything(), {
      actorType: 'user',
      actorId: STAFF_USER_ID,
      action: 'accounting.period_status_changed',
      resourceType: 'period',
      resourceId: PERIOD_KEY,
      metadata: {
        period_type: 'month',
        from_status: 'soft_locked',
        to_status: 'hard_locked',
      },
      retentionClass: 'regulatory',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting/period-close');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting');
  });

  it('returns error and skips audit when the RPC fails', async () => {
    const { client } = buildMockServiceClient(null, {
      data: null,
      error: { message: 'connection lost' },
    });
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);

    const result = await hardLockPeriod(PERIOD_KEY);

    expect('error' in result).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// =============================================================================
// unsoftLockPeriod
// =============================================================================

describe('unsoftLockPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Not authorized when caller is not staff', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(NON_STAFF_AUTH(client));

    const result = await unsoftLockPeriod(PERIOD_KEY, 'caught a bad entry');

    expect(result).toEqual({ error: 'Not authorized' });
    expect(mockGetPeriodRow).not.toHaveBeenCalled();
  });

  it('returns error when reason is empty', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));

    const result = await unsoftLockPeriod(PERIOD_KEY, '');

    expect(result).toEqual({ error: 'Reason is required to unsoft-lock a period.' });
    expect(mockGetPeriodRow).not.toHaveBeenCalled();
  });

  it('returns error when reason is only whitespace', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));

    const result = await unsoftLockPeriod(PERIOD_KEY, '   \t\n  ');

    expect(result).toEqual({ error: 'Reason is required to unsoft-lock a period.' });
    expect(mockGetPeriodRow).not.toHaveBeenCalled();
  });

  it('returns error when period is not found', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(null);

    const result = await unsoftLockPeriod(PERIOD_KEY, 'caught a bad entry');

    expect(result).toEqual({ error: `Period ${PERIOD_KEY} not found.` });
  });

  it('returns error when period is open (nothing to reopen)', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodOpen);

    const result = await unsoftLockPeriod(PERIOD_KEY, 'caught a bad entry');

    expect('error' in result && result.error.includes('open')).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('returns error when period is hard_locked (terminal state)', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodHardLocked);

    const result = await unsoftLockPeriod(PERIOD_KEY, 'caught a bad entry');

    expect('error' in result && result.error.includes('hard_locked')).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('reopens the period, clears locked_at/by, and fires regulatory audit event with reason', async () => {
    const { client, captures } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);

    const reason = 'caught a bad I.4 entry — needs reversal before close';
    const result = await unsoftLockPeriod(PERIOD_KEY, reason);

    expect(result).toEqual({ success: true });
    expect(captures).toHaveLength(1);
    expect(captures[0].table).toBe('periods');
    expect(captures[0].payload).toEqual({
      status: 'open',
      locked_at: null,
      locked_by: null,
    });

    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.anything(), {
      actorType: 'user',
      actorId: STAFF_USER_ID,
      action: 'accounting.period_status_changed',
      resourceType: 'period',
      resourceId: PERIOD_KEY,
      metadata: {
        period_type: 'month',
        from_status: 'soft_locked',
        to_status: 'open',
        transition_reason: reason,
      },
      retentionClass: 'regulatory',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting/period-close');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/staff/accounting');
  });

  it('trims the reason before persisting it to the audit metadata', async () => {
    const { client } = buildMockServiceClient();
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);

    await unsoftLockPeriod(PERIOD_KEY, '   needed to fix I.4   ');

    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    const call = mockLogAuditEvent.mock.calls[0][1] as {
      metadata: { transition_reason: string };
    };
    expect(call.metadata.transition_reason).toBe('needed to fix I.4');
  });

  it('returns error and skips audit when the periods update fails', async () => {
    const { client } = buildMockServiceClient({ message: 'connection lost' });
    mockRequireServerAuth.mockResolvedValue(STAFF_AUTH(client));
    mockGetPeriodRow.mockResolvedValue(periodSoftLocked);

    const result = await unsoftLockPeriod(PERIOD_KEY, 'caught a bad entry');

    expect('error' in result).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
