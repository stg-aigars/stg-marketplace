/**
 * June 2026 close repair — one-shot data repair for period 2026-06.
 *
 * Clears period-close checklist items 2 (bank reconciliation), 3 (wallet
 * integrity), and 8 (VAT consolidation) so 2026-06 can be soft-locked then
 * hard-locked. Decision taken 2026-07-31: leave the filed June PVN
 * declaration (EDS 115617621, €13.66) untouched; claim both late-surfacing
 * invoices in the July tax period via a `tax_period` divergence from
 * `accounting_period` — the first time these two fields differ in this
 * ledger. Requires `getNetVatPositionForPeriod` (queries.ts) to sweep by
 * `tax_period` rather than `accounting_period` — see that function's JSDoc.
 *
 * Four steps, each independently idempotent (checked via
 * `checkIdempotency` / a pre-fetch of the row it corrects, not just
 * "run once"):
 *
 *   1. Swedbank e-invoice V0000897245 (€0.72, 15.06) — unposted I.1. Cash leg
 *      MUST sit in accounting_period=2026-06 (bank rec compares GL closing
 *      against the recorded June statement balance) with
 *      tax_period=2026-07 (input VAT claimed in July per the above decision).
 *   2. Unisend invoice 2601925 (€43.92, 30.06, paid 08.07) — unposted I.1,
 *      same accounting_period/tax_period split, on invoice-date convention
 *      (2026-07-31 decision — see plan §5 open question 1).
 *   3. Two C.2 cart-payment entries (`june_2026_entry_66`, `_51`) whose 5351
 *      buyer line has `counterparty_type='buyer'` but `counterparty_id`
 *      NULL. Amounts are correct; only attribution is missing. Fixed via
 *      reversal (mirrors the original lines exactly, flipped, carrying
 *      `reverses_entry_id`) + repost (same C.2 event replayed through the
 *      engine with `payload.buyer_counterparty_id` now supplied). These are
 *      the FIRST reversal entries in this ledger — the shape here
 *      (entry_type='reversal', type_id unchanged, correction_reason set only
 *      on the reversal, repost carries no reverses_entry_id) is the
 *      precedent for future corrections. The reversal is built directly via
 *      the `insert_journal_entry` RPC primitive (confirmed accepting
 *      `reverses_entry_id` / `correction_reason` in migration 097) because
 *      no mapping-table type produces arbitrary mirror-image lines for an
 *      existing entry — `emit()` always recomputes from a payload, which
 *      would reproduce the original (uncorrected) shape, not its inverse.
 *   4. Trigger `monthly-vat-close` for June (best-effort HTTP POST against
 *      CRON_BASE_URL, mirroring the Coolify curl invocation) so June's P.1
 *      carries `emission_source='cron'` — the intended long-term source now
 *      that the cron is expected to be registered. MUST run before
 *      2026-08-01: `computeTargetPeriod` targets the previous month, so on
 *      1 August it targets July and June never gets a P.1. If unreachable,
 *      prints the manual curl command instead of failing the script.
 *
 * Usage:
 *   npx tsx scripts/june-2026-close-repair.ts               # full run + recheck
 *   npx tsx scripts/june-2026-close-repair.ts --dry-run     # log planned actions, no writes
 *   CRON_BASE_URL=https://... npx tsx scripts/june-2026-close-repair.ts  # step 4 target override
 *
 * Env: reads `.env.local` for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Step 4 additionally reads CRON_SECRET (required) and CRON_BASE_URL
 * (defaults to http://localhost:3000, matching the Coolify-local convention
 * documented in CLAUDE.md's Cron Routes section).
 *
 * Failure modes:
 *   - Pre-flight halt: 2026-06 not seeded as `open`.
 *   - Step 3 halt: original entry not found, or its buyer line already has a
 *     non-null counterparty_id (repair may already be applied by another
 *     path — investigate rather than re-running blindly).
 *   - Step 4 non-fatal: cron unreachable just prints the manual curl command;
 *     the script still reports success for steps 1-3.
 */

import './_load-env';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import { getPeriodCloseChecklist } from '@/lib/accounting/checklist';
import { assertBalanced, requireNumber, requireString } from '@/lib/accounting/computer';
import { checkIdempotency } from '@/lib/accounting/idempotency';
import { resolveOrCreateBuyerCounterparty } from '@/lib/accounting/lifecycle-wraps';
import { emit } from '@/lib/accounting/posting-engine';
import { getPeriodRow } from '@/lib/accounting/queries';
import type { PostingEvent } from '@/lib/accounting/types';
import { logAuditEvent } from '@/lib/services/audit';

const CREATED_BY = 'june_2026_close_repair';
const PERIOD_KEY = '2026-06';

// Existing counterparties (NOT re-seeded — referenced only; must already
// exist from the May / June 2026 backfills).
const SWEDBANK_CP_ID = 'a4444444-4444-4444-8444-444444444444';
const UNISEND_CP_ID = 'a9999999-9999-4999-8999-999999999999';

// Buyer user_ids for the two C.2 entries being corrected (per the plan's
// source-document review).
const G6QC_BUYER_USER_ID = '630f6e7f-95cb-41fa-a98f-a4d199aa32fe'; // Aigars
const E93F_BUYER_USER_ID = '880caa98-9098-4364-bd86-5bde6410992e';

function tag(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backfill: true,
    june_2026_close_repair: true,
    ...extra
  };
}

// =============================================================================
// Step 1 — Swedbank e-invoice V0000897245
// =============================================================================

export function buildSwedbankInvoiceEvent(): PostingEvent {
  return {
    event_type: 'vendor.invoice_received',
    source_doc_type: 'vendor_invoice',
    source_doc_id: 'june_2026_entry_68',
    posting_date: '2026-06-15',
    accounting_period: '2026-06',
    tax_period: '2026-07',
    emission_source: 'backfill',
    narrative:
      'Swedbank e-commerce platform invoice V0000897245 (01–15.06.2026) — 3× ' +
      'payment-initiation commission €0.10 + 3× transaction processing €0.10; ' +
      'net €0.60 + 21% LV VAT €0.12; debited 15.06 from LV89HABA0551062053777. ' +
      'Input VAT claimed in the July tax period per 2026-07-31 decision — June ' +
      'declaration EDS 115617621 filed without it.',
    counterparty_id: SWEDBANK_CP_ID,
    payload: tag({
      invoice_net_cents: 60,
      invoice_vat_cents: 12,
      expense_account: '7710',
      payable_account: '2610',
      vat_treatment: 'standard',
      vendor_invoice_number: 'V0000897245',
      vendor_vat_number: 'LV40003074764',
      invoice_date: '2026-06-15'
    })
  };
}

// =============================================================================
// Step 2 — Unisend invoice 2601925
// =============================================================================

export function buildUnisendInvoiceEvent(): PostingEvent {
  return {
    event_type: 'vendor.invoice_received',
    source_doc_type: 'vendor_invoice',
    source_doc_id: 'june_2026_entry_69',
    posting_date: '2026-06-30',
    accounting_period: '2026-06',
    tax_period: '2026-07',
    emission_source: 'backfill',
    narrative:
      'Unisend invoice 2601925 (30.06.2026) — 22 parcel-locker shipments, all ' +
      'June dispatches (dest LV 7, dest EE 10, dest LT 5 — lane codes read as ' +
      'billing account → destination); net €36.30 + 21% LV VAT €7.62; due ' +
      '20.07, paid 08.07. Input VAT claimed in the July tax period per ' +
      '2026-07-31 decision.',
    counterparty_id: UNISEND_CP_ID,
    payload: tag({
      invoice_net_cents: 3630,
      invoice_vat_cents: 762,
      expense_account: '7720',
      vat_treatment: 'standard',
      vendor_invoice_number: '2601925',
      vendor_vat_number: 'LV40203523445',
      invoice_date: '2026-06-30',
      parcel_dest_breakdown: 'LV 7, EE 10, LT 5'
    })
  };
}

// =============================================================================
// Step 3 — C.2 wallet-attribution reversal + repost
// =============================================================================

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

interface OriginalCartEntry {
  id: string;
  source_doc_id: string;
  posting_date: string;
  accounting_period: string;
  tax_period: string;
  posting_context: Record<string, unknown>;
  lines: RawLine[];
}

async function fetchOriginalCartPaymentEntry(
  supabase: SupabaseClient,
  sourceDocId: string
): Promise<OriginalCartEntry> {
  const { data: entryRow, error: entryErr } = await supabase
    .from('journal_entries')
    .select('id, posting_date, accounting_period, tax_period, posting_context')
    .eq('source_doc_type', 'cart_payment')
    .eq('source_doc_id', sourceDocId)
    .eq('type_id', 'C.2')
    .maybeSingle();
  if (entryErr) {
    throw new Error(`fetchOriginalCartPaymentEntry(${sourceDocId}): journal_entries SELECT failed: ${entryErr.message}`);
  }
  if (!entryRow) {
    throw new Error(`fetchOriginalCartPaymentEntry(${sourceDocId}): original C.2 entry not found — cannot build reversal/repost`);
  }
  const row = entryRow as {
    id: string;
    posting_date: string;
    accounting_period: string;
    tax_period: string;
    posting_context: Record<string, unknown>;
  };

  const { data: lineRows, error: lineErr } = await supabase
    .from('journal_lines')
    .select('line_number, account_code, debit_cents, credit_cents, currency, vat_rate_snapshot, vat_country, counterparty_type, counterparty_id, narrative')
    .eq('entry_id', row.id)
    .order('line_number', { ascending: true });
  if (lineErr) {
    throw new Error(`fetchOriginalCartPaymentEntry(${sourceDocId}): journal_lines SELECT failed: ${lineErr.message}`);
  }

  return {
    id: row.id,
    source_doc_id: sourceDocId,
    posting_date: row.posting_date,
    accounting_period: row.accounting_period,
    tax_period: row.tax_period,
    posting_context: row.posting_context ?? {},
    lines: (lineRows ?? []) as RawLine[]
  };
}

/**
 * Defensive cross-check against the plan's documented amounts before writing
 * anything. Also catches the "already repaired" case: if the buyer line
 * already has a non-null counterparty_id, this is NOT the pristine
 * mis-posted entry the plan describes — abort loudly rather than reverse a
 * line that's already correct.
 */
export function assertOriginalCartEntryUnfixed(
  original: OriginalCartEntry,
  expected: { gross_cart_cents: number; buyer_wallet_cents: number }
): void {
  const totalDebit = original.lines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCredit = original.lines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDebit !== expected.gross_cart_cents || totalCredit !== expected.gross_cart_cents) {
    throw new Error(
      `assertOriginalCartEntryUnfixed(${original.source_doc_id}): expected Σdr=Σcr=${expected.gross_cart_cents}, found Σdr=${totalDebit} Σcr=${totalCredit}`
    );
  }
  const buyerLine = original.lines.find((l) => l.counterparty_type === 'buyer');
  if (!buyerLine || buyerLine.debit_cents !== expected.buyer_wallet_cents) {
    throw new Error(
      `assertOriginalCartEntryUnfixed(${original.source_doc_id}): expected a buyer line with debit_cents=${expected.buyer_wallet_cents}, found ${buyerLine ? buyerLine.debit_cents : 'none'}`
    );
  }
  if (buyerLine.counterparty_id !== null && buyerLine.counterparty_id !== undefined) {
    throw new Error(
      `assertOriginalCartEntryUnfixed(${original.source_doc_id}): buyer line already has counterparty_id=${buyerLine.counterparty_id} set — repair may already be applied, investigate before re-running`
    );
  }
}

/** Mirror-image lines: debit/credit swapped, everything else preserved. */
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
  original: OriginalCartEntry,
  opts: { source_doc_id: string; narrative: string; correction_reason: string }
): { entry: Record<string, unknown>; lines: RawLine[] } {
  const lines = buildReversalLines(original.lines);
  assertBalanced(lines);
  const entry: Record<string, unknown> = {
    posting_date: original.posting_date,
    accounting_period: original.accounting_period,
    tax_period: original.tax_period,
    entry_type: 'reversal',
    type_id: 'C.2',
    source_doc_type: 'cart_payment',
    source_doc_id: opts.source_doc_id,
    reverses_entry_id: original.id,
    correction_reason: opts.correction_reason,
    narrative: opts.narrative,
    posting_context: tag({
      emission_source: 'backfill',
      reverses_source_doc_id: original.source_doc_id
    }),
    created_by: CREATED_BY,
    period_close_adjustment: false
  };
  return { entry, lines };
}

/** Replays the original C.2 payload through the engine with buyer_counterparty_id now set. */
export function buildRepostEvent(
  original: OriginalCartEntry,
  opts: { source_doc_id: string; narrative: string; buyer_counterparty_id: string }
): PostingEvent {
  const ctx = original.posting_context;
  const gross_cart_cents = requireNumber(ctx, 'gross_cart_cents');
  const buyer_wallet_cents = requireNumber(ctx, 'buyer_wallet_cents');
  const buyer_id = requireString(ctx, 'buyer_id');
  const cart_payment_id = requireString(ctx, 'cart_payment_id');
  const everypay_payment_id = requireString(ctx, 'everypay_payment_id');

  const payload: Record<string, unknown> = tag({
    payment_method: 'bank_link',
    gross_cart_cents,
    buyer_wallet_cents,
    buyer_id,
    cart_payment_id,
    everypay_payment_id,
    buyer_counterparty_id: opts.buyer_counterparty_id,
    corrects_source_doc_id: original.source_doc_id
  });
  if (typeof ctx.bank_account === 'string') payload.bank_account = ctx.bank_account;
  if (typeof ctx.order_id === 'string') payload.order_id = ctx.order_id;

  return {
    event_type: 'everypay.payment_confirmed',
    source_doc_type: 'cart_payment',
    source_doc_id: opts.source_doc_id,
    posting_date: original.posting_date,
    accounting_period: original.accounting_period,
    tax_period: original.tax_period,
    narrative: opts.narrative,
    emission_source: 'backfill',
    payload
  };
}

/**
 * Posts a hand-built entry via the `insert_journal_entry` primitive directly
 * (not `emit()`), mirroring the engine's own idempotency-check / RPC-call /
 * race-recovery / audit-fire sequence. Used only for the reversal entries in
 * step 3, where no mapping-table type produces the required mirror-image
 * lines from an existing entry.
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

  // Fire-and-forget, mirroring posting-engine.ts's fireAccountingPostedAudit
  // — inlined here (rather than reused) since that helper's AssembledEntry
  // shape expects ComputedLine[], and this path builds raw RPC-shaped lines
  // directly rather than through the engine's compute() pipeline.
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

async function repairCartPaymentAttribution(
  supabase: SupabaseClient,
  input: {
    original_source_doc_id: string;
    reversal_source_doc_id: string;
    repost_source_doc_id: string;
    expected_gross_cart_cents: number;
    expected_buyer_wallet_cents: number;
    buyer_user_id: string;
    label: string;
  }
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  const original = await fetchOriginalCartPaymentEntry(supabase, input.original_source_doc_id);
  assertOriginalCartEntryUnfixed(original, {
    gross_cart_cents: input.expected_gross_cart_cents,
    buyer_wallet_cents: input.expected_buyer_wallet_cents
  });

  const { entry: reversalEntry, lines: reversalLines } = buildReversalEntry(original, {
    source_doc_id: input.reversal_source_doc_id,
    narrative: `Reversal of ${input.original_source_doc_id} (${input.label}) — buyer counterparty_id omitted on 5351 line`,
    correction_reason: 'buyer counterparty_id omitted on 5351 line — wallet-integrity attribution repair'
  });
  const reversalResult = await postRawEntry(supabase, reversalEntry, reversalLines);
  results.push({ name: `${input.reversal_source_doc_id} (reversal)`, ...reversalResult });

  const buyerCounterparty = await resolveOrCreateBuyerCounterparty(supabase, input.buyer_user_id);

  const repostEvent = buildRepostEvent(original, {
    source_doc_id: input.repost_source_doc_id,
    narrative: `Repost of ${input.original_source_doc_id} (${input.label}) with buyer counterparty_id attributed`,
    buyer_counterparty_id: buyerCounterparty.id
  });
  const repostResult = await emit(supabase, repostEvent);
  if (repostResult.status === 'failed') {
    throw new Error(`repost ${input.repost_source_doc_id} failed: ${repostResult.error}`);
  }
  results.push({ name: `${input.repost_source_doc_id} (repost)`, ...repostResult });

  return results;
}

// =============================================================================
// Step 4 — trigger monthly-vat-close for June
// =============================================================================

interface CronTriggerResult {
  attempted: boolean;
  ok: boolean;
  detail: string;
}

async function triggerMonthlyVatCloseCron(): Promise<CronTriggerResult> {
  const secret = process.env.CRON_SECRET;
  const baseUrl = process.env.CRON_BASE_URL ?? 'http://localhost:3000';
  if (!secret) {
    return {
      attempted: false,
      ok: false,
      detail:
        'CRON_SECRET not set — skipping automatic trigger. Run manually before 2026-08-01:\n' +
        `    curl -s -X POST -H "Authorization: Bearer \${CRON_SECRET}" ${baseUrl}/api/cron/monthly-vat-close`
    };
  }
  try {
    const res = await fetch(`${baseUrl}/api/cron/monthly-vat-close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` }
    });
    const body = await res.text();
    if (!res.ok) {
      return {
        attempted: true,
        ok: false,
        detail: `cron responded ${res.status}: ${body}. Run manually before 2026-08-01:\n` +
          `    curl -s -X POST -H "Authorization: Bearer \${CRON_SECRET}" ${baseUrl}/api/cron/monthly-vat-close`
      };
    }
    return { attempted: true, ok: true, detail: body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      attempted: true,
      ok: false,
      detail: `cron unreachable (${message}). Run manually before 2026-08-01:\n` +
        `    curl -s -X POST -H "Authorization: Bearer \${CRON_SECRET}" ${baseUrl}/api/cron/monthly-vat-close`
    };
  }
}

// =============================================================================
// Runner
// =============================================================================

interface StepResult {
  name: string;
  status: 'created' | 'idempotent_skip' | 'failed';
  entry_id?: string;
  error?: string;
}

export async function preflightVerifyPeriod(supabase: SupabaseClient): Promise<void> {
  const period = await getPeriodRow(supabase, PERIOD_KEY, 'month');
  if (!period) {
    throw new Error(`pre-flight: period ${PERIOD_KEY} not seeded in public.periods (period_type=month).`);
  }
  if (period.status !== 'open') {
    throw new Error(
      `pre-flight: period ${PERIOD_KEY} has status='${period.status}', expected 'open'. ` +
      'Soft/hard-locked periods reject backfill emits via the period-status trigger.'
    );
  }
}

export async function runRepair(supabase: SupabaseClient): Promise<StepResult[]> {
  const results: StepResult[] = [];

  const swedbankResult = await emit(supabase, buildSwedbankInvoiceEvent());
  results.push({ name: 'june_2026_entry_68 (Swedbank I.1)', ...swedbankResult });
  if (swedbankResult.status === 'failed') return results;

  const unisendResult = await emit(supabase, buildUnisendInvoiceEvent());
  results.push({ name: 'june_2026_entry_69 (Unisend I.1)', ...unisendResult });
  if (unisendResult.status === 'failed') return results;

  const g6qcResults = await repairCartPaymentAttribution(supabase, {
    original_source_doc_id: 'june_2026_entry_66',
    reversal_source_doc_id: 'june_2026_entry_66x',
    repost_source_doc_id: 'june_2026_entry_66r',
    expected_gross_cart_cents: 3690,
    expected_buyer_wallet_cents: 3690,
    buyer_user_id: G6QC_BUYER_USER_ID,
    label: 'G6QC'
  });
  results.push(...g6qcResults);

  const e93fResults = await repairCartPaymentAttribution(supabase, {
    original_source_doc_id: 'june_2026_entry_51',
    reversal_source_doc_id: 'june_2026_entry_51x',
    repost_source_doc_id: 'june_2026_entry_51r',
    expected_gross_cart_cents: 3320,
    expected_buyer_wallet_cents: 2250,
    buyer_user_id: E93F_BUYER_USER_ID,
    label: 'E93F'
  });
  results.push(...e93fResults);

  return results;
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

  console.log(`\nJune 2026 close repair ${cli.dryRun ? '(DRY RUN)' : ''}`);
  console.log(`Target Supabase: ${env.url}\n`);

  console.log(`Pre-flight: checking period ${PERIOD_KEY}...`);
  await preflightVerifyPeriod(supabase);
  console.log(`Pre-flight: period ${PERIOD_KEY} seeded as \`open\`. ✓\n`);

  if (cli.dryRun) {
    console.log('--dry-run mode: planned steps (no DB writes):');
    console.log('  1. june_2026_entry_68  Swedbank I.1  €0.72 (net €0.60 + VAT €0.12), tax_period=2026-07');
    console.log('  2. june_2026_entry_69  Unisend I.1   €43.92 (net €36.30 + VAT €7.62), tax_period=2026-07');
    console.log('  3. june_2026_entry_66x/66r  reversal + repost — G6QC buyer attribution (€36.90)');
    console.log('     june_2026_entry_51x/51r  reversal + repost — E93F buyer attribution (€33.20 cart, €22.50 wallet leg)');
    console.log('  4. trigger monthly-vat-close for 2026-06 (best-effort HTTP call)');
    return;
  }

  const startedAt = Date.now();
  const results = await runRepair(supabase);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const r of results) {
    if (r.status === 'created') {
      console.log(`  ✓ ${r.name.padEnd(40)} created     entry_id=${r.entry_id}`);
    } else if (r.status === 'idempotent_skip') {
      console.log(`  ⟳ ${r.name.padEnd(40)} idem_skip   entry_id=${r.entry_id}`);
    } else {
      console.error(`  ✗ ${r.name.padEnd(40)} FAILED      ${r.error}`);
    }
  }

  const failed = results.filter((r) => r.status === 'failed').length;
  console.log(`\nSteps 1-3: ${results.length - failed} ok, ${failed} failed (${elapsedSec}s)`);

  if (failed > 0) {
    console.error('\nRepair halted. Investigate the failure above, fix, re-run (committed entries idempotent_skip).');
    process.exit(1);
  }

  console.log('\nStep 4: triggering monthly-vat-close for 2026-06...');
  const cronResult = await triggerMonthlyVatCloseCron();
  console.log(cronResult.ok ? `  ✓ ${cronResult.detail}` : `  ⚠ ${cronResult.detail}`);

  console.log(`\nRe-checking period-close checklist for ${PERIOD_KEY}...`);
  const checklist = await getPeriodCloseChecklist(supabase, PERIOD_KEY);
  for (const item of checklist.items.filter((i) => [2, 3, 8].includes(i.id))) {
    const marker = item.status === 'pass' || item.status === 'not_applicable' ? '✓' : '✗';
    console.log(`  ${marker} Item ${item.id} [${item.status}]: ${item.detail}`);
  }
  console.log(`\ncan_soft_lock=${checklist.can_soft_lock}`);
}

const isDirectInvocation = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectInvocation) {
  runMain().catch((err: unknown) => {
    console.error('\nRepair aborted:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
}
