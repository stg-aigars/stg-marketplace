/**
 * Staff server action — record an EveryPay daily settlement (PR C commit 11a).
 *
 * Fires a C.3 entry (Dr 2610 Swedbank / Cr 2630 EveryPay clearing) so the
 * 2630 EveryPay clearing account drains against actual Swedbank settlements.
 * Without this, 2630 accumulates from C.1 card-cart receipts post-cutover
 * and item 7 of the period-close checklist (2630 closing = 0) fails.
 *
 * Not a marketplace lifecycle event — emits via `emit()` directly rather
 * than through a parent RPC. `emission_source='staff_manual'` discriminates
 * from `'lifecycle'` (commits 9/10), `'cron'` (PR #296 / commit 12), and
 * `'backfill'` (historical reconstruction).
 *
 * Idempotency keyed on bank_statement_reference via the engine's UNIQUE
 * index on (source_doc_type='everypay_settlement', source_doc_id, type_id='C.3').
 *
 * Per PR C commit 11a Q11a-1 / Q11a-2 sign-offs: server action (not API
 * route), plain TS validation (no Zod, consistent with `period-actions.ts`).
 */

'use server';

import { revalidatePath } from 'next/cache';

import { requireServerAuth } from '@/lib/auth/helpers';

import { buildEverypaySettlementEvent } from './lifecycle-events';
import { emit } from './posting-engine';

export interface RecordEverypaySettlementInput {
  bank_statement_reference: string;
  settlement_cents: number;
  /** YYYY-MM-DD; EveryPay batch identifier. */
  batch_date: string;
  /** YYYY-MM-DD; date Swedbank credited STG (drives posting_date + period). */
  settlement_value_date: string;
  /**
   * Cart-payment references included in this batch. Empty array is
   * acceptable — staff can record a settlement before reconciling
   * individual refs, especially during card-rail cutover when the
   * mapping isn't yet automated.
   */
  included_txn_refs: string[];
  /** Optional staff freeform note; whitespace-only treated as absent. */
  posting_context_notes?: string;
}

export type RecordEverypaySettlementResult =
  | { success: true; entry_id: string; status: 'created' | 'idempotent_skip' }
  | { error: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function recordEverypaySettlement(
  input: RecordEverypaySettlementInput
): Promise<RecordEverypaySettlementResult> {
  const { isStaff, user, serviceClient } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  // Validation — plain TS, no Zod (matches src/lib/accounting/period-actions.ts).

  const ref = input.bank_statement_reference?.trim();
  if (!ref) return { error: 'Bank statement reference is required' };

  if (!Number.isInteger(input.settlement_cents) || input.settlement_cents <= 0) {
    return { error: 'Settlement amount must be a positive integer (cents)' };
  }

  if (typeof input.batch_date !== 'string' || !ISO_DATE_RE.test(input.batch_date)) {
    return { error: 'Batch date must be in YYYY-MM-DD format' };
  }

  if (typeof input.settlement_value_date !== 'string' || !ISO_DATE_RE.test(input.settlement_value_date)) {
    return { error: 'Settlement value date must be in YYYY-MM-DD format' };
  }

  if (!Array.isArray(input.included_txn_refs)) {
    return { error: 'included_txn_refs must be an array (caller bug)' };
  }

  // Optional-text-input normalization at the server-action boundary
  // (commit-10 §6 convention — defend at both UI and route boundaries).
  const posting_context_notes =
    typeof input.posting_context_notes === 'string' && input.posting_context_notes.trim().length > 0
      ? input.posting_context_notes.trim()
      : undefined;

  const event = buildEverypaySettlementEvent({
    bank_statement_reference: ref,
    settlement_cents: input.settlement_cents,
    batch_date: input.batch_date,
    settlement_value_date: input.settlement_value_date,
    included_txn_refs: input.included_txn_refs,
    posting_context_notes,
    actor_id: user.id,
  });

  const result = await emit(serviceClient, event);

  if (result.status === 'failed') {
    return { error: result.error };
  }

  // Invalidate affected ledger pages so the staff sees the post-settlement
  // balances immediately on next navigation.
  revalidatePath('/staff/accounting');
  revalidatePath('/staff/accounting/account-ledger/2610');
  revalidatePath('/staff/accounting/account-ledger/2630');
  revalidatePath('/staff/accounting/everypay-settlement');

  return {
    success: true,
    entry_id: result.entry_id,
    status: result.status,
  };
}
