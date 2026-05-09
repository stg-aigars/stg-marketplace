/**
 * Period-close integration tests (PR #4, Task 15).
 *
 * Three concerns wired against a real local Supabase:
 *
 *   1. Migration 098's generalized `enforce_period_status` trigger across all
 *      four period_type cases (month, quarter, year, unknown) and all three
 *      lock states (open, soft_locked, hard_locked) — proving the
 *      hardcoded-period_type='month' regression introduced by migration 094 is
 *      gone.
 *
 *   2. Migration 098's `periods_period_key_unique` constraint — a duplicate
 *      period_key INSERT under any period_type must reject with 23505 and the
 *      named constraint, since the trigger's single-row lookup relies on the
 *      disjoint-format invariant.
 *
 *   3. The three period-state server actions (`softLockPeriod`,
 *      `hardLockPeriod`, `unsoftLockPeriod`): real DB UPDATE on periods, real
 *      audit-log inserts, real audit-event metadata shape.
 *
 * Auth border-mock pattern: server actions go through `requireServerAuth`
 * which reads `cookies()`; that's a Next.js runtime concern we can't satisfy
 * outside Next, so we mock it to inject the real test service-client + a
 * stable staff user id. `revalidatePath` is also mocked (no Next request
 * context). Everything below the auth border (period reads, period UPDATEs,
 * audit_log writes) hits the real DB. The unit tests in
 * `period-actions.test.ts` already exhaustively cover the action logic with
 * full supabase mocks; this file's value is verifying the real DB contract
 * — that the UPDATE actually changes a row, that the audit row actually
 * lands, that the metadata JSON shape matches the canonical-register entry.
 *
 * Test isolation:
 *   - Trigger tests use periods OUTSIDE Phase 0 (2027-02 / 2027-03 / 2027-04 /
 *     2027-Q2 / 2027). Phase 0 periods (2025-07 → 2026-03) carry historical
 *     entries that other tests / future runs depend on.
 *   - `afterEach` resets every period mutated in the test back to 'open' via
 *     a service-role UPDATE. This bypasses the application-level state-
 *     machine guard (which forbids un-hard-locking) — it's test-only
 *     infrastructure that mirrors what an operator would do via psql to
 *     recover from a corrupt test run.
 *   - Trigger tests that INSERT journal entries tag them
 *     `posting_context.test_artifact = true` per the project convention; the
 *     entries persist permanently because the immutability trigger blocks
 *     DELETE. PR #4 trial-balance / P&L views filter them out.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks for the auth/revalidate border. vi.mock factories run before
// imports, so factory-referenced state must be hoisted via vi.hoisted().
// ---------------------------------------------------------------------------

const {
  mockRequireServerAuth,
  mockRevalidatePath,
  mockGetPeriodCloseChecklist
} = vi.hoisted(() => ({
  mockRequireServerAuth: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockGetPeriodCloseChecklist: vi.fn()
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireServerAuth: mockRequireServerAuth
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath
}));

// We mock the checklist module so the soft-lock action can be driven into
// both its happy and failing branches without depending on the global state
// of the trial balance / wallet integrity / clearing accounts (which other
// integration tests legitimately mutate via test_artifact entries). The
// checklist module's own logic is covered by `checklist.test.ts`.
vi.mock('@/lib/accounting/checklist', () => ({
  getPeriodCloseChecklist: mockGetPeriodCloseChecklist
}));

import { hardLockPeriod, softLockPeriod, unsoftLockPeriod } from '@/lib/accounting/period-actions';

import { dbExec, dbExecOrThrow } from '../helpers/db-exec';
import { createTestServiceClient } from '../helpers/supabase';

// ---------------------------------------------------------------------------
// Test fixtures and shared state
// ---------------------------------------------------------------------------

const supabase = createTestServiceClient();

// Real auth.users row created in beforeAll so audit_log.actor_id (FK →
// auth.users) resolves cleanly; the user id is reused across all 24 tests
// and cleaned up in afterAll. Same pattern as
// accounting-readonly-ui.test.ts.
let staffUserId: string;

const TEST_PERIODS = {
  // Trigger tests — outside Phase 0, plus one quarterly + one annual.
  // 2027-02..2027-04 monthly, 2027-Q2 quarterly, 2027 annual.
  TRIGGER_MONTH_OPEN: '2027-02',
  TRIGGER_MONTH_SOFT: '2027-03',
  TRIGGER_MONTH_HARD: '2027-04',
  TRIGGER_QUARTER: '2027-Q2',
  TRIGGER_YEAR: '2027',
  // Action tests — distinct monthly periods so each action gets its own row
  // and per-test `afterEach` reset is unambiguous.
  ACTION_SOFTLOCK_PASS: '2027-05',
  ACTION_SOFTLOCK_FAIL: '2027-06',
  ACTION_HARDLOCK_PASS: '2027-07',
  ACTION_HARDLOCK_REJECT_ENTRIES: '2027-08',
  ACTION_UNSOFTLOCK_PASS: '2027-09'
} as const;

// All periods this test file may touch; afterEach restores each to 'open'
// with locked_at/locked_by cleared. Idempotent — touching an already-open
// period is a no-op.
const ALL_TOUCHED_PERIODS: ReadonlyArray<{ key: string; type: 'month' | 'quarter' | 'year' }> = [
  { key: TEST_PERIODS.TRIGGER_MONTH_OPEN, type: 'month' },
  { key: TEST_PERIODS.TRIGGER_MONTH_SOFT, type: 'month' },
  { key: TEST_PERIODS.TRIGGER_MONTH_HARD, type: 'month' },
  { key: TEST_PERIODS.TRIGGER_QUARTER, type: 'quarter' },
  { key: TEST_PERIODS.TRIGGER_YEAR, type: 'year' },
  { key: TEST_PERIODS.ACTION_SOFTLOCK_PASS, type: 'month' },
  { key: TEST_PERIODS.ACTION_SOFTLOCK_FAIL, type: 'month' },
  { key: TEST_PERIODS.ACTION_HARDLOCK_PASS, type: 'month' },
  { key: TEST_PERIODS.ACTION_HARDLOCK_REJECT_ENTRIES, type: 'month' },
  { key: TEST_PERIODS.ACTION_UNSOFTLOCK_PASS, type: 'month' }
];

/**
 * Reset the listed periods to status='open', clearing locked_at and
 * locked_by. Service-role direct UPDATE bypasses the application-level
 * state-machine guard (which forbids un-hard-locking) — this is test
 * infrastructure that mirrors operator psql intervention. The periods table
 * itself has no immutability trigger, so the UPDATE lands.
 */
function resetPeriodsToOpen(): void {
  for (const { key, type } of ALL_TOUCHED_PERIODS) {
    dbExecOrThrow(
      `UPDATE public.periods SET status='open', locked_at=NULL, locked_by=NULL ` +
        `WHERE period_key='${key}' AND period_type='${type}';`
    );
  }
}

/** Compose the auth payload returned by the mocked requireServerAuth. */
function staffAuthPayload(): {
  user: { id: string };
  profile: { is_staff: true };
  isStaff: true;
  serviceClient: ReturnType<typeof createTestServiceClient>;
} {
  return {
    user: { id: staffUserId },
    profile: { is_staff: true },
    isStaff: true,
    serviceClient: supabase
  };
}

/**
 * Poll for an `accounting.period_status_changed` audit row matching the
 * given resource_id and posted by this test's staff user since `before`.
 *
 * `logAuditEvent` is fire-and-forget — the action does `void logAuditEvent(...)`
 * and returns before awaiting the insert. Without polling, a single SELECT
 * would race the in-flight insert and intermittently return zero rows.
 * Poll every 50ms for up to 2s; once any row appears, return the latest.
 */
async function waitForPeriodStatusAuditRow(
  resourceId: string,
  since: string,
  timeoutMs = 2000
): Promise<{
  actor_type: string | null;
  actor_id: string | null;
  resource_type: string | null;
  metadata: Record<string, unknown>;
  retention_class: string | null;
}> {
  const deadline = Date.now() + timeoutMs;
  let lastError: { message: string } | null = null;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('audit_log')
      .select('actor_type, actor_id, resource_type, metadata, retention_class, created_at')
      .eq('action', 'accounting.period_status_changed')
      .eq('actor_id', staffUserId)
      .eq('resource_id', resourceId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (error) {
      lastError = error;
    } else if ((data ?? []).length > 0) {
      const rows = data!;
      return rows[rows.length - 1] as {
        actor_type: string | null;
        actor_id: string | null;
        resource_type: string | null;
        metadata: Record<string, unknown>;
        retention_class: string | null;
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `waitForPeriodStatusAuditRow: timed out after ${timeoutMs}ms for resource_id=${resourceId}` +
      (lastError ? ` (last error: ${lastError.message})` : '')
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Force PostgREST schema cache reload — same idempotency-warm-up dance as
  // accounting-readonly-ui.test.ts.
  dbExecOrThrow("NOTIFY pgrst, 'reload schema'");

  const ts = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `period-close-test-${ts}-${suffix}@stg-test.local`;
  const password = `TestPassword${ts}!`;

  // Real auth.users row so the audit_log.actor_id FK to auth.users resolves.
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createErr || !created?.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? 'unknown'}`);
  }
  staffUserId = created.user.id;

  // Profile flip — service-role UPDATE bypasses the F5 self-promotion guard
  // by using session_replication_role='replica'. Same pattern as
  // createSignedInClient in auth-personas.ts.
  dbExecOrThrow(
    `SET session_replication_role='replica'; ` +
      `UPDATE public.user_profiles SET is_staff=true WHERE id='${staffUserId}'; ` +
      `SET session_replication_role='origin';`
  );

  // Make sure all touched periods start clean.
  resetPeriodsToOpen();
}, 30_000);

afterAll(async () => {
  // Reset every period this file touched. Repeats afterEach but defensive
  // against a test that throws inside afterEach itself.
  resetPeriodsToOpen();

  if (staffUserId) {
    const { error } = await supabase.auth.admin.deleteUser(staffUserId);
    if (error) {
      // Don't throw in afterAll — surface to console so vitest still reports
      // pass/fail of the actual tests rather than crashing teardown.
      console.error(`[period-close.test] cleanup deleteUser failed: ${error.message}`);
    }
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  resetPeriodsToOpen();
});

// ---------------------------------------------------------------------------
// Migration 098: enforce_period_status trigger generalization
// ---------------------------------------------------------------------------

describe('migration 098: enforce_period_status trigger', () => {
  // Helper: produce a unique journal_entries-INSERT SQL string for a given
  // period_key, with optional period_close_adjustment flag. The entry itself
  // is intentionally line-less — the period-status trigger fires BEFORE
  // INSERT on journal_entries and is what we want to exercise; the deferred
  // balanced-entry trigger fires at COMMIT on journal_lines and would hide
  // the period-status reject under a different exception. Using a single
  // INSERT (no COMMIT roundtrip) and asserting the trigger's BEFORE INSERT
  // exception is the cleanest path.
  function buildEntryInsertSql(
    periodKey: string,
    options: { periodCloseAdjustment?: boolean; postingContext?: Record<string, unknown> } = {}
  ): string {
    const { periodCloseAdjustment = false, postingContext } = options;
    const id = '11111111-1111-4111-8111-' + Math.random().toString(16).slice(2, 14).padStart(12, '0');
    const sourceDocId = `period_close_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Always tag trigger-test entries with test_artifact=true so future
    // trial-balance / P&L views (which filter on
    // posting_context->>'test_artifact' = 'true' per CLAUDE.md convention)
    // exclude these permanent rows. Success-case INSERTs commit and persist
    // across runs because the journal_entries immutability trigger blocks
    // DELETE — the only way to keep them out of reports is the tag.
    const effectiveContext = { test_artifact: true, ...(postingContext ?? {}) };
    const contextLiteral = JSON.stringify(effectiveContext).replace(/'/g, "''");
    return (
      `INSERT INTO public.journal_entries ` +
      `(id, posting_date, accounting_period, tax_period, entry_type, type_id, ` +
      `source_doc_type, source_doc_id, narrative, created_by, period_close_adjustment, posting_context) ` +
      `VALUES ('${id}', '2027-04-15', '${periodKey}', '${periodKey}', 'manual', 'TEST.MIG098', ` +
      `'period_close_test', '${sourceDocId}', 'period-close trigger test', 'test', ` +
      `${periodCloseAdjustment ? 'true' : 'false'}, '${contextLiteral}'::jsonb);`
    );
  }

  describe('monthly periods', () => {
    it('inserts pass on open monthly period', () => {
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_MONTH_OPEN);
      const result = dbExec(sql);
      expect(result.code).toBe(0);
    });

    it('rejects on soft-locked monthly without period_close_adjustment (23514, soft_locked message)', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='soft_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_MONTH_SOFT}' AND period_type='month';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_MONTH_SOFT, { periodCloseAdjustment: false });
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/soft_locked/);
      expect(result.stderr + result.stdout).toMatch(/period_close_adjustment/);
    });

    it('passes on soft-locked monthly with period_close_adjustment=true', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='soft_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_MONTH_SOFT}' AND period_type='month';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_MONTH_SOFT, { periodCloseAdjustment: true });
      const result = dbExec(sql);
      expect(result.code).toBe(0);
    });

    it('rejects on hard-locked monthly (23514, hard_locked message)', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='hard_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_MONTH_HARD}' AND period_type='month';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_MONTH_HARD);
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/hard_locked/);
    });
  });

  describe('quarterly periods', () => {
    it('inserts pass on open quarterly period (2027-Q2)', () => {
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_QUARTER);
      const result = dbExec(sql);
      // Migration 098's trigger looks up across period_types — the disjoint
      // YYYY-QN format means the single-row lookup resolves to the quarterly
      // row. Pre-098 this would have rejected as Unknown accounting_period
      // because the lookup hardcoded period_type='month'.
      expect(result.code).toBe(0);
    });

    it('rejects on soft-locked quarterly without period_close_adjustment', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='soft_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_QUARTER}' AND period_type='quarter';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_QUARTER, { periodCloseAdjustment: false });
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/soft_locked/);
    });

    it('passes on soft-locked quarterly with period_close_adjustment=true', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='soft_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_QUARTER}' AND period_type='quarter';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_QUARTER, { periodCloseAdjustment: true });
      const result = dbExec(sql);
      expect(result.code).toBe(0);
    });

    it('rejects on hard-locked quarterly', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='hard_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_QUARTER}' AND period_type='quarter';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_QUARTER);
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/hard_locked/);
    });
  });

  describe('annual periods', () => {
    it('inserts pass on open annual period (2027)', () => {
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_YEAR);
      const result = dbExec(sql);
      expect(result.code).toBe(0);
    });

    it('rejects on soft-locked annual without period_close_adjustment', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='soft_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_YEAR}' AND period_type='year';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_YEAR, { periodCloseAdjustment: false });
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/soft_locked/);
    });

    it('passes on soft-locked annual with period_close_adjustment=true', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='soft_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_YEAR}' AND period_type='year';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_YEAR, { periodCloseAdjustment: true });
      const result = dbExec(sql);
      expect(result.code).toBe(0);
    });

    it('rejects on hard-locked annual', () => {
      dbExecOrThrow(
        `UPDATE public.periods SET status='hard_locked' WHERE period_key='${TEST_PERIODS.TRIGGER_YEAR}' AND period_type='year';`
      );
      const sql = buildEntryInsertSql(TEST_PERIODS.TRIGGER_YEAR);
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/hard_locked/);
    });
  });

  describe('unknown periods', () => {
    it('rejects with P0001 / POSTING:UNKNOWN_PERIOD prefix', () => {
      // 2099-13 is not a valid month and is not seeded. Migration 098 changed
      // the unknown-period error from fake 23503 to P0001 with the
      // POSTING:UNKNOWN_PERIOD prefix matching migration 097's RPC convention.
      const sql = buildEntryInsertSql('2099-13');
      const result = dbExec(sql);
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/POSTING:UNKNOWN_PERIOD/);
      expect(result.stderr + result.stdout).toMatch(/2099-13/);
    });
  });
});

// ---------------------------------------------------------------------------
// Migration 098: UNIQUE(period_key) constraint
// ---------------------------------------------------------------------------

describe('migration 098: UNIQUE(period_key) constraint', () => {
  it('rejects duplicate period_key with different period_type (23505, periods_period_key_unique)', () => {
    // 2027-Q2 already exists as period_type='quarter'. Attempt to insert
    // another row with the same period_key under a different period_type.
    // The disjoint format invariant says this should never happen in seeds —
    // the constraint catches the drift at insert time.
    const sql =
      `INSERT INTO public.periods (period_key, period_type, status, created_at) ` +
      `VALUES ('2027-Q2', 'month', 'open', NOW());`;
    const result = dbExec(sql);
    expect(result.code).not.toBe(0);
    const combined = result.stderr + result.stdout;
    // 23505 = unique_violation. Constraint name from migration 098.
    expect(combined).toMatch(/23505|duplicate key|unique/);
    expect(combined).toMatch(/periods_period_key_unique/);
  });
});

// ---------------------------------------------------------------------------
// softLockPeriod server action — real DB UPDATE + audit fan-out
// ---------------------------------------------------------------------------

describe('softLockPeriod server action', () => {
  it('transitions open → soft_locked when checklist passes; period row reflects new status + locked_by + locked_at', async () => {
    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    mockGetPeriodCloseChecklist.mockResolvedValue({
      period_key: TEST_PERIODS.ACTION_SOFTLOCK_PASS,
      period_type: 'month',
      period_status: 'open',
      items: [{ id: 1, label: 'Σ debits = Σ credits', status: 'pass', detail: 'all good' }],
      all_pass: true,
      can_soft_lock: true,
      can_hard_lock: false,
      can_unsoft_lock: false
    });

    const result = await softLockPeriod(TEST_PERIODS.ACTION_SOFTLOCK_PASS);
    expect(result).toEqual({ success: true });

    const { data: row, error } = await supabase
      .from('periods')
      .select('status, locked_at, locked_by')
      .eq('period_key', TEST_PERIODS.ACTION_SOFTLOCK_PASS)
      .eq('period_type', 'month')
      .single();
    expect(error).toBeNull();
    expect(row).not.toBeNull();
    expect(row!.status).toBe('soft_locked');
    expect(row!.locked_by).toBe(staffUserId);
    expect(typeof row!.locked_at).toBe('string');
    expect(row!.locked_at).not.toBeNull();
  });

  it('rejects when checklist has failing items (period stays open, no audit row)', async () => {
    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    mockGetPeriodCloseChecklist.mockResolvedValue({
      period_key: TEST_PERIODS.ACTION_SOFTLOCK_FAIL,
      period_type: 'month',
      period_status: 'open',
      items: [
        {
          id: 1,
          label: 'Σ debits = Σ credits',
          status: 'fail',
          detail: 'Imbalance: debits €100.00 vs credits €99.00 (delta €1.00).'
        }
      ],
      all_pass: false,
      can_soft_lock: false,
      can_hard_lock: false,
      can_unsoft_lock: false
    });

    const result = await softLockPeriod(TEST_PERIODS.ACTION_SOFTLOCK_FAIL);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Cannot soft-lock');
      expect(result.error).toContain('Σ debits = Σ credits');
    }

    // Period unchanged.
    const { data: row } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', TEST_PERIODS.ACTION_SOFTLOCK_FAIL)
      .eq('period_type', 'month')
      .single();
    expect(row!.status).toBe('open');
  });

  it('fires accounting.period_status_changed audit event with regulatory retention and correct metadata shape', async () => {
    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    mockGetPeriodCloseChecklist.mockResolvedValue({
      period_key: TEST_PERIODS.ACTION_SOFTLOCK_PASS,
      period_type: 'month',
      period_status: 'open',
      items: [],
      all_pass: true,
      can_soft_lock: true,
      can_hard_lock: false,
      can_unsoft_lock: false
    });

    // Subtract a defensive 1s window to absorb Node↔Postgres clock skew under
    // CI load — the audit polling's `created_at >= since` filter would
    // otherwise miss rows when Node is fractionally ahead. The polling helper
    // already scopes by actor_id + resource_id, so widening this window does
    // not admit cross-test audit rows.
    const before = new Date(Date.now() - 1000).toISOString();
    const result = await softLockPeriod(TEST_PERIODS.ACTION_SOFTLOCK_PASS);
    expect(result).toEqual({ success: true });

    const audit = await waitForPeriodStatusAuditRow(TEST_PERIODS.ACTION_SOFTLOCK_PASS, before);
    expect(audit.actor_type).toBe('user');
    expect(audit.actor_id).toBe(staffUserId);
    expect(audit.resource_type).toBe('period');
    expect(audit.retention_class).toBe('regulatory');
    expect(audit.metadata).toEqual({
      period_type: 'month',
      from_status: 'open',
      to_status: 'soft_locked'
    });
  });
});

// ---------------------------------------------------------------------------
// hardLockPeriod server action — real DB UPDATE + entries-since gating
// ---------------------------------------------------------------------------

describe('hardLockPeriod server action', () => {
  it('transitions soft_locked → hard_locked when no entries posted since locked_at', async () => {
    // Pre-soft-lock the period via direct UPDATE so we don't depend on the
    // soft-lock action / checklist module for setup.
    const lockedAt = '2027-08-01T00:00:00Z';
    dbExecOrThrow(
      `UPDATE public.periods SET status='soft_locked', locked_at='${lockedAt}', locked_by='${staffUserId}' ` +
        `WHERE period_key='${TEST_PERIODS.ACTION_HARDLOCK_PASS}' AND period_type='month';`
    );

    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    const result = await hardLockPeriod(TEST_PERIODS.ACTION_HARDLOCK_PASS);
    expect(result).toEqual({ success: true });

    const { data: row } = await supabase
      .from('periods')
      .select('status, locked_at, locked_by')
      .eq('period_key', TEST_PERIODS.ACTION_HARDLOCK_PASS)
      .eq('period_type', 'month')
      .single();
    expect(row!.status).toBe('hard_locked');
    // Action does not clear locked_at / locked_by — the lock-chain origin
    // is preserved on the soft → hard transition.
    expect(row!.locked_at).not.toBeNull();
    expect(row!.locked_by).toBe(staffUserId);
  });

  it('rejects when entries were posted since soft-lock; period remains soft_locked', async () => {
    // Soft-lock with locked_at well in the past so the entry we insert next
    // counts as "after soft-lock".
    const lockedAt = '2020-01-01T00:00:00Z';
    dbExecOrThrow(
      `UPDATE public.periods SET status='soft_locked', locked_at='${lockedAt}', locked_by='${staffUserId}' ` +
        `WHERE period_key='${TEST_PERIODS.ACTION_HARDLOCK_REJECT_ENTRIES}' AND period_type='month';`
    );

    // Post a journal entry to this period with period_close_adjustment=true
    // so the trigger lets it through (period is soft_locked). The action
    // should then refuse to hard-lock because getEntriesPostedSince finds it.
    const entryId = '22222222-2222-4222-8222-' + Math.random().toString(16).slice(2, 14).padStart(12, '0');
    const sourceDocId = `period_close_test_hardreject_${Date.now()}`;
    dbExecOrThrow(
      `INSERT INTO public.journal_entries ` +
        `(id, posting_date, accounting_period, tax_period, entry_type, type_id, ` +
        `source_doc_type, source_doc_id, narrative, created_by, period_close_adjustment, posting_context) ` +
        `VALUES ('${entryId}', '2027-08-15', '${TEST_PERIODS.ACTION_HARDLOCK_REJECT_ENTRIES}', ` +
        `'${TEST_PERIODS.ACTION_HARDLOCK_REJECT_ENTRIES}', 'period_close', 'TEST.HARDLOCK', ` +
        `'period_close_test', '${sourceDocId}', 'after-soft-lock entry', 'test', true, ` +
        `'{"test_artifact": true}'::jsonb);`
    );

    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    const result = await hardLockPeriod(TEST_PERIODS.ACTION_HARDLOCK_REJECT_ENTRIES);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('soft-lock');
      expect(result.error).toMatch(/\d+ entr/);
    }

    // Period unchanged.
    const { data: row } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', TEST_PERIODS.ACTION_HARDLOCK_REJECT_ENTRIES)
      .eq('period_type', 'month')
      .single();
    expect(row!.status).toBe('soft_locked');
  });

  it('rejects when period is open (not yet soft_locked)', async () => {
    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    const result = await hardLockPeriod(TEST_PERIODS.ACTION_HARDLOCK_PASS);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('open');
    }

    const { data: row } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', TEST_PERIODS.ACTION_HARDLOCK_PASS)
      .eq('period_type', 'month')
      .single();
    expect(row!.status).toBe('open');
  });

  it('fires accounting.period_status_changed audit event with from=soft_locked / to=hard_locked', async () => {
    const lockedAt = '2027-08-01T00:00:00Z';
    dbExecOrThrow(
      `UPDATE public.periods SET status='soft_locked', locked_at='${lockedAt}', locked_by='${staffUserId}' ` +
        `WHERE period_key='${TEST_PERIODS.ACTION_HARDLOCK_PASS}' AND period_type='month';`
    );

    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    // Defensive -1000ms window for Node↔Postgres clock skew (see softLock test).
    const before = new Date(Date.now() - 1000).toISOString();
    const result = await hardLockPeriod(TEST_PERIODS.ACTION_HARDLOCK_PASS);
    expect(result).toEqual({ success: true });

    const audit = await waitForPeriodStatusAuditRow(TEST_PERIODS.ACTION_HARDLOCK_PASS, before);
    expect(audit.resource_type).toBe('period');
    expect(audit.retention_class).toBe('regulatory');
    expect(audit.metadata).toEqual({
      period_type: 'month',
      from_status: 'soft_locked',
      to_status: 'hard_locked'
    });
  });
});

// ---------------------------------------------------------------------------
// unsoftLockPeriod server action — real DB UPDATE + audit-event reason
// ---------------------------------------------------------------------------

describe('unsoftLockPeriod server action', () => {
  it('transitions soft_locked → open and clears locked_at / locked_by', async () => {
    const lockedAt = '2027-09-01T00:00:00Z';
    dbExecOrThrow(
      `UPDATE public.periods SET status='soft_locked', locked_at='${lockedAt}', locked_by='${staffUserId}' ` +
        `WHERE period_key='${TEST_PERIODS.ACTION_UNSOFTLOCK_PASS}' AND period_type='month';`
    );

    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    const result = await unsoftLockPeriod(
      TEST_PERIODS.ACTION_UNSOFTLOCK_PASS,
      'caught a bad I.4 entry — needs reversal before close'
    );
    expect(result).toEqual({ success: true });

    const { data: row } = await supabase
      .from('periods')
      .select('status, locked_at, locked_by')
      .eq('period_key', TEST_PERIODS.ACTION_UNSOFTLOCK_PASS)
      .eq('period_type', 'month')
      .single();
    expect(row!.status).toBe('open');
    expect(row!.locked_at).toBeNull();
    expect(row!.locked_by).toBeNull();
  });

  it('rejects empty reason; period remains soft_locked', async () => {
    const lockedAt = '2027-09-01T00:00:00Z';
    dbExecOrThrow(
      `UPDATE public.periods SET status='soft_locked', locked_at='${lockedAt}', locked_by='${staffUserId}' ` +
        `WHERE period_key='${TEST_PERIODS.ACTION_UNSOFTLOCK_PASS}' AND period_type='month';`
    );

    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    const result = await unsoftLockPeriod(TEST_PERIODS.ACTION_UNSOFTLOCK_PASS, '   ');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/Reason is required/);
    }

    const { data: row } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', TEST_PERIODS.ACTION_UNSOFTLOCK_PASS)
      .eq('period_type', 'month')
      .single();
    expect(row!.status).toBe('soft_locked');
  });

  it('fires audit event with transition_reason in metadata (trimmed)', async () => {
    const lockedAt = '2027-09-01T00:00:00Z';
    dbExecOrThrow(
      `UPDATE public.periods SET status='soft_locked', locked_at='${lockedAt}', locked_by='${staffUserId}' ` +
        `WHERE period_key='${TEST_PERIODS.ACTION_UNSOFTLOCK_PASS}' AND period_type='month';`
    );

    mockRequireServerAuth.mockResolvedValue(staffAuthPayload());
    // Defensive -1000ms window for Node↔Postgres clock skew (see softLock test).
    const before = new Date(Date.now() - 1000).toISOString();
    const reason = 'needed to fix I.4 RC pair';
    const result = await unsoftLockPeriod(TEST_PERIODS.ACTION_UNSOFTLOCK_PASS, `   ${reason}   `);
    expect(result).toEqual({ success: true });

    const audit = await waitForPeriodStatusAuditRow(TEST_PERIODS.ACTION_UNSOFTLOCK_PASS, before);
    expect(audit.retention_class).toBe('regulatory');
    expect(audit.metadata).toEqual({
      period_type: 'month',
      from_status: 'soft_locked',
      to_status: 'open',
      transition_reason: reason
    });
  });
});
