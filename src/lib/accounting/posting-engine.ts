/**
 * Posting engine — orchestrator (PR #2).
 *
 * Single entry point: emit(event). Pipeline:
 *
 *   1. validate event shape (engine-required keys: source_doc_type, …)
 *   2. load counterparty (if event.counterparty_id present)
 *   3. dispatch → VatMappingEntry
 *   4. validate posting_context_required_keys against payload
 *   5. KYC gate (if entry.id === 'C.4')
 *   6. lookup vat_rate (if entry.vat_rate_country)
 *   7. compute → ComputedLine[] + posting_context_extras
 *   8. assertBalanced (fail-fast before RPC)
 *   9. idempotency dedup SELECT
 *  10. RPC insert_journal_entry
 *  11. on unique_violation, recover via fresh idempotency SELECT
 *  12. fire-and-forget logAuditEvent('accounting.posted', regulatory)
 *  13. return PostingResult
 *
 * Atomicity: the RPC is the transaction unit (single PL/pgSQL function call =
 * single Postgres transaction). All triggers from migration 094 (period
 * status, balanced entry deferred, immutability) fire transparently.
 *
 * Idempotency two-layer: pre-RPC SELECT catches the dominant retry case
 * cheaply; DB UNIQUE on (source_doc_type, source_doc_id, type_id) catches
 * the race where two concurrent emit() calls both pass the SELECT. Loser of
 * the race re-queries (fresh transaction; READ COMMITTED makes the winner's
 * committed row visible) and returns idempotent_skip.
 *
 * Audit: `accounting.posted` is regulatory-retention (10y, financial audit
 * obligation). Fire-and-forget per CLAUDE.md, but failures route to Sentry
 * as warnings (not silent) so a sustained pattern of audit-write failures
 * surfaces.
 */

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logAuditEvent } from '@/lib/services/audit';

import { assertPayoutAllowed } from './compliance-gate';
import { assertBalanced, lookupVatRate } from './computer';
import { dispatch } from './dispatcher';
import {
  PostingComplianceGateError,
  PostingIdempotencyConflict,
  PostingValidationError
} from './errors';
import { checkIdempotency } from './idempotency';
import type {
  ComputeInput,
  ComputedLine,
  CounterpartyRow,
  DispatchContext,
  PostingEvent,
  PostingResult,
  VatMappingEntry
} from './types';

const POSTGRES_UNIQUE_VIOLATION = '23505';

/** Default `created_by` stamped on engine-emitted entries when the caller does not supply one. */
const DEFAULT_CREATED_BY = 'posting_engine';

/**
 * Lower-case UUID v1-v8 shape check. Used before stamping `actorId` on the
 * audit_log row, since `audit_log.actor_id` is `uuid REFERENCES auth.users`
 * — non-UUID values silently fail the FK constraint. Synthetic actors
 * (cron, posting_engine, system) must be encoded via `actorType` + metadata,
 * not via `actorId`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Fire `accounting.posted` regulatory audit event for a successful GL
 * write. Used by both `emit()` (engine call site) and PR #5 lifecycle
 * wraps (parent-RPC call sites that bypass `emit` to compose marketplace
 * state mutations + GL emit atomically). Without this called from the
 * wrap path, GL entries written via `PERFORM insert_journal_entry` would
 * be missing from `audit_log` (the same gap that caused the Phase 0
 * backfill audit drop documented in CLAUDE.md).
 *
 * Fire-and-forget; failures route to Sentry as `warning`. The GL entry
 * already succeeded — audit failure is observability, not integrity.
 *
 * `actorCreatedBy` accepts the event's `created_by` (or any actor id);
 * UUID-validated since `audit_log.actor_id` is `uuid REFERENCES auth.users`.
 * Synthetic identities (cron, posting_engine, system) are encoded via
 * `actorType='system'` + `metadata.created_by`, never as `actorId`.
 */
export function fireAccountingPostedAudit(
  supabase: SupabaseClient,
  entryId: string,
  assembled: AssembledEntry,
  actorCreatedBy: string | undefined
): void {
  const entry = assembled.rpcEntry;
  void logAuditEvent(supabase, {
    actorId: isUuid(actorCreatedBy) ? actorCreatedBy : undefined,
    actorType: 'system',
    action: 'accounting.posted',
    resourceType: 'journal_entry',
    resourceId: entryId,
    metadata: {
      type_id: assembled.type_id,
      source_doc_type: entry.source_doc_type as string,
      source_doc_id: entry.source_doc_id as string,
      accounting_period: entry.accounting_period as string,
      tax_period: entry.tax_period as string,
      created_by: (entry.created_by as string | undefined) ?? DEFAULT_CREATED_BY
    },
    retentionClass: 'regulatory'
  }).catch((err: unknown) => {
    Sentry.captureMessage(
      `accounting.posted audit write failed (entry_id=${entryId}): ${String(err)}`,
      'warning'
    );
  });
}

/**
 * Result of `assembleEntryForRpc` — the inputs that `insert_journal_entry`
 * needs (rpcEntry + rpcLines) plus the dispatched type_id for idempotency
 * lookup. Used by both `emit()` (the engine's own RPC call site) and PR #5
 * lifecycle parent RPCs (e.g. `complete_order_with_event_atomic`) that
 * compose the GL emit with marketplace state mutations in a single
 * transaction. The lifecycle wrap calls this helper, then passes the result
 * to the parent RPC along with the order id; the parent RPC PERFORMs
 * `insert_journal_entry(p_event, p_lines)` inline.
 */
export interface AssembledEntry {
  rpcEntry: Record<string, unknown>;
  rpcLines: ComputedLine[];
  type_id: string;
}

/**
 * Engine-internal assembly: validate the event shape, load counterparty,
 * dispatch to a VatMappingEntry, validate required keys, run the KYC gate
 * (C.4 only), resolve the VAT rate, run compute(), assert balance, and
 * build the rpcEntry shape that `insert_journal_entry` expects.
 *
 * `preloadedCounterparty` is an optimization for callers that already have
 * the counterparty row in scope (e.g. lifecycle wraps that resolved the
 * seller counterparty before calling this). When supplied, the engine
 * skips its internal `loadCounterparty` query — saves one DB round-trip
 * per emit. The supplied row's `id` must equal `event.counterparty_id`
 * (validated below).
 *
 * Throws PostingValidationError / PostingComplianceGateError on failure;
 * caller (either `emit` or a lifecycle wrap) handles surfacing.
 */
export async function assembleEntryForRpc(
  supabase: SupabaseClient,
  event: PostingEvent,
  preloadedCounterparty?: CounterpartyRow | null
): Promise<AssembledEntry> {
  validateEventShape(event);

  let counterparty: CounterpartyRow | null;
  if (preloadedCounterparty !== undefined) {
    if (preloadedCounterparty && event.counterparty_id && preloadedCounterparty.id !== event.counterparty_id) {
      throw new PostingValidationError({
        code: 'invalid_event_shape',
        reason: `preloadedCounterparty.id (${preloadedCounterparty.id}) does not match event.counterparty_id (${event.counterparty_id})`
      });
    }
    counterparty = preloadedCounterparty;
  } else {
    counterparty = await loadCounterparty(supabase, event.counterparty_id);
  }

  const ctx: DispatchContext = {
    event_type: event.event_type,
    counterparty,
    payload: event.payload
  };
  const entry = dispatch(ctx);

  validateRequiredKeys(entry, event.payload);

  // KYC gate runs only for type C.4. Throws PostingComplianceGateError on
  // block. Reuses the already-loaded counterparty (no extra DB roundtrip).
  if (entry.id === 'C.4') {
    if (!event.counterparty_id) {
      throw new PostingValidationError({
        code: 'missing_required_key',
        reason: 'C.4 requires event.counterparty_id'
      });
    }
    assertPayoutAllowed(counterparty);
  }

  const vat_rate = await resolveVatRate(supabase, entry, event.posting_date);

  const computeInput: ComputeInput = {
    payload: event.payload,
    counterparty,
    vat_rate,
    posting_date: event.posting_date
  };
  const { lines, posting_context_extras } = entry.compute(computeInput);
  assertBalanced(lines);

  const merged_posting_context = {
    ...event.payload,
    ...posting_context_extras
  };
  const rpcEntry: Record<string, unknown> = {
    posting_date: event.posting_date,
    accounting_period: event.accounting_period,
    tax_period: event.tax_period,
    entry_type: entry.entry_type,
    type_id: entry.id,
    source_doc_type: event.source_doc_type,
    source_doc_id: event.source_doc_id,
    narrative: event.narrative,
    posting_context: merged_posting_context,
    created_by: event.created_by ?? DEFAULT_CREATED_BY,
    period_close_adjustment: event.period_close_adjustment ?? false
  };
  return { rpcEntry, rpcLines: lines, type_id: entry.id };
}

export async function emit(
  supabase: SupabaseClient,
  event: PostingEvent
): Promise<PostingResult> {
  try {
    const assembled = await assembleEntryForRpc(supabase, event);

    // Idempotency dedup (cheap path).
    const idem = await checkIdempotency(
      supabase,
      event.source_doc_type,
      event.source_doc_id,
      assembled.type_id
    );
    if (idem.status === 'idempotent_skip') {
      return idem;
    }

    const { data: entryId, error } = await supabase.rpc('insert_journal_entry', {
      p_entry: assembled.rpcEntry,
      p_lines: assembled.rpcLines
    });

    if (error) {
      // Race: DB UNIQUE caught a concurrent duplicate. Recover via fresh
      // SELECT — winner's committed row is visible under READ COMMITTED.
      if (error.code === POSTGRES_UNIQUE_VIOLATION) {
        const recovery = await checkIdempotency(
          supabase,
          event.source_doc_type,
          event.source_doc_id,
          assembled.type_id
        );
        if (recovery.status === 'idempotent_skip') {
          return recovery;
        }
        // UNIQUE fired but recovery SELECT empty — unrecoverable.
        const conflict = new PostingIdempotencyConflict({
          code: 'unrecoverable_unique_violation',
          reason: 'UNIQUE violation fired but recovery SELECT found no row',
          context: {
            source_doc_type: event.source_doc_type,
            source_doc_id: event.source_doc_id,
            type_id: assembled.type_id
          }
        });
        Sentry.captureException(conflict, { level: 'fatal' });
        throw conflict;
      }
      throw new Error(`RPC insert_journal_entry failed: ${error.code} ${error.message}`);
    }

    if (typeof entryId !== 'string') {
      throw new Error(`RPC insert_journal_entry returned unexpected payload: ${JSON.stringify(entryId)}`);
    }

    fireAccountingPostedAudit(supabase, entryId, assembled, event.created_by);

    return { status: 'created', entry_id: entryId };
  } catch (err) {
    // Engine surfaces all errors as { status: 'failed', error } EXCEPT for
    // the defensive PostingIdempotencyConflict, which is rethrown so the
    // caller can decide how to surface unrecoverable conflicts.
    if (err instanceof PostingIdempotencyConflict) {
      throw err;
    }
    if (
      err instanceof PostingValidationError ||
      err instanceof PostingComplianceGateError
    ) {
      return { status: 'failed', error: `${err.name}[${err.code}]: ${err.reason}` };
    }
    if (err instanceof Error) {
      return { status: 'failed', error: err.message };
    }
    return { status: 'failed', error: String(err) };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function validateEventShape(event: PostingEvent): void {
  for (const key of [
    'event_type',
    'source_doc_type',
    'source_doc_id',
    'posting_date',
    'accounting_period',
    'tax_period',
    'narrative'
  ] as const) {
    if (typeof event[key] !== 'string' || event[key] === '') {
      throw new PostingValidationError({
        code: 'invalid_event_shape',
        reason: `event.${key} is required (string)`,
        context: { received: event[key] }
      });
    }
  }
  if (typeof event.payload !== 'object' || event.payload === null) {
    throw new PostingValidationError({
      code: 'invalid_event_shape',
      reason: 'event.payload must be an object'
    });
  }
}

/**
 * Columns the engine reads off a counterparty: dispatcher routing
 * (country/tax_status/vies_verified_at), vendor invoice posting (vendor_code),
 * KYC gate (legal_compliance_status), and entry-row provenance (id).
 *
 * Explicit projection (vs `select('*')`) keeps the wire payload small and
 * follows the project's hydration-drift convention — adding a new
 * counterparties column does not silently flow into engine flows that don't
 * need it. New columns the engine genuinely needs must be added here.
 */
const COUNTERPARTY_COLUMNS = 'id, type, country, tax_status, vies_verified_at, vendor_code, legal_compliance_status' as const;

async function loadCounterparty(
  supabase: SupabaseClient,
  counterparty_id: string | undefined
): Promise<CounterpartyRow | null> {
  if (!counterparty_id) return null;
  const { data, error } = await supabase
    .from('counterparties')
    .select(COUNTERPARTY_COLUMNS)
    .eq('id', counterparty_id)
    .maybeSingle();
  if (error) {
    throw new PostingValidationError({
      code: 'counterparty_not_found',
      reason: `counterparty SELECT failed for ${counterparty_id}: ${error.message}`,
      context: { counterparty_id }
    });
  }
  if (!data) {
    throw new PostingValidationError({
      code: 'counterparty_not_found',
      reason: `counterparty ${counterparty_id} not found`,
      context: { counterparty_id }
    });
  }
  return data as CounterpartyRow;
}

function validateRequiredKeys(
  entry: VatMappingEntry,
  payload: Record<string, unknown>
): void {
  for (const key of entry.posting_context_required_keys) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      throw new PostingValidationError({
        code: 'missing_required_key',
        reason: `${entry.id} requires payload.${key}`,
        context: { type_id: entry.id, missing_key: key }
      });
    }
  }
}

async function resolveVatRate(
  supabase: SupabaseClient,
  entry: VatMappingEntry,
  posting_date: string
): Promise<number | null> {
  if (!entry.vat_rate_country) return null;
  return lookupVatRate(supabase, entry.vat_rate_country, posting_date);
}
