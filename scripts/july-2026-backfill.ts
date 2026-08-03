/**
 * July 2026 backfill — runner script (FULL PASS).
 *
 * Posts 32 journal entries — see july-2026-backfill-data.ts header for the
 * full breakdown. Does NOT post the close_2026_07 reversal (separate script,
 * scripts/july-2026-close-p1-reversal.ts) or a fresh July P.1 (deliberately
 * deferred to a later close step, matching every prior month's discipline).
 *
 * Usage:
 *   npx tsx scripts/july-2026-backfill.ts                  # full run + reconcile
 *   npx tsx scripts/july-2026-backfill.ts --dry-run        # log planned entries, no writes
 *   npx tsx scripts/july-2026-backfill.ts --reconcile-only # skip emits, verify GL state
 *
 * Env: reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotency: source_doc_id `july_2026_entry_<N>` (N=1..32). Re-runs hit
 * idempotent_skip. Seller counterparty resolution mirrors the June runner's
 * resolveOrCreateSellerCounterparty pattern exactly. Buyer counterparty
 * resolution (for the one 100%-wallet cart, entry 4) mirrors
 * resolveOrCreateBuyerCounterparty from lifecycle-wraps.ts / the June
 * close-repair's usage of the same helper.
 */

import './_load-env';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import { dispatch } from '@/lib/accounting/dispatcher';
import { resolveOrCreateBuyerCounterparty } from '@/lib/accounting/lifecycle-wraps';
import { emit } from '@/lib/accounting/posting-engine';

import {
  BACKFILL_COUNTERPARTIES,
  BACKFILL_ENTRIES,
  type BackfillEntry
} from './july-2026-backfill-data';
import {
  JulyReconciliationError,
  assertMatchesExpectedClosingState
} from './july-2026-backfill-reconcile';

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

/** Mirrors resolveSellerCounterparty in lifecycle-wraps.ts exactly. */
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

    if (entry.buyerUserId) {
      const buyerCounterparty = await resolveOrCreateBuyerCounterparty(supabase, entry.buyerUserId);
      (entry.event.payload as Record<string, unknown>).buyer_counterparty_id = buyerCounterparty.id;
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
      return result;
    }
  }

  return result;
}

export async function preflightVerifyPeriods(supabase: SupabaseClient): Promise<void> {
  const REQUIRED: Array<{ period_key: string; period_type: 'month' | 'quarter' | 'year' }> = [
    { period_key: '2026-07', period_type: 'month' },
    { period_key: '2026-Q3', period_type: 'quarter' },
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
    const buyerNote = entry.buyerUserId ? `buyer=${entry.buyerUserId.slice(0, 8)}…` : '';
    console.log(
      `  ${entry.entry_number.padEnd(4)} ${entry.event.posting_date}  ` +
      `${peekDispatch(entry).padEnd(6)}  ${entry.description}  ${sellerNote}${buyerNote}`
    );
  }
  console.log(`\nTotal: ${BACKFILL_ENTRIES.length} entries planned (full July pass).`);
}

function peekDispatch(entry: BackfillEntry): string {
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

  console.log(`\nJuly 2026 backfill (FULL) ${cli.dryRun ? '(DRY RUN)' : cli.reconcileOnly ? '(RECONCILE ONLY)' : ''}`);
  console.log(`Target Supabase: ${env.url}\n`);

  console.log('Pre-flight: checking periods 2026-07 / 2026-Q3 / 2026...');
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

  console.log(`Emitting ${BACKFILL_ENTRIES.length} entries...`);
  const result = await runBackfill(supabase);

  for (const e of result.entries) {
    if (e.status === 'created') {
      console.log(`  ✓ ${e.entry_number.padEnd(4)} created     entry_id=${e.entry_id}`);
    } else if (e.status === 'idempotent_skip') {
      console.log(`  ⟳ ${e.entry_number.padEnd(4)} idem_skip   entry_id=${e.entry_id}`);
    } else {
      console.error(`  ✗ ${e.entry_number.padEnd(4)} FAILED      ${e.error}`);
    }
  }

  console.log(`\nEmits: ${result.created} created, ${result.idempotent_skip} idempotent_skip, ${result.failed} failed`);

  if (result.failed > 0) {
    console.error(`\nBackfill halted on ${result.failed} failure(s). Investigate above, fix, re-run.`);
    process.exit(1);
  }

  console.log('\nReconciling...');
  await assertMatchesExpectedClosingState(supabase);
  console.log('Reconciliation: PASS ✓');
  console.log(
    '\nStill outstanding after this pass (NOT this script\'s job):\n' +
    '  - The close_2026_07 reversal — run scripts/july-2026-close-p1-reversal.ts separately.\n' +
    '  - The Q2.2026 VID payment (€10.35, 11.07) — open question, NOT posted; see data file header.\n' +
    '  - UJRJ\'s still-in-transit €34.10 card settlement — explicit user decision to skip.\n' +
    '  - A fresh, correct July P.1 VAT close — deliberately deferred to a later step (matches\n' +
    '    April/May/June precedent of closing the period AFTER its backfill is reconciled).\n' +
    '  - Recording July\'s 2610/2620 bank_statement_closures rows via the staff UI (separate\n' +
    '    manual action, not part of any backfill script to date).\n'
  );
}

const isDirectInvocation = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectInvocation) {
  runMain().catch((err: unknown) => {
    if (err instanceof JulyReconciliationError) {
      console.error(`\n${err.message}\n`);
      console.error('Reconciliation failed. Do not retry blindly — investigate which account drifted.');
      process.exit(1);
    }
    console.error('\nBackfill aborted:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
}
