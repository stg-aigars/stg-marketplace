/**
 * June 2026 backfill — runner script.
 *
 * Posts 67 journal entries reconstructing STG's marketplace + vendor GL
 * activity for June 2026. Continues the chain from May (`close_2026_05`
 * hard-locked). June's OWN P.1 VAT close is NOT in this run — deferred until
 * the Swedbank/EveryPay platform-fee invoice for the 15.06 statement lines
 * arrives (~15 July); see june-2026-backfill-data.ts header. Requires the
 * mapping.ts changes on this branch: C.11 (new VID-payment type), and
 * bank_account overrides on I.5 + C.4.
 *
 * Usage:
 *   npx tsx scripts/june-2026-backfill.ts                  # full run + reconcile
 *   npx tsx scripts/june-2026-backfill.ts --dry-run        # log planned entries, no writes
 *   npx tsx scripts/june-2026-backfill.ts --reconcile-only # skip emits, verify GL state
 *
 * Env: reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotency: source_doc_id `june_2026_entry_<N>` (N=1..67, plus `6b`/`7b`). Re-runs hit
 * idempotent_skip and reconcile to the same closing state. Seller counterparty
 * resolution (see below) is also idempotent — a re-run's lookup finds the row
 * the first run created.
 *
 * Seller counterparty resolution: unlike April/May (only ever Aigars, already
 * seeded), June introduces ~10 new sellers completing their first-ever order.
 * The live wrap lazy-inits via `resolveSellerCounterparty` (lifecycle-wraps.ts)
 * — insert-without-id, DB assigns the UUID — which the backfill can't
 * replicate ahead of time in a static data file. So entries needing a seller
 * counterparty carry `sellerUserId` instead of a pre-known id; this runner
 * resolves-or-creates it immediately before each such emit (mirroring the live
 * function exactly: lookup by (user_id, type='seller'), insert from
 * user_profiles if missing) and mutates the event's `counterparty_id` +
 * `payload.seller_id` in place.
 *
 * Failure modes:
 *   - Pre-flight halt: 2026-06 not seeded as `open`.
 *   - Seller counterparty resolution failure: user_profiles row missing for a
 *     sellerUserId — investigate, don't fabricate a profile.
 *   - Counterparty FK violation: Porkbun's UPSERT failed, or a referenced
 *     existing vendor CP (Anthropic, Meta, Swedbank, Unisend, Hetzner, VID) is
 *     missing from prod.
 *   - Mid-script emit failure: stops the loop; re-run picks up (committed
 *     entries idempotent_skip, resolved seller counterparties are found not
 *     re-created).
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
} from './june-2026-backfill-data';
import {
  JuneReconciliationError,
  assertMatchesExpectedClosingState
} from './june-2026-backfill-reconcile';

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
 * Resolve-or-create a seller counterparty by user_id, mirroring
 * `resolveSellerCounterparty` in src/lib/accounting/lifecycle-wraps.ts exactly
 * (same lookup, same lazy-init insert shape) since the backfill calls emit()
 * directly and bypasses that wrap function.
 */
export async function resolveOrCreateSellerCounterparty(
  supabase: SupabaseClient,
  sellerUserId: string
): Promise<{ id: string }> {
  const { data: existing, error: lookupErr } = await supabase
    .from('counterparties')
    .select('id')
    .eq('user_id', sellerUserId)
    .eq('type', 'seller')
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`resolveOrCreateSellerCounterparty lookup failed for ${sellerUserId}: ${lookupErr.message}`);
  }
  if (existing) return existing;

  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, country')
    .eq('id', sellerUserId)
    .single();
  if (profileErr || !profile) {
    throw new Error(`resolveOrCreateSellerCounterparty: cannot read user_profile ${sellerUserId}: ${profileErr?.message ?? 'not found'}`);
  }

  const { data: created, error: insertErr } = await supabase
    .from('counterparties')
    .insert({
      user_id: sellerUserId,
      type: 'seller',
      full_name: profile.full_name,
      country: profile.country,
      tax_status: 'private',
      legal_compliance_status: 'ok',
      kyc_status: 'not_required'
    })
    .select('id')
    .single();
  if (insertErr || !created) {
    throw new Error(`resolveOrCreateSellerCounterparty: counterparty insert failed for ${sellerUserId}: ${insertErr?.message ?? 'no row returned'}`);
  }
  return created;
}

export async function runBackfill(supabase: SupabaseClient): Promise<BackfillRunResult> {
  await seedCounterparties(supabase);

  const result: BackfillRunResult = { created: 0, idempotent_skip: 0, failed: 0, entries: [] };

  for (const entry of BACKFILL_ENTRIES) {
    if (entry.sellerUserId) {
      const counterparty = await resolveOrCreateSellerCounterparty(supabase, entry.sellerUserId);
      entry.event.counterparty_id = counterparty.id;
      (entry.event.payload as Record<string, unknown>).seller_id = counterparty.id;
    }

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
 * Pre-flight: verify 2026-06 / 2026-Q2 / 2026 are seeded as `open`. Fail-fast
 * before any emit so the operator gets a clean error rather than a period
 * trigger error mid-script.
 */
export async function preflightVerifyPeriods(supabase: SupabaseClient): Promise<void> {
  const REQUIRED: Array<{ period_key: string; period_type: 'month' | 'quarter' | 'year' }> = [
    { period_key: '2026-06', period_type: 'month' },
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
 * UPSERT the ONE new vendor counterparty (Porkbun). Every other referenced
 * vendor (Anthropic, Meta, Swedbank, Unisend, Hetzner, VID) already exists in
 * prod and is intentionally NOT re-seeded here — re-UPSERT would risk
 * overwriting live fields. Seller counterparties are handled separately by
 * `resolveOrCreateSellerCounterparty` inside `runBackfill`.
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
    const sellerNote = entry.sellerUserId ? `seller=${entry.sellerUserId.slice(0, 8)}…` : '';
    console.log(
      `  ${entry.entry_number.padEnd(4)} ${entry.event.posting_date}  ` +
      `${peekDispatch(entry).padEnd(6)}  ${entry.description}  ${sellerNote}`
    );
  }
  console.log(`\nTotal: ${BACKFILL_ENTRIES.length} entries planned.`);
  const newSellers = new Set(
    BACKFILL_ENTRIES.filter((e) => e.sellerUserId).map((e) => e.sellerUserId)
  );
  console.log(`Seller counterparties touched (resolve-or-create): ${newSellers.size} distinct user_ids.`);
}

function peekDispatch(entry: BackfillEntry): string {
  // type_id preview without a DB hit. Dispatch needs counterparty for country-
  // routed types (I.3/I.4/O.1/O.3/O.5); we pass null and accept '???' for those.
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

  console.log(`\nJune 2026 backfill ${cli.dryRun ? '(DRY RUN)' : cli.reconcileOnly ? '(RECONCILE ONLY)' : ''}`);
  console.log(`Target Supabase: ${env.url}\n`);

  console.log('Pre-flight: checking periods 2026-06 / 2026-Q2 / 2026...');
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

  console.log(`Seeding ${BACKFILL_COUNTERPARTIES.length} new vendor counterpart(y/ies) + emitting ${BACKFILL_ENTRIES.length} entries...`);
  const startedAt = Date.now();
  const result = await runBackfill(supabase);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const e of result.entries) {
    if (e.status === 'created') {
      console.log(`  ✓ ${e.entry_number.padEnd(4)} created     entry_id=${e.entry_id}`);
    } else if (e.status === 'idempotent_skip') {
      console.log(`  ⟳ ${e.entry_number.padEnd(4)} idem_skip   entry_id=${e.entry_id}`);
    } else {
      console.error(`  ✗ ${e.entry_number.padEnd(4)} FAILED      ${e.error}`);
    }
  }

  console.log(`\nEmits: ${result.created} created, ${result.idempotent_skip} idempotent_skip, ${result.failed} failed (${elapsedSec}s)`);

  if (result.failed > 0) {
    console.error(`\nBackfill halted on ${result.failed} failure(s). Investigate above, fix, re-run (committed entries idempotent_skip).`);
    process.exit(1);
  }

  console.log('\nReconciling closing state @ 30.06.2026...');
  await assertMatchesExpectedClosingState(supabase);
  console.log('Reconciliation: PASS ✓');
  console.log(
    '\nNext steps:\n' +
    '  1. Extend BANK_WALK_CHECKPOINTS for June (already done on this branch — verify against\n' +
    '     the statement closings: 2610 €99.47, 2620 €886.35).\n' +
    '  2. DO NOT soft-lock 2026-06 yet — the Swedbank/EveryPay platform-fee invoice for the\n' +
    '     15.06 statement lines (€0.72) is still pending (~15 July). Checklist items 6 and 8\n' +
    '     will not fully reconcile until that entry + June\'s own P.1 close post.\n' +
    '  3. When that invoice arrives: post the fee entry, run June\'s P.1 close, run the\n' +
    '     period-close checklist, soft-lock, then file the June PVN deklarācija by 20 July.\n' +
    '  4. OSS Q2 2026 (Apr–Jun) return due 31 July — this backfill supplies the June O.3/O.5\n' +
    '     completions needed for that filing (April\'s single EE order already covered).\n' +
    '  5. July catch-up backfill will need: UJRJ\'s still-in-transit €34.10 card settlement,\n' +
    '     completions for E93F / XK5D / YEB9 (paid in June, complete in July), and STG-20260607-\n' +
    '     G6QC\'s wallet-integrity gap remains open until the wallet-cart-pay route gets GL wiring.\n'
  );
}

const isDirectInvocation = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectInvocation) {
  runMain().catch((err: unknown) => {
    if (err instanceof JuneReconciliationError) {
      console.error(`\n${err.message}\n`);
      console.error('Reconciliation failed. Do not retry blindly — investigate which account drifted.');
      process.exit(1);
    }
    console.error('\nBackfill aborted:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
}
