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
function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export async function emit(
  supabase: SupabaseClient,
  event: PostingEvent
): Promise<PostingResult> {
  try {
    validateEventShape(event);

    const counterparty = await loadCounterparty(supabase, event.counterparty_id);

    const ctx: DispatchContext = {
      event_type: event.event_type,
      counterparty,
      payload: event.payload
    };
    const entry = dispatch(ctx);

    validateRequiredKeys(entry, event.payload);

    // KYC gate runs only for type C.4. Throws PostingComplianceGateError on
    // block; engine surfaces as { status: 'failed', error } below. Reuses the
    // already-loaded counterparty (no extra DB roundtrip).
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

    // Idempotency dedup (cheap path).
    const idem = await checkIdempotency(
      supabase,
      event.source_doc_type,
      event.source_doc_id,
      entry.id
    );
    if (idem.status === 'idempotent_skip') {
      return idem;
    }

    // Build RPC payload.
    const merged_posting_context = {
      ...event.payload,
      ...posting_context_extras
    };
    const rpcEntry = {
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
    const rpcLines = lines;

    const { data: entryId, error } = await supabase.rpc('insert_journal_entry', {
      p_entry: rpcEntry,
      p_lines: rpcLines
    });

    if (error) {
      // Race: DB UNIQUE caught a concurrent duplicate. Recover via fresh
      // SELECT — winner's committed row is visible under READ COMMITTED.
      if (error.code === POSTGRES_UNIQUE_VIOLATION) {
        const recovery = await checkIdempotency(
          supabase,
          event.source_doc_type,
          event.source_doc_id,
          entry.id
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
            type_id: entry.id
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

    // Fire-and-forget audit. Regulatory-retention; failures → Sentry warning.
    // actorId must be a UUID (audit_log.actor_id is uuid REFERENCES auth.users) or
    // omitted entirely (helper coerces undefined → null). The synthetic 'posting_engine'
    // identity is encoded via actorType='system' + metadata.created_by, never as actorId.
    void logAuditEvent(supabase, {
      actorId: isUuid(event.created_by) ? event.created_by : undefined,
      actorType: 'system',
      action: 'accounting.posted',
      resourceType: 'journal_entry',
      resourceId: entryId,
      metadata: {
        type_id: entry.id,
        source_doc_type: event.source_doc_type,
        source_doc_id: event.source_doc_id,
        accounting_period: event.accounting_period,
        tax_period: event.tax_period,
        created_by: event.created_by ?? DEFAULT_CREATED_BY
      },
      retentionClass: 'regulatory'
    }).catch((err: unknown) => {
      Sentry.captureMessage(
        `accounting.posted audit write failed (entry_id=${entryId}): ${String(err)}`,
        'warning'
      );
    });

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
