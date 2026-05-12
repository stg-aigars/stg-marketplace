/**
 * April 2026 backfill — runner script.
 *
 * Posts 10 journal entries reconstructing STG's marketplace + vendor GL
 * activity for April 2026 ahead of the PVN deklarācija filing deadline
 * (20 May 2026). Continues the chain established by `phase0-backfill.ts`
 * (Phase 0 closed 31.03.2026 hard-locked).
 *
 * Usage:
 *
 *   npx tsx scripts/april-2026-backfill.ts                 # full run + reconcile
 *   npx tsx scripts/april-2026-backfill.ts --dry-run       # log planned entries, no DB writes
 *   npx tsx scripts/april-2026-backfill.ts --reconcile-only # skip emits, just verify
 *
 * Env: reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY. Point at production for the production cutover.
 *
 * Idempotency: source_doc_id pattern `april_2026_entry_<N>` for the 9
 * marketplace + vendor entries, plus `phase0_entry_21` for the April
 * depreciation (continues the Phase 0 chain at N=21; future cron starts N=22).
 * Re-runs hit `idempotent_skip` and reconcile to the same closing state.
 *
 * Failure modes:
 *   - Pre-flight halt: 2026-04 not seeded as `open`. Verify periods table.
 *   - Counterparty FK violation: BACKFILL_COUNTERPARTIES UPSERT mismatched
 *     ID against an existing row. Don't auto-correct — investigate first.
 *   - C.4 KYC gate (entry 8): engine throws PostingComplianceGateError if
 *     the lazy-created EE seller CP has legal_compliance_status != 'ok'.
 *     The seed sets it to 'ok'; if it drifts in the DB, fix the seed not
 *     the gate.
 *   - Mid-script emit failure: stops the loop. Re-running picks up where
 *     it stopped (committed entries idempotent_skip; uncommitted retry).
 *   - Reconciliation halt: data drift. Each emit's source_doc_id is
 *     deterministic; reversal entries are the correct fix path, NOT
 *     manual DELETE.
 */

// MUST be the first import: side-effect-loads .env.local into process.env
// BEFORE any `@/lib/*` import evaluates and captures process.env via env.ts.
// (Without this, the engine's audit-log fire-and-forget path throws
// "supabaseUrl is required" because @/lib/env saw undefined env vars at
// module-load time. See `_load-env.ts` for full rationale.)
import './_load-env';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import { dispatch } from '@/lib/accounting/dispatcher';
import { emit } from '@/lib/accounting/posting-engine';

import {
  BACKFILL_COUNTERPARTIES,
  BACKFILL_ENTRIES,
  type BackfillEntry
} from './april-2026-backfill-data';
import {
  AprilReconciliationError,
  assertMatchesExpectedClosingState
} from './april-2026-backfill-reconcile';

// =============================================================================
// Public API — exported for an integration test (parallel to Phase 0 pattern)
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
 * Run the full backfill: counterparty UPSERT + 10 emits. Stops on first
 * failure (with the failed entry recorded). Reconciliation is the caller's
 * responsibility (runMain calls it).
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
      // Stop on first failure — half-state is the diagnostic.
      return result;
    }
  }

  return result;
}

/**
 * Pre-flight: verify period 2026-04 is seeded as `open`. Fail-fast before any
 * emit so the operator gets a clean error rather than a period-trigger error
 * mid-script. Also verifies 2026-Q2 + 2026 (quarter + year periods) for
 * sanity; April depreciation and OSS-EE entries flow through those.
 */
export async function preflightVerifyPeriods(supabase: SupabaseClient): Promise<void> {
  type Required = { period_key: string; period_type: 'month' | 'quarter' | 'year' };
  const REQUIRED: Required[] = [
    { period_key: '2026-04', period_type: 'month' },
    { period_key: '2026-Q2', period_type: 'quarter' },
    { period_key: '2026', period_type: 'year' }
  ];
  for (const req of REQUIRED) {
    const { data, error } = await supabase
      .from('periods')
      .select('status')
      .eq('period_key', req.period_key)
      .eq('period_type', req.period_type)
      .maybeSingle();
    if (error) {
      throw new Error(`pre-flight: failed to query period ${req.period_key} (${req.period_type}): ${error.message}`);
    }
    if (!data) {
      throw new Error(
        `pre-flight: period ${req.period_key} (${req.period_type}) not seeded in public.periods. ` +
        `Verify migration 096 seed window covers 2026-04 → 2026-12.`
      );
    }
    if (data.status !== 'open') {
      throw new Error(
        `pre-flight: period ${req.period_key} (${req.period_type}) has status='${data.status}', expected 'open'. ` +
        `Soft-locked or hard-locked periods reject backfill emits via the period-status trigger.`
      );
    }
  }
}

/**
 * UPSERT counterparties (Hetzner + Unisend vendors; EE + LV sellers).
 * Idempotent — re-runs UPSERT the same row by id, leaving content unchanged.
 *
 * Seller counterparties: counterparties.user_id FK targets auth.users(id) with
 * ON DELETE SET NULL. Both April sellers' auth.users rows exist (anonymize-
 * not-delete per account_deletion_architecture.md), so cp.user_id carries the
 * real auth.users.id through to the FK. Vendors pass null (no user linkage).
 */
export async function seedCounterparties(supabase: SupabaseClient): Promise<void> {
  for (const cp of BACKFILL_COUNTERPARTIES) {
    const { error } = await supabase
      .from('counterparties')
      .upsert(
        {
          id: cp.id,
          type: cp.type,
          user_id: cp.user_id,
          full_name: cp.full_name,
          country: cp.country,
          tax_status: cp.tax_status,
          vat_number: cp.vat_number,
          vies_verified_at: cp.vies_verified_at,
          vendor_code: cp.vendor_code,
          legal_compliance_status: cp.legal_compliance_status
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
      `  ${entry.entry_number.padEnd(24)} ${entry.event.posting_date}  ` +
      `${peeked.padEnd(6)}  ${entry.description}`
    );
  }
  console.log(`\nTotal: ${BACKFILL_ENTRIES.length} entries planned.`);
}

function peekDispatch(entry: BackfillEntry): string {
  // Expose the type_id without hitting the DB. Dispatch needs counterparty for
  // some routing decisions (O.x by country, I.x by country); for dry-run we
  // pass null and accept partial-peek results (most April entries dispatch
  // purely on event_type + payload, so this works for 7 of 10).
  try {
    const result = dispatch({
      event_type: entry.event.event_type,
      counterparty: null,
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

  console.log(`\nApril 2026 backfill ${cli.dryRun ? '(DRY RUN)' : cli.reconcileOnly ? '(RECONCILE ONLY)' : ''}`);
  console.log(`Target Supabase: ${env.url}\n`);

  console.log('Pre-flight: checking periods 2026-04 / 2026-Q2 / 2026...');
  await preflightVerifyPeriods(supabase);
  console.log('Pre-flight: required periods all seeded as `open`. ✓\n');

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

  console.log(
    `Seeding ${BACKFILL_COUNTERPARTIES.length} counterparties + emitting ${BACKFILL_ENTRIES.length} entries...`
  );
  const startedAt = Date.now();
  const result = await runBackfill(supabase);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const e of result.entries) {
    if (e.status === 'created') {
      console.log(`  ✓ ${e.entry_number.padEnd(24)} created     entry_id=${e.entry_id}`);
    } else if (e.status === 'idempotent_skip') {
      console.log(`  ⟳ ${e.entry_number.padEnd(24)} idem_skip   entry_id=${e.entry_id}`);
    } else {
      console.error(`  ✗ ${e.entry_number.padEnd(24)} FAILED      ${e.error}`);
    }
  }

  console.log(
    `\nEmits: ${result.created} created, ${result.idempotent_skip} idempotent_skip, ` +
    `${result.failed} failed (${elapsedSec}s)`
  );

  if (result.failed > 0) {
    console.error(
      `\nBackfill halted on ${result.failed} failure(s). Investigate the error above ` +
      `(typically: counterparty FK violation, period trigger rejection, C.4 KYC gate, ` +
      `or RPC contract error per CLAUDE.md). After fixing, re-run — committed entries ` +
      `hit idempotent_skip.`
    );
    process.exit(1);
  }

  console.log('\nReconciling closing state @ 30.04.2026...');
  await assertMatchesExpectedClosingState(supabase);
  console.log('Reconciliation: PASS ✓');
  console.log(
    '\nNext steps:\n' +
    '  1. Soft-lock period 2026-04 via period-actions / staff UI.\n' +
    '  2. Verify no entries post to soft-locked 2026-04 (period_close_adjustment=false rejects).\n' +
    '  3. Hard-lock period 2026-04 via hard_lock_period_atomic RPC.\n' +
    '  4. Save reconciliation snapshot to docs/audits/april-2026-closing-tb-2026-04-30.md.\n' +
    '  5. Generate PVN deklarācija data (April):\n' +
    '       Output VAT  = €0.38 (5710-LV-OUT)\n' +
    '       Input VAT   = €0.68 (5710-LV-IN)\n' +
    '       Net refund  = €0.30 owed by VID to STG\n' +
    '       OSS-EE      = €0.64 cumulative Q2 2026 (remit by 31.07.2026; not on PVN deklarācija)\n'
  );
}

// Guard: only run main when invoked directly. Without this, importing
// `runBackfill` from this file would trigger a full backfill as a side effect.
//
// Uses pathToFileURL to URL-encode the script path correctly — `import.meta.url`
// percent-encodes spaces while `process.argv[1]` is the raw filesystem path.
// A naive `file://${process.argv[1]}` comparison fails on any path containing
// spaces (e.g. "Second Turn Games") and silently no-ops the script.
const isDirectInvocation = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectInvocation) {
  runMain().catch((err: unknown) => {
    if (err instanceof AprilReconciliationError) {
      console.error(`\n${err.message}\n`);
      console.error(
        'Reconciliation failed. Do not retry blindly — the GL is now in a state different from spec.\n' +
        'Either (a) the spec expectation is wrong (check the round 2 preamble TB sign-off), or\n' +
        '(b) an entry posted differently than predicted. Investigate which account drifted.'
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
