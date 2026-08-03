/**
 * July 2026 P.1 reversal — one-shot correction for period 2026-07.
 *
 * **Executed against production on 2026-08-03** (direct `execute_sql` call
 * to `insert_journal_entry` through Supabase MCP, same constraint as
 * june-2026-close-repair.ts — no service-role key in-session). Reversed
 * entry `close_2026_07` (id=91558a90-3029-4af6-9c78-e039b4ba244b) with
 * reversal entry `close_2026_07_reversal`=86d6f053-4efd-495d-925b-
 * b0bf5a86bb5c. Confirmed no double-reversal (pre-flight query found zero
 * existing reversals pointing at the original before posting). Executed
 * AFTER `scripts/july-2026-backfill.ts`'s 30 entries had already posted and
 * reconciled. A fresh, correct July P.1 remains a separate, later step.
 *
 * The `monthly-vat-close` cron fired on 2026-08-01 (targeting the previous
 * month, July) and posted `close_2026_07` — but at that point almost none of
 * July's real marketplace/vendor activity had been backfilled yet (Stage 3
 * cutover only shipped 2026-07-31, and this repo's July backfill itself
 * lands after the cron already ran). `close_2026_07` therefore only swept
 * June's leftover `tax_period=2026-07` spillover (the two late-surfacing
 * invoices from june-2026-close-repair.ts) — a €7.03 refund position (Dr
 * 5710-LV-OUT €0.71, Cr 5710-LV-IN €7.74, Dr 2380 €7.03) that does NOT
 * reflect July's real activity once scripts/july-2026-backfill.ts posts.
 *
 * This script reverses `close_2026_07` in full, mirroring
 * june-2026-close-repair.ts's step-3 reversal pattern exactly:
 * entry_type='reversal', type_id unchanged ('P.1'), reverses_entry_id set,
 * correction_reason set, posting_context.emission_source='staff_manual'.
 * Built directly via the `insert_journal_entry` primitive (not `emit()`) —
 * same rationale as June's reversal: no mapping-table type produces
 * arbitrary mirror-image lines for an existing entry.
 *
 * Does NOT post a fresh, correct July P.1 — that is a separate, later step
 * (once scripts/july-2026-backfill.ts has posted and reconciled, and once
 * the two open questions in july-2026-backfill-data.ts's header — the
 * Q2.2026 VID payment and the 5710-09 7-cent residual — are resolved).
 * Matches the precedent every prior month set: close each period AFTER its
 * backfill reconciles, as its own distinct step.
 *
 * Usage:
 *   npx tsx scripts/july-2026-close-p1-reversal.ts              # reverse + recheck
 *   npx tsx scripts/july-2026-close-p1-reversal.ts --dry-run    # log planned action, no writes
 *
 * Env: reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotency: re-running finds `close_2026_07` already reversed and halts
 * with a clear message rather than reversing twice (guard on
 * reversed_by / a second reversal referencing the same original entry_id).
 *
 * Failure modes:
 *   - Pre-flight halt: `close_2026_07` not found (already reversed, or never
 *     posted).
 *   - Pre-flight halt: `close_2026_07` already has a reversal pointing at it
 *     (checked via journal_entries.reverses_entry_id).
 *
 * IMPORTANT: run this BEFORE or AFTER scripts/july-2026-backfill.ts — order
 * doesn't matter for correctness (the reversal only touches close_2026_07's
 * own lines; the backfill's entries are independent), but running the
 * backfill FIRST means the period-close checklist's item 8 (VAT
 * consolidation posted) will correctly show `fail` until a fresh P.1 is
 * posted in the later close step — expected, not a bug.
 */

import './_load-env';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import { assertBalanced } from '@/lib/accounting/computer';
import { checkIdempotency } from '@/lib/accounting/idempotency';
import { logAuditEvent } from '@/lib/services/audit';

const CREATED_BY = 'july_2026_close_p1_reversal';
const ORIGINAL_SOURCE_DOC_ID = 'close_2026_07';
const REVERSAL_SOURCE_DOC_ID = 'close_2026_07_reversal';

interface RawLine {
  line_number: number;
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  currency?: string | null;
  vat_rate_snapshot?: number | null;
  vat_country?: string | null;
  counterparty_type?: string | null;
  counterparty_id?: string | null;
  narrative?: string | null;
}

interface OriginalCloseEntry {
  id: string;
  source_doc_id: string;
  posting_date: string;
  accounting_period: string;
  tax_period: string;
  lines: RawLine[];
}

export async function fetchOriginalCloseEntry(supabase: SupabaseClient): Promise<OriginalCloseEntry> {
  const { data: entryRow, error: entryErr } = await supabase
    .from('journal_entries')
    .select('id, posting_date, accounting_period, tax_period')
    .eq('source_doc_type', 'period_close')
    .eq('source_doc_id', ORIGINAL_SOURCE_DOC_ID)
    .eq('type_id', 'P.1')
    .maybeSingle();
  if (entryErr) {
    throw new Error(`fetchOriginalCloseEntry: journal_entries SELECT failed: ${entryErr.message}`);
  }
  if (!entryRow) {
    throw new Error(
      `fetchOriginalCloseEntry: '${ORIGINAL_SOURCE_DOC_ID}' not found — already reversed, or never posted. Investigate before proceeding.`
    );
  }
  const row = entryRow as { id: string; posting_date: string; accounting_period: string; tax_period: string };

  const { data: alreadyReversed, error: reversedErr } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reverses_entry_id', row.id)
    .maybeSingle();
  if (reversedErr) {
    throw new Error(`fetchOriginalCloseEntry: reversal-lookup SELECT failed: ${reversedErr.message}`);
  }
  if (alreadyReversed) {
    throw new Error(
      `fetchOriginalCloseEntry: '${ORIGINAL_SOURCE_DOC_ID}' (id=${row.id}) already has a reversal (id=${(alreadyReversed as { id: string }).id}) — do not reverse twice.`
    );
  }

  const { data: lineRows, error: lineErr } = await supabase
    .from('journal_lines')
    .select('line_number, account_code, debit_cents, credit_cents, currency, vat_rate_snapshot, vat_country, counterparty_type, counterparty_id, narrative')
    .eq('entry_id', row.id)
    .order('line_number', { ascending: true });
  if (lineErr) {
    throw new Error(`fetchOriginalCloseEntry: journal_lines SELECT failed: ${lineErr.message}`);
  }

  return {
    id: row.id,
    source_doc_id: ORIGINAL_SOURCE_DOC_ID,
    posting_date: row.posting_date,
    accounting_period: row.accounting_period,
    tax_period: row.tax_period,
    lines: (lineRows ?? []) as RawLine[]
  };
}

/** Mirror-image lines: debit/credit swapped, everything else preserved. Identical shape to june-2026-close-repair.ts's buildReversalLines. */
export function buildReversalLines(originalLines: RawLine[]): RawLine[] {
  return originalLines.map((line, idx) => ({
    line_number: idx + 1,
    account_code: line.account_code,
    debit_cents: line.credit_cents,
    credit_cents: line.debit_cents,
    currency: line.currency ?? 'EUR',
    vat_rate_snapshot: line.vat_rate_snapshot ?? null,
    vat_country: line.vat_country ?? null,
    counterparty_type: line.counterparty_type ?? null,
    counterparty_id: line.counterparty_id ?? null,
    narrative: line.narrative ? `Reversal — ${line.narrative}` : 'Reversal'
  }));
}

export function buildReversalEntry(
  original: OriginalCloseEntry
): { entry: Record<string, unknown>; lines: RawLine[] } {
  const lines = buildReversalLines(original.lines);
  assertBalanced(lines);
  const entry: Record<string, unknown> = {
    posting_date: original.posting_date,
    accounting_period: original.accounting_period,
    tax_period: original.tax_period,
    entry_type: 'reversal',
    type_id: 'P.1',
    source_doc_type: 'period_close',
    source_doc_id: REVERSAL_SOURCE_DOC_ID,
    reverses_entry_id: original.id,
    correction_reason:
      'close_2026_07 was posted by the monthly-vat-close cron on 2026-08-01 before July\'s real ' +
      'marketplace/vendor activity was backfilled — it only swept June\'s leftover tax_period=2026-07 ' +
      'spillover and does not reflect July. Reversed in full; a fresh, correct July P.1 is a separate ' +
      'later step once the backfill reconciles and the two open questions (Q2.2026 VID payment, ' +
      '5710-09 7-cent residual) resolve.',
    narrative: `Reversal of ${ORIGINAL_SOURCE_DOC_ID} — premature P.1 predating July's real activity backfill`,
    posting_context: {
      backfill: true,
      july_2026_close_p1_reversal: true,
      emission_source: 'staff_manual',
      reverses_source_doc_id: ORIGINAL_SOURCE_DOC_ID
    },
    created_by: CREATED_BY,
    period_close_adjustment: false
  };
  return { entry, lines };
}

/**
 * Posts a hand-built entry via the `insert_journal_entry` primitive directly
 * (not `emit()`) — identical shape to june-2026-close-repair.ts's
 * postRawEntry (duplicated rather than imported: that file's version is
 * scoped to its own CREATED_BY constant and step-specific audit metadata).
 */
export async function postRawEntry(
  supabase: SupabaseClient,
  entry: Record<string, unknown>,
  lines: RawLine[]
): Promise<{ status: 'created' | 'idempotent_skip'; entry_id: string }> {
  const source_doc_type = entry.source_doc_type as string;
  const source_doc_id = entry.source_doc_id as string;
  const type_id = entry.type_id as string;

  const idem = await checkIdempotency(supabase, source_doc_type, source_doc_id, type_id);
  if (idem.status === 'idempotent_skip') {
    return { status: 'idempotent_skip', entry_id: idem.entry_id };
  }

  const { data: entryId, error } = await supabase.rpc('insert_journal_entry', {
    p_entry: entry,
    p_lines: lines
  });

  if (error) {
    if (error.code === '23505') {
      const recovery = await checkIdempotency(supabase, source_doc_type, source_doc_id, type_id);
      if (recovery.status === 'idempotent_skip') {
        return { status: 'idempotent_skip', entry_id: recovery.entry_id };
      }
    }
    throw new Error(`insert_journal_entry failed (${error.code ?? 'unknown'}): ${error.message}`);
  }
  if (typeof entryId !== 'string') {
    throw new Error(`insert_journal_entry returned unexpected payload: ${JSON.stringify(entryId)}`);
  }

  void logAuditEvent(supabase, {
    actorType: 'system',
    action: 'accounting.posted',
    resourceType: 'journal_entry',
    resourceId: entryId,
    metadata: {
      type_id,
      source_doc_type,
      source_doc_id,
      accounting_period: entry.accounting_period as string,
      tax_period: entry.tax_period as string,
      created_by: CREATED_BY
    },
    retentionClass: 'regulatory'
  }).catch((err: unknown) => {
    console.error(`accounting.posted audit write failed (entry_id=${entryId}):`, err);
  });

  return { status: 'created', entry_id: entryId };
}

export async function runReversal(supabase: SupabaseClient): Promise<{
  status: 'created' | 'idempotent_skip';
  entry_id: string;
  reversed_entry_id: string;
}> {
  const original = await fetchOriginalCloseEntry(supabase);
  const { entry, lines } = buildReversalEntry(original);
  const result = await postRawEntry(supabase, entry, lines);
  return { ...result, reversed_entry_id: original.id };
}

// =============================================================================
// Main
// =============================================================================

function parseArgs(): { dryRun: boolean } {
  return { dryRun: process.argv.slice(2).includes('--dry-run') };
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

async function runMain(): Promise<void> {
  const cli = parseArgs();
  const env = loadEnv();
  const supabase = createClient(env.url, env.key);

  console.log(`\nJuly 2026 P.1 reversal ${cli.dryRun ? '(DRY RUN)' : ''}`);
  console.log(`Target Supabase: ${env.url}\n`);

  if (cli.dryRun) {
    console.log('--dry-run mode: planned action (no DB writes):');
    console.log(`  Reverse ${ORIGINAL_SOURCE_DOC_ID} (P.1, €7.03 refund position: Dr 5710-LV-OUT €0.71,`);
    console.log('  Cr 5710-LV-IN €7.74, Dr 2380 €7.03) via a mirror-image reversal entry');
    console.log(`  (source_doc_id=${REVERSAL_SOURCE_DOC_ID}, entry_type=reversal, reverses_entry_id set).`);
    console.log('  Does NOT post a fresh July P.1 — that is a separate, later step.');
    return;
  }

  const result = await runReversal(supabase);
  if (result.status === 'created') {
    console.log(`  ✓ ${REVERSAL_SOURCE_DOC_ID.padEnd(28)} created     entry_id=${result.entry_id} (reverses ${result.reversed_entry_id})`);
  } else {
    console.log(`  ⟳ ${REVERSAL_SOURCE_DOC_ID.padEnd(28)} idem_skip   entry_id=${result.entry_id}`);
  }

  console.log(
    '\nReminder: a fresh, correct July P.1 is NOT posted by this script. Post it as a separate,' +
    '\nlater step once scripts/july-2026-backfill.ts has run and reconciled, and once the two open' +
    '\nquestions (Q2.2026 VID payment, 5710-09 7-cent residual) are resolved.'
  );
}

const isDirectInvocation = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectInvocation) {
  runMain().catch((err: unknown) => {
    console.error('\nReversal aborted:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
}
