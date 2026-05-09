/**
 * Phase 0 backfill — runner script (PR #3, commit 3 of 3).
 *
 * Replays 22 historical journal entries (May 2025 → March 2026) through the
 * posting engine to populate the GL with STG's pre-launch financial state.
 * Source-of-truth: stg-phase-0-backfill-execution-v2.md.
 *
 * Usage:
 *
 *   npx tsx scripts/phase0-backfill.ts                # full run + reconcile
 *   npx tsx scripts/phase0-backfill.ts --dry-run      # log planned entries, no DB writes
 *   npx tsx scripts/phase0-backfill.ts --reconcile-only  # skip emits, just verify
 *
 * Env: reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY. Point the env at production for the production
 * cutover (per the operator runbook in the PR #3 plan file).
 *
 * Idempotency: source_doc_id pattern `phase0_entry_<N>` (with `14a`/`14b`
 * for the C&C MacBook split) plus `phase0_close_<period>` for the year-end
 * P.7 and January P.1 closes. Re-runs hit `idempotent_skip` and reconcile
 * to the same expected state.
 *
 * Failure modes:
 *   - Pre-flight halt: required periods 2025-07 → 2026-03 not seeded as
 *     `open`. Investigate migration 096 application status.
 *   - Counterparty FK violation: SYSTEM_COUNTERPARTY UUIDs drifted from
 *     migration 096's seed. Don't auto-correct — investigate first.
 *   - Mid-script emit failure: stops the loop. Re-running picks up where
 *     it stopped (committed entries idempotent_skip; uncommitted retry).
 *   - Reconciliation halt: data drift. Each emit's source_doc_id is
 *     deterministic; reversal entries (per the operator runbook) are the
 *     correct fix path, NOT manual DELETE.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import { dispatch } from '@/lib/accounting/dispatcher';
import { emit } from '@/lib/accounting/posting-engine';

import { BACKFILL_COUNTERPARTIES, BACKFILL_ENTRIES, type BackfillEntry } from './phase0-backfill-data';
import {
  Phase0ReconciliationError,
  assertMatchesExpectedClosingState
} from './phase0-backfill-reconcile';

// =============================================================================
// Public API — exported for the integration test in src/test/integration/
// =============================================================================

export interface BackfillRunResult {
  created: number;
  idempotent_skip: number;
  failed: number;
  entries: Array<{
    entry_number: string;
    status: 'created' | 'idempotent_skip' | 'failed';
    entry_id?: string;
    error?: string;
  }>;
}

/**
 * Run the full backfill: counterparty UPSERT + 22 emits. Stops on first
 * failure (with the failed entry recorded). Reconciliation is the caller's
 * responsibility (runMain calls it; the integration test calls
 * `assertMatchesExpectedClosingState` directly so it can assert on the
 * exact expected outcome).
 */
export async function runBackfill(supabase: SupabaseClient): Promise<BackfillRunResult> {
  await seedCounterparties(supabase);

  const result: BackfillRunResult = {
    created: 0,
    idempotent_skip: 0,
    failed: 0,
    entries: []
  };

  for (const entry of BACKFILL_ENTRIES) {
    const emitResult = await emit(supabase, entry.event);
    if (emitResult.status === 'created') {
      result.created++;
      result.entries.push({
        entry_number: entry.entry_number,
        status: 'created',
        entry_id: emitResult.entry_id
      });
    } else if (emitResult.status === 'idempotent_skip') {
      result.idempotent_skip++;
      result.entries.push({
        entry_number: entry.entry_number,
        status: 'idempotent_skip',
        entry_id: emitResult.entry_id
      });
    } else {
      result.failed++;
      result.entries.push({
        entry_number: entry.entry_number,
        status: 'failed',
        error: emitResult.error
      });
      // Stop on first failure — the half-state is the diagnostic. Caller
      // re-runs after fixing whatever broke; idempotency picks up.
      return result;
    }
  }

  return result;
}

/**
 * Pre-flight: verify the 11 required periods (2025-05 → 2026-03 is the
 * possible window; we use 2025-07 → 2026-03 since that's where Phase 0
 * actually posts) are seeded as `open` in the periods table. Fail-fast
 * before any emit so the operator gets a clean error rather than a
 * mid-script foreign-key violation.
 */
export async function preflightVerifyPeriods(supabase: SupabaseClient): Promise<void> {
  const REQUIRED = [
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03'
  ];
  const { data, error } = await supabase
    .from('periods')
    .select('period_key, status')
    .in('period_key', REQUIRED)
    .eq('period_type', 'month');
  if (error) {
    throw new Error(`pre-flight: periods query failed: ${error.message}`);
  }
  const observed = new Map((data ?? []).map((r) => [r.period_key as string, r.status as string]));
  for (const period of REQUIRED) {
    const status = observed.get(period);
    if (!status) {
      throw new Error(
        `pre-flight: period ${period} not seeded in public.periods (period_type=month). ` +
        `Run migration 096 (accounting seeds) first.`
      );
    }
    if (status !== 'open') {
      throw new Error(
        `pre-flight: period ${period} has status='${status}', expected 'open'. ` +
        `Soft-locked or hard-locked periods reject backfill emits via the period-status trigger.`
      );
    }
  }
}

/**
 * UPSERT vendor counterparties (VINCIT, C&C, Mollie). Idempotent — re-runs
 * leave the seeds unchanged. VID and STG_INTERNAL system counterparties are
 * already seeded by migration 096 (do not re-seed; they have FK references
 * from prior journal_entries that would orphan if UUID drifted).
 */
export async function seedCounterparties(supabase: SupabaseClient): Promise<void> {
  for (const cp of BACKFILL_COUNTERPARTIES) {
    const { error } = await supabase
      .from('counterparties')
      .upsert(
        {
          id: cp.id,
          type: cp.type,
          full_name: cp.full_name,
          country: cp.country,
          tax_status: cp.tax_status,
          vat_number: cp.vat_number,
          vies_verified_at: cp.vies_verified_at,
          vendor_code: cp.vendor_code
        },
        { onConflict: 'id' }
      );
    if (error) {
      throw new Error(`seed counterparty ${cp.full_name} (${cp.id}) failed: ${error.message}`);
    }
  }
}

// =============================================================================
// Main — invoked when script is run directly
// =============================================================================

interface CliMode {
  dryRun: boolean;
  reconcileOnly: boolean;
}

function parseArgs(): CliMode {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const reconcileOnly = args.includes('--reconcile-only');
  if (dryRun && reconcileOnly) {
    console.error('Error: --dry-run and --reconcile-only are mutually exclusive.');
    process.exit(1);
  }
  return { dryRun, reconcileOnly };
}

function loadEnv(): { url: string; key: string } {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(
      `Error: .env.local not found at ${envPath}. ` +
      `Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY there before running.`
    );
    process.exit(1);
  }
  dotenv.config({ path: envPath });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local.');
    process.exit(1);
  }
  return { url, key };
}

function logDryRun(): void {
  console.log('--dry-run mode: planned entries (no DB writes):\n');
  for (const entry of BACKFILL_ENTRIES) {
    const peeked = peekDispatch(entry);
    console.log(
      `  ${entry.entry_number.padEnd(20)} ${entry.event.posting_date}  ` +
      `${peeked.padEnd(6)}  ${entry.description}`
    );
  }
  console.log(`\nTotal: ${BACKFILL_ENTRIES.length} entries planned.`);
}

function peekDispatch(entry: BackfillEntry): string {
  // Expose the type_id without hitting the DB. Dispatch is pure (no I/O).
  try {
    const result = dispatch({
      event_type: entry.event.event_type,
      counterparty: null,  // dispatch may need counterparty for routing; null gives a partial peek
      payload: entry.event.payload as Record<string, unknown>
    });
    return result.id;
  } catch {
    return '???';
  }
}

async function runMain(): Promise<void> {
  const cli = parseArgs();
  const env = loadEnv();
  const supabase = createClient(env.url, env.key);

  console.log(`\nPhase 0 backfill ${cli.dryRun ? '(DRY RUN)' : cli.reconcileOnly ? '(RECONCILE ONLY)' : ''}`);
  console.log(`Target Supabase: ${env.url}\n`);

  // Pre-flight always runs (even for --dry-run / --reconcile-only); a missing
  // period seed is the same diagnostic regardless of mode.
  console.log('Pre-flight: checking periods...');
  await preflightVerifyPeriods(supabase);
  console.log('Pre-flight: periods 2025-07 → 2026-03 all seeded as `open`. ✓\n');

  if (cli.dryRun) {
    logDryRun();
    return;
  }

  if (cli.reconcileOnly) {
    console.log('Reconciling against existing GL state...');
    await assertMatchesExpectedClosingState(supabase);
    console.log('Reconciliation: PASS ✓');
    return;
  }

  // Default: full run
  console.log('Seeding vendor counterparties (VINCIT, C&C, Mollie)...');
  await seedCounterparties(supabase);
  console.log(`Seeded ${BACKFILL_COUNTERPARTIES.length} vendor counterparties. ✓\n`);

  console.log('Emitting 22 backfill entries through the posting engine...');
  const startedAt = Date.now();
  const result = await runBackfill(supabase);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const e of result.entries) {
    if (e.status === 'created') {
      console.log(`  ✓ ${e.entry_number.padEnd(20)} created     entry_id=${e.entry_id}`);
    } else if (e.status === 'idempotent_skip') {
      console.log(`  ⟳ ${e.entry_number.padEnd(20)} idem_skip   entry_id=${e.entry_id}`);
    } else {
      console.error(`  ✗ ${e.entry_number.padEnd(20)} FAILED      ${e.error}`);
    }
  }

  console.log(
    `\nEmits: ${result.created} created, ${result.idempotent_skip} idempotent_skip, ` +
    `${result.failed} failed (${elapsedSec}s)`
  );

  if (result.failed > 0) {
    console.error(
      `\nBackfill halted on ${result.failed} failure(s). Investigate the error above ` +
      `(typically: counterparty FK violation, period trigger rejection, or RPC contract ` +
      `error per CLAUDE.md). After fixing, re-run — committed entries hit idempotent_skip.`
    );
    process.exit(1);
  }

  console.log('\nReconciling closing state...');
  await assertMatchesExpectedClosingState(supabase);
  console.log('Reconciliation: PASS ✓');
}

// Guard: only run main when invoked directly (e.g. `npx tsx scripts/phase0-backfill.ts`),
// not when the file is imported by the integration test or another module.
// Without this, importing `runBackfill` from this file would trigger a full
// backfill run as a side effect.
const isDirectInvocation = import.meta.url === `file://${process.argv[1]}`;
if (isDirectInvocation) {
  runMain().catch((err: unknown) => {
    if (err instanceof Phase0ReconciliationError) {
      console.error(`\n${err.message}\n`);
      console.error(
        'Reconciliation failed. Do not retry blindly — the GL is now in a state different from spec.\n' +
        'Either (a) the spec expectation is wrong (check stg-phase-0-backfill-execution-v2.md), or\n' +
        '(b) the data table or compute() function has drifted. Read the failure carefully.'
      );
      process.exit(1);
    }
    console.error('\nBackfill aborted:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  });
}
