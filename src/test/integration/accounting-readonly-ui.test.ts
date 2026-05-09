/**
 * Tie-out integration test for the read-only accounting UI (PR #4 Task 14).
 *
 * Locks the regression baseline against the Phase 0 audit snapshot. The query
 * helpers in `src/lib/accounting/queries.ts` are the read counterpart to the
 * posting engine (the only writer). After replaying the 23 Phase 0 backfill
 * entries through the engine, the trial balance + ledger + integrity views
 * MUST match the closing-state constants in
 * `src/lib/accounting/phase0-reconciliation-constants.ts` exactly. Any drift
 * here means either the data table, posting engine, or query layer has
 * regressed against the audit-confirmed historical state.
 *
 * Setup pattern: idempotency-driven, mirroring `phase0-backfill.test.ts`.
 * `runBackfill` is safe to re-run because every entry has a deterministic
 * `source_doc_id` and the `(source_doc_type, source_doc_id, type_id)` UNIQUE
 * idempotency index makes the engine return `idempotent_skip` for entries
 * already present. CI starts from an empty DB and gets `created` for all 23;
 * a developer running locally with prior state gets a mix of `created` +
 * `idempotent_skip`. Either way, the closing GL state matches the snapshot.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  getAccountLedger,
  getJournalEntry,
  getTrialBalance,
  getWalletIntegrity
} from '@/lib/accounting/queries';
import {
  BANK_WALK_CHECKPOINTS,
  CLOSING_TRIAL_BALANCE_2026_03_31
} from '@/lib/accounting/phase0-reconciliation-constants';

import { runBackfill } from '../../../scripts/phase0-backfill';
import { SOURCE_DOC_TYPE } from '../../../scripts/phase0-backfill-data';

import {
  cleanupSignedInClient,
  createSignedInClient,
  type SignedInClient
} from '../helpers/auth-personas';
import { dbExecOrThrow } from '../helpers/db-exec';
import { createTestServiceClient } from '../helpers/supabase';

// =============================================================================
// Setup: stand up staff persona, replay Phase 0 backfill, share staff client
// across all 6 tests.
// =============================================================================

let staffPersona: SignedInClient;

beforeAll(async () => {
  // Force PostgREST to reload schema cache and probe with UPSERT until it warms.
  // Mirrors the `phase0-backfill.test.ts` pattern — local Supabase often holds
  // a stale cache after migrations apply, especially for UPSERT routes.
  dbExecOrThrow("NOTIFY pgrst, 'reload schema'");

  const serviceClient = createTestServiceClient();

  const PROBE_ID = '00000000-0000-4000-8000-deadbeefbabe';
  const settleStart = Date.now();
  const SETTLE_TIMEOUT_MS = 30_000;
  let cacheWarm = false;
  while (Date.now() - settleStart < SETTLE_TIMEOUT_MS) {
    const upsert = await serviceClient
      .from('counterparties')
      .upsert(
        { id: PROBE_ID, type: 'vendor', full_name: 'cache_warmup_probe' },
        { onConflict: 'id' }
      );
    if (!upsert.error) {
      await serviceClient.from('counterparties').delete().eq('id', PROBE_ID);
      cacheWarm = true;
      break;
    }
    dbExecOrThrow("NOTIFY pgrst, 'reload schema'");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!cacheWarm) {
    throw new Error(
      'PostgREST schema cache did not refresh within 30s. ' +
      'May need to restart the local Supabase stack: `supabase stop && supabase start`.'
    );
  }

  // Replay Phase 0 backfill via the named export. Idempotent: re-runs hit
  // `idempotent_skip` and the closing GL state remains the audit snapshot.
  // Use the service client for the backfill itself (the engine writes
  // through the service-role bypass).
  const result = await runBackfill(serviceClient);
  if (result.failed > 0) {
    const failed = result.entries.filter((e) => e.status === 'failed');
    throw new Error(
      `Phase 0 backfill failed during beforeAll: ${JSON.stringify(failed)}`
    );
  }

  // Sign in a staff persona for the read tests. RLS on journal_entries /
  // journal_lines requires authenticated + is_staff=true; this client is the
  // exact shape the staff UI uses.
  staffPersona = await createSignedInClient({
    isStaff: true,
    emailPrefix: 'accounting-readonly-ui-test'
  });
}, 90_000);

afterAll(async () => {
  if (staffPersona) {
    await cleanupSignedInClient(staffPersona);
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('accounting read-only UI tie-out', () => {
  it('getTrialBalance(asOf=2026-03-31, includeBackfill=true) matches the audit snapshot exactly', async () => {
    const tb = await getTrialBalance(staffPersona.client, '2026-03-31', {
      includeBackfill: true
    });

    expect(tb.as_of).toBe('2026-03-31');

    // Index by account_code so the failure message names the offender.
    const observedByAccount = new Map(tb.rows.map((r) => [r.account_code, r]));

    for (const expected of CLOSING_TRIAL_BALANCE_2026_03_31) {
      const observed = observedByAccount.get(expected.account);
      if (!observed) {
        throw new Error(
          `expected ${expected.account} net_debit=${expected.expected_cents}, got missing (no journal lines)`
        );
      }
      if (observed.net_debit_cents !== expected.expected_cents) {
        throw new Error(
          `expected ${expected.account} net_debit=${expected.expected_cents}, got ${observed.net_debit_cents}`
        );
      }
    }

    // Every row in the trial balance must be one of the snapshot accounts.
    // A row appearing here that isn't in the snapshot means the GL has drifted.
    const expectedCodes = new Set(
      CLOSING_TRIAL_BALANCE_2026_03_31.map((r) => r.account)
    );
    for (const row of tb.rows) {
      if (!expectedCodes.has(row.account_code)) {
        throw new Error(
          `unexpected ${row.account_code} net_debit=${row.net_debit_cents} appeared in trial balance ` +
          `but is not in CLOSING_TRIAL_BALANCE_2026_03_31`
        );
      }
    }

    expect(tb.rows).toHaveLength(CLOSING_TRIAL_BALANCE_2026_03_31.length);
  });

  it('getTrialBalance is balanced (Σ debits = Σ credits at GL level; Σ net_debit = 0; |Σ positive net| = 224234)', async () => {
    const tb = await getTrialBalance(staffPersona.client, '2026-03-31', {
      includeBackfill: true
    });

    // GL invariant: gross debit cents equals gross credit cents on every line.
    expect(tb.is_balanced).toBe(true);
    expect(tb.total_debit_cents).toBe(tb.total_credit_cents);

    // Snapshot property: Σ net_debit across all rows is 0 (assets + losses
    // = liabilities + equity + revenue - expenses, in net-debit signing).
    const sumNetDebit = tb.rows.reduce((acc, r) => acc + r.net_debit_cents, 0);
    expect(sumNetDebit).toBe(0);

    // |sum of positive net debits| = 224234 cents = €2242.34 — the audit
    // figure cited in CLOSING_TRIAL_BALANCE_2026_03_31. By the previous
    // identity, |sum of negative net debits| matches.
    const positiveNet = tb.rows
      .filter((r) => r.net_debit_cents > 0)
      .reduce((acc, r) => acc + r.net_debit_cents, 0);
    const negativeNet = tb.rows
      .filter((r) => r.net_debit_cents < 0)
      .reduce((acc, r) => acc + r.net_debit_cents, 0);
    expect(positiveNet).toBe(224234);
    expect(negativeNet).toBe(-224234);
  });

  it('getTrialBalance(includeBackfill=false) returns empty rows (no non-backfill entries in Phase 0)', async () => {
    const tb = await getTrialBalance(staffPersona.client, '2026-03-31', {
      includeBackfill: false
    });

    expect(tb.rows).toEqual([]);
    expect(tb.total_debit_cents).toBe(0);
    expect(tb.total_credit_cents).toBe(0);
    expect(tb.is_balanced).toBe(true);
  });

  it('getAccountLedger(2610, 2025-07-01..2026-03-31) closing balance = 44490 cents', async () => {
    const ledger = await getAccountLedger(
      staffPersona.client,
      '2610',
      { from: '2025-07-01', to: '2026-03-31' },
      { includeBackfill: true }
    );

    expect(ledger.account.code).toBe('2610');
    expect(ledger.range).toEqual({ from: '2025-07-01', to: '2026-03-31' });

    const expected = BANK_WALK_CHECKPOINTS[8].expected_cents;
    if (ledger.closing_balance_cents !== expected) {
      throw new Error(
        `expected 2610 closing_balance=${expected}, got ${ledger.closing_balance_cents}`
      );
    }
    expect(ledger.closing_balance_cents).toBe(44490);
    expect(ledger.lines.length).toBeGreaterThan(0);
  });

  it('getJournalEntry(<phase0_entry_1>) returns balanced lines with posting_context.backfill = true', async () => {
    // Resolve Entry 1's id via service client (RLS is staff-only on
    // journal_entries; service role bypasses, deterministic source_doc_id).
    const serviceClient = createTestServiceClient();
    const { data: entryRow, error: lookupErr } = await serviceClient
      .from('journal_entries')
      .select('id')
      .eq('source_doc_type', SOURCE_DOC_TYPE)
      .eq('source_doc_id', 'phase0_entry_1')
      .single();

    expect(lookupErr).toBeNull();
    expect(entryRow).not.toBeNull();
    const entryId = entryRow!.id as string;

    const detail = await getJournalEntry(staffPersona.client, entryId);

    if (!detail.is_balanced) {
      throw new Error(
        `expected phase0_entry_1 (${entryId}) is_balanced=true, got ` +
        `total_debit=${detail.total_debit_cents}, total_credit=${detail.total_credit_cents}`
      );
    }
    expect(detail.is_balanced).toBe(true);
    expect(detail.total_debit_cents).toBe(detail.total_credit_cents);
    expect(detail.lines.length).toBeGreaterThanOrEqual(2);

    const ctx = detail.entry.posting_context as Record<string, unknown> | null;
    expect(ctx).not.toBeNull();
    expect(ctx!.backfill).toBe(true);
    expect(ctx!.phase0_entry_number).toBe('1');

    expect(detail.entry.source_doc_type).toBe(SOURCE_DOC_TYPE);
    expect(detail.entry.source_doc_id).toBe('phase0_entry_1');
  });

  it('Phase 0 contributes zero 5351 activity; getWalletIntegrity invariant (delta = gl_sum - wallet_sum) holds', async () => {
    // Phase 0's tie-out claim on the wallet integrity check is narrow: the
    // backfill itself touches no live wallet flows, so backfill-only 5351
    // activity must be exactly zero. We verify that directly from the GL
    // (filtered to backfill entries) so the assertion stays meaningful even
    // when other integration tests have left their own test_artifact-flagged
    // 5351 entries in the local DB. CI starts clean and would also pass the
    // stricter "everything is zero" form, but the backfill-scoped assertion
    // is the one that's actually about Phase 0.
    const serviceClient = createTestServiceClient();
    const { data: backfillRows, error: blErr } = await serviceClient
      .from('journal_lines')
      .select(
        'debit_cents, credit_cents, journal_entries!inner(posting_context)'
      )
      .eq('account_code', '5351');

    expect(blErr).toBeNull();
    type Joined = {
      debit_cents: number;
      credit_cents: number;
      journal_entries: { posting_context: Record<string, unknown> | null } | null;
    };
    const backfillOnly = ((backfillRows ?? []) as unknown as Joined[]).filter(
      (r) => r.journal_entries?.posting_context?.backfill === true
    );
    const backfillNetCredit = backfillOnly.reduce(
      (acc, r) => acc + r.credit_cents - r.debit_cents,
      0
    );
    expect(backfillNetCredit).toBe(0);
    expect(backfillOnly).toHaveLength(0);

    // Function contract invariant — delta_cents always equals
    // gl_5351_sum_cents - wallet_table_sum_cents, irrespective of which
    // entries populated those sums.
    const integrity = await getWalletIntegrity(staffPersona.client);
    expect(integrity.delta_cents).toBe(
      integrity.gl_5351_sum_cents - integrity.wallet_table_sum_cents
    );
    expect(integrity.is_reconciled).toBe(integrity.delta_cents === 0);
  });
});
