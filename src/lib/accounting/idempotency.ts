/**
 * Idempotency dedup check (PR #2).
 *
 * Pre-RPC SELECT against journal_entries by (source_doc_type, source_doc_id,
 * type_id). Cheap path that catches the dominant case (caller retries the
 * same emit() — webhook redelivery, cron repeat, manual re-run).
 *
 * The DB UNIQUE index `idx_journal_entries_idempotency` (migration 097) is
 * the safety net for the rare race where two concurrent emit() calls both
 * pass this SELECT and both try to INSERT. The loser gets SQLSTATE 23505;
 * recovery happens in posting-engine.ts via a fresh SELECT (READ COMMITTED
 * guarantees the winner's committed row is now visible).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { IdempotencyResult } from './types';

export async function checkIdempotency(
  supabase: SupabaseClient,
  source_doc_type: string,
  source_doc_id: string,
  type_id: string
): Promise<IdempotencyResult> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('source_doc_type', source_doc_type)
    .eq('source_doc_id', source_doc_id)
    .eq('type_id', type_id)
    .maybeSingle();

  if (error) {
    // Bubble up — engine wraps this into PostingResult { status: 'failed' }.
    throw new Error(`Idempotency SELECT failed: ${error.message}`);
  }
  if (data) {
    return { status: 'idempotent_skip', entry_id: data.id };
  }
  return { status: 'fresh' };
}
