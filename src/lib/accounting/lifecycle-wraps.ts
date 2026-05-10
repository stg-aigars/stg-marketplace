/**
 * Service-layer wraps for PR #5 lifecycle integration.
 *
 * Each wrap function is the flag-ON path corresponding to an existing
 * marketplace flow (creditSellerWallet, refundOrder, withdrawal completion,
 * cart fulfillment). The wrap:
 *   1. Builds a PostingEvent via the lifecycle-events helpers
 *   2. Resolves the seller counterparty (lazy-init on first transaction)
 *   3. Calls assembleEntryForRpc to produce the rpcEntry + rpcLines
 *   4. Calls the corresponding parent RPC (Choice 2: pre-built event +
 *      lines passed as jsonb) to atomically compose marketplace state
 *      mutations + GL emit
 *   5. Fires accounting.orphan_completion_emit_skipped telemetry on the
 *      orphan return shape (cutover-window orders with no C.1/C.2 antecedent)
 *
 * Service-layer callers (order-transitions.ts:creditSellerWallet, etc.)
 * gate via isAccountingEngineEnabled(); on flag-OFF the existing flow runs
 * byte-identical to pre-PR-#5 behaviour.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { trackServer } from '@/lib/analytics/track-server';

import { assembleEntryForRpc } from './posting-engine';
import { buildOrderCompletionEvent } from './lifecycle-events';

interface OrderForCompletion {
  id: string;
  seller_id: string;
  seller_country: 'LV' | 'LT' | 'EE';
  items_total_cents: number;
  shipping_cost_cents: number;
  order_number: string;
  cart_group_id: string | null;
}

interface CompleteOrderWithGLResult {
  wallet_txn_id: string | null;
  journal_entry_id: string | null;
  orphan: boolean;
  idempotent_skip: boolean;
}

/**
 * Resolves a seller's counterparty id, creating it lazy-init on first
 * transaction. Per migration 093 schema comment: "Sellers link to auth.users
 * via user_id (snapshotted at first-transaction time, not read-through);
 * identity columns (country, vat_number, iban) are duplicated from
 * user_profiles for audit immutability."
 *
 * Today's user_profiles schema only carries `country` and `full_name` (no
 * tax_status, vat_number, vies_verified_at, iban). The created counterparty
 * defaults to `tax_status='private'` — B2B reverse-charge (O.2/O.4) won't
 * fire until those columns ship on user_profiles in a future PR. That gap
 * is a marketplace concern, not an accounting one — the catalog supports
 * B2B RC; it just has no source data for vat_registered status today.
 */
async function resolveSellerCounterparty(
  supabase: SupabaseClient,
  sellerId: string
): Promise<string> {
  const { data: existing, error: lookupErr } = await supabase
    .from('counterparties')
    .select('id')
    .eq('user_id', sellerId)
    .eq('type', 'seller')
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`resolveSellerCounterparty lookup failed for ${sellerId}: ${lookupErr.message}`);
  }
  if (existing) return existing.id as string;

  // Lazy-init: snapshot user_profiles fields available today.
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, country')
    .eq('id', sellerId)
    .single();
  if (profileErr || !profile) {
    throw new Error(`resolveSellerCounterparty: cannot read user_profile ${sellerId}: ${profileErr?.message ?? 'not found'}`);
  }

  const { data: created, error: insertErr } = await supabase
    .from('counterparties')
    .insert({
      user_id: sellerId,
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
    throw new Error(`resolveSellerCounterparty: counterparty insert failed for ${sellerId}: ${insertErr?.message ?? 'no row returned'}`);
  }
  return created.id as string;
}

/**
 * Flag-ON path for `order-transitions.ts:creditSellerWallet`. Builds the
 * O.1-O.5 completion event, dispatches + computes via the engine assembly
 * helper, and calls `complete_order_with_event_atomic` (migration 104) to
 * compose the marketplace state mutations (orders.status='completed' +
 * wallet credit) atomically with the GL emit.
 *
 * Returns the RPC's response shape; service-layer caller fires telemetry
 * on `orphan: true` (cutover-window orders with no C.1/C.2 antecedent
 * are GL-skipped while the wallet still credits).
 *
 * Throws on error families per CLAUDE.md error contract:
 *   - LIFECYCLE:* (P0001) — caller-input failures (event mismatch, etc.)
 *   - 23505 — idempotency UNIQUE collision (concurrent emit race;
 *     parent RPC bubbles, caller can re-SELECT to confirm)
 *   - 23514 — trigger-raised invariants (period-locked, balanced, immutable)
 *   - other — propagate as Error
 */
export async function completeOrderWithGL(
  supabase: SupabaseClient,
  order: OrderForCompletion
): Promise<CompleteOrderWithGLResult> {
  const counterpartyId = await resolveSellerCounterparty(supabase, order.seller_id);

  const today = new Date().toISOString().split('T')[0];
  const period = today.substring(0, 7);

  const event = buildOrderCompletionEvent({
    order_id: order.id,
    seller_counterparty_id: counterpartyId,
    item_value_cents: order.items_total_cents,
    shipping_value_cents: order.shipping_cost_cents,
    invoice_number: order.order_number,
    completion_source: 'delivery_confirmed',
    posting_date: today,
    accounting_period: period,
    tax_period: period
  });

  const assembled = await assembleEntryForRpc(supabase, event);

  const { data, error } = await supabase.rpc('complete_order_with_event_atomic', {
    p_order_id: order.id,
    p_actor_id: order.seller_id,
    p_event: assembled.rpcEntry,
    p_lines: assembled.rpcLines as unknown as Record<string, unknown>[]
  });

  if (error) {
    throw new Error(`complete_order_with_event_atomic failed (${error.code ?? 'unknown'}): ${error.message}`);
  }

  const result = data as CompleteOrderWithGLResult;

  if (result.orphan) {
    void trackServer(
      'accounting.orphan_completion_emit_skipped',
      order.seller_id,
      {
        orphan_type: 'completion',
        order_id: order.id,
        cart_payment_id: order.cart_group_id,
        expected_antecedent_type_ids: ['C.1', 'C.2'] as const,
        service_file: 'order-transitions.ts'
      }
    );
  }

  return result;
}
