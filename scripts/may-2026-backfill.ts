/**
 * May 2026 backfill — runner script.
 *
 * Posts 19 journal entries reconstructing STG's marketplace + vendor GL
 * activity for May 2026 ahead of the PVN deklarācija filing deadline
 * (20 June 2026). Continues the chain from April (`close_2026_04` hard-locked)
 * and Phase 0. Requires the backfill-enablement engine types (PR #394).
 *
 * Usage:
 *   npx tsx scripts/may-2026-backfill.ts                  # full run + reconcile
 *   npx tsx scripts/may-2026-backfill.ts --dry-run        # log planned entries, no writes
 *   npx tsx scripts/may-2026-backfill.ts --reconcile-only # skip emits, verify GL state
 *
 * Env: reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotency: source_doc_id `may_2026_entry_<N>` (N=1..18) + `close_2026_05`.
 * Re-runs hit idempotent_skip and reconcile to the same closing state. The
 * monthly-depreciation cron's P.6 (`depreciation_IT-2026-001_2026-05`) is NOT
 * emitted here — it already posted on 2026-05-31.
 *
 * Failure modes:
 *   - Pre-flight halt: 2026-05 not seeded as `open`.
 *   - Counterparty FK violation: the 3 new vendor CPs failed UPSERT, or one of
 *     the referenced existing CPs (Unisend a9999…, Vincit a1111…, Aigars
 *     d630f6e7…) is missing from prod. Investigate — don't auto-create.
 *   - Mid-script emit failure: stops the loop; re-run picks up (committed
 *     entries idempotent_skip).
 *   - Reconciliation halt: data drift. Reversal entries are the fix, NOT DELETE.
 */

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
} from './may-2026-backfill-data';
import {
  MayReconciliationError,
  assertMatchesExpectedClosingState
} from './may-2026-backfill-reconcile';

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

export async function runBackfill(supabase: SupabaseClient): Promise<BackfillRunResult> {
  await seedCounterparties(supabase);

  const result: BackfillRunResult = { created: 0, idempotent_skip: 0, failed: 0, entries: [] };

  for (const entry of BACKFILL_ENTRIES) {
    const emitResult = await emit(supabase, entry.event);
    if (emitResult.status === 'created') {
      result.created++;
      result.entries.push({ entry_number: entry.entry_number, status: 'created', entry_id: emitResult.entry_id });
    } else if (emitResult.status === 'idempotent_skip') {
      result.idempotent_skip++;
      result.entries.push({ entry_number: entry.entry_number, status: 'idempotent_skip', entry_id: emitResult.entry_id });
    } else {
      result.failed++;
      result.entries.push({ entry_number: entry.entry_number, status: 'failed', error: emitResult.error });
      return result; // stop on first failure — half-state is the diagnostic
    }
  }

  return result;
}

/**
 * Pre-flight: verify 2026-05 / 2026-Q2 / 2026 are seeded as `open`. Fail-fast
 * before any emit so the operator gets a clean error rather than a period
 * trigger error mid-script.
 */
export async function preflightVerifyPeriods(supabase: SupabaseClient): Promise<void> {
  const REQUIRED: Array<{ period_key: string; period_type: 'month' | 'quarter' | 'year' }> = [
    { period_key: '2026-05', period_type: 'month' },
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
      throw new Error(`pre-flight: period ${req.period_key} (${req.period_type}) not seeded in public.periods.`);
    }
    if (data.status !== 'open') {
      throw new Error(
        `pre-flight: period ${req.period_key} (${req.period_type}) has status='${data.status}', expected 'open'. ` +
        `Soft/hard-locked periods reject backfill emits via the period-status trigger.`
      );
    }
  }
}

/**
 * UPSERT the THREE new vendor counterparties (Anthropic, Meta, Swedbank).
 * Existing CPs (Unisend, Vincit, Aigars seller) are referenced by id in the
 * data file and intentionally NOT re-seeded — they already exist in prod and
 * re-UPSERT would risk overwriting live fields.
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
// Main
// =============================================================================

function parseArgs(): { dryRun: boolean; reconcileOnly: boolean } {
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
    console.error(`Error: .env.local not found at ${envPath}.`);
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
    console.log(
      `  ${entry.entry_number.padEnd(16)} ${entry.event.posting_date}  ` +
      `${peekDispatch(entry).padEnd(6)}  ${entry.description}`
    );
  }
  console.log(`\nTotal: ${BACKFILL_ENTRIES.length} entries planned.`);
}

function peekDispatch(entry: BackfillEntry): string {
  // type_id preview without a DB hit. Dispatch needs counterparty for country-
  // routed types (I.3/I.4/O.1); we pass null and accept '???' for those.
  try {
    return dispatch({
      event_type: entry.event.event_type,
      counterparty: null,
      payload: entry.event.payload as Record<string, unknown>
    }).id;
  } catch {
    return '???';
  }
}

async function runMain(): Promise<void> {
  const cli = parseArgs();
  const env = loadEnv();
  const supabase = createClient(env.url, env.key);

  console.log(`\nMay 2026 backfill ${cli.dryRun ? '(DRY RUN)' : cli.reconcileOnly ? '(RECONCILE ONLY)' : ''}`);
  console.log(`Target Supabase: ${env.url}\n`);

  console.log('Pre-flight: checking periods 2026-05 / 2026-Q2 / 2026...');
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

  console.log(`Seeding ${BACKFILL_COUNTERPARTIES.length} new counterparties + emitting ${BACKFILL_ENTRIES.length} entries...`);
  const startedAt = Date.now();
  const result = await runBackfill(supabase);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const e of result.entries) {
    if (e.status === 'created') {
      console.log(`  ✓ ${e.entry_number.padEnd(16)} created     entry_id=${e.entry_id}`);
    } else if (e.status === 'idempotent_skip') {
      console.log(`  ⟳ ${e.entry_number.padEnd(16)} idem_skip   entry_id=${e.entry_id}`);
    } else {
      console.error(`  ✗ ${e.entry_number.padEnd(16)} FAILED      ${e.error}`);
    }
  }

  console.log(`\nEmits: ${result.created} created, ${result.idempotent_skip} idempotent_skip, ${result.failed} failed (${elapsedSec}s)`);

  if (result.failed > 0) {
    console.error(`\nBackfill halted on ${result.failed} failure(s). Investigate above, fix, re-run (committed entries idempotent_skip).`);
    process.exit(1);
  }

  console.log('\nReconciling closing state @ 31.05.2026...');
  await assertMatchesExpectedClosingState(supabase);
  console.log('Reconciliation: PASS ✓');
  console.log(
    '\nNext steps:\n' +
    '  1. Soft-lock period 2026-05 via period-actions / staff UI (after accountant TB sign-off).\n' +
    '  2. Assemble + file May PVN deklarācija on EDS by 20 June 2026:\n' +
    '       Output VAT      = €1.11 (5710-LV-OUT: orders 1 + 3)\n' +
    '       Input VAT (net) = −€6.11 (5710-LV-IN: €0.12 EveryPay fee − €6.23 Vincit reversal)\n' +
    '       Net payable     = €7.22 owed to VID (5710-09)\n' +
    '       Foreign RC      = Anthropic €18.90 + Meta €2.73 (PVN 1-II/1-I; nets to zero, on balance sheet)\n' +
    '       OSS             = none for May (LT/EE orders complete in June)\n' +
    '  3. Hard-lock period 2026-05 once VID filing confirmed.\n' +
    '  4. June catch-up backfill: orders 4/6 settlement (C.3 → 2620), completions for orders 2/4/5/6,\n' +
    '     Meta €6.00 payment, Jun-2 Meta €5.00 invoice, 5 Jun Anthropic renewal.\n'
  );
}

const isDirectInvocation = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectInvocation) {
  runMain().catch((err: unknown) => {
    if (err instanceof MayReconciliationError) {
      console.error(`\n${err.message}\n`);
      console.error('Reconciliation failed. Do not retry blindly — investigate which account drifted.');
      process.exit(1);
    }
    console.error('\nBackfill aborted:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
}
