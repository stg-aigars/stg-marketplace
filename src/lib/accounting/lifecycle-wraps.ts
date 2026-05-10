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
import { logAuditEvent } from '@/lib/services/audit';

import { lookupVatRate, roundHalfUpCents, splitInclusiveVat } from './computer';
import { assembleEntryForRpc, type AssembledEntry } from './posting-engine';
import {
  buildOrderCompletionEvent,
  buildRefundEvent,
  buildRefundCashLegEvent,
  type RefundType
} from './lifecycle-events';
import type { ComputedLine } from './types';

const COMMISSION_RATE = 0.1;

/**
 * Fire `accounting.posted` regulatory audit event for a GL entry written
 * via a parent RPC. Mirrors the pattern in `posting-engine.ts:emit()`,
 * but called from the service-layer wrap because parent RPCs use
 * `PERFORM insert_journal_entry` in PL/pgSQL — the engine's TS-side
 * audit fire never runs along that path. Without this, lifecycle GL
 * writes would be missing from `audit_log` (the same gap that caused
 * the Phase 0 backfill audit drop documented in CLAUDE.md).
 *
 * Fire-and-forget; failures log but never block the caller.
 */
function fireAccountingPostedAudit(
  supabase: SupabaseClient,
  entryId: string,
  assembled: AssembledEntry,
  actorId: string | undefined
): void {
  const entry = assembled.rpcEntry;
  const isUuidActor =
    typeof actorId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);
  void logAuditEvent(supabase, {
    actorId: isUuidActor ? actorId : undefined,
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
      created_by: (entry.created_by as string | undefined) ?? 'lifecycle_wrap'
    },
    retentionClass: 'regulatory'
  }).catch((err: unknown) => {
    console.error(`accounting.posted audit write failed (entry_id=${entryId}): ${String(err)}`);
  });
}

interface OrderForCompletion {
  id: string;
  seller_id: string;
  seller_country: 'LV' | 'LT' | 'EE';
  items_total_cents: number;
  shipping_cost_cents: number;
  order_number: string;
  cart_group_id: string | null;
}

export type CompletionSource = 'delivery_confirmed' | 'auto_complete' | 'dispute_no_refund';

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
 * SILENT-DRIFT WARNING — counterparty.tax_status default = 'private':
 *
 * Today's user_profiles schema only carries `country` and `full_name`. The
 * accounting catalog supports B2B reverse-charge routing (O.2 LT, O.4 EE),
 * but those types require counterparty.tax_status='vat_registered' AND a
 * non-null vies_verified_at — neither of which user_profiles can source
 * today. Every counterparty created here defaults to `tax_status='private'`,
 * meaning B2B sellers (if any exist on the marketplace) post their
 * completions to O.3 (LT B2C OSS) or O.5 (EE B2C OSS) instead of O.2 / O.4.
 *
 * This is a marketplace data-model gap, not an accounting bug. The catalog
 * is correct; it has no source data for vat_registered status. When
 * `user_profiles.tax_status`, `user_profiles.vat_number`,
 * `user_profiles.vies_verified_at` ship in a future PR (alongside the
 * collection UX), this resolver gets updated to source those fields.
 * Because counterparty identity is snapshotted at first-transaction time
 * per migration 093's contract, existing counterparties are NOT
 * retroactively updated — the marketplace fix would also need to amend
 * each affected seller's counterparty (or accept the historical drift).
 *
 * If a seller's tax classification changes between transactions, that's
 * the SAME concern the snapshot model already accepts: counterparty
 * snapshots a point-in-time identity; subsequent UX-driven changes to the
 * source of truth (user_profiles) require an explicit reconciliation step.
 *
 * See CLAUDE.md "Accounting Module" → "counterparty.tax_status default" for
 * the canonical statement.
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
  order: OrderForCompletion,
  completionSource: CompletionSource = 'delivery_confirmed'
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
    completion_source: completionSource,
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

  if (result.journal_entry_id) {
    fireAccountingPostedAudit(supabase, result.journal_entry_id, assembled, order.seller_id);
  }

  if (result.orphan) {
    void trackServer(
      'accounting.orphan_emit_skipped',
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

// ---------------------------------------------------------------------------
// refundOrderWithGL — flag-ON path for order-refund.ts:refundOrder
// ---------------------------------------------------------------------------

interface OrderForRefund {
  id: string;
  seller_id: string;
  order_number: string;
  invoice_number: string | null;
  credit_note_number: string | null;
  items_total_cents: number;
  shipping_cost_cents: number;
  total_amount_cents: number;
  /** 'card' | 'bank_link' | 'wallet' | null. Drives C.5 funding_source. */
  payment_method: string | null;
  cart_group_id: string | null;
}

interface RefundExecutionResult {
  /** Card-leg amount actually refunded via EveryPay. */
  card_refunded: number;
  /** Wallet-leg amount actually refunded (intra-platform; no GL cash leg). */
  wallet_refunded: number;
  /** card_refunded + wallet_refunded — total for the orders.refund_amount_cents update. */
  total_refunded: number;
  /** Resolved refund_status for orders.refund_status: 'completed' / 'partial' / 'failed'. */
  refund_status: 'completed' | 'partial' | 'failed';
}

interface RefundOrderWithGLResult {
  refund_entry_id: string | null;
  cash_leg_entry_id: string | null;
  orphan: boolean;
  idempotent_skip: boolean;
}

/**
 * Maps an O.x antecedent type id to its v1.4 routing parameters: which VAT
 * country tags the revenue lines, which clearing account receives output
 * VAT (or null for B2B reverse-charge — no VAT line emitted). The mapping
 * mirrors the dispatcher routing in mapping.ts; kept inline here to avoid
 * a roundtrip through the dispatcher just to recover routing for the
 * refund-side reversal.
 */
function vatRoutingForCompletionType(typeId: string): {
  vat_country: 'LV' | 'LT' | 'EE';
  vat_account: string | null;
} {
  switch (typeId) {
    case 'O.1':
      return { vat_country: 'LV', vat_account: '5710-LV-OUT' };
    case 'O.2':
      return { vat_country: 'LT', vat_account: null };
    case 'O.3':
      return { vat_country: 'LT', vat_account: '5711' };
    case 'O.4':
      return { vat_country: 'EE', vat_account: null };
    case 'O.5':
      return { vat_country: 'EE', vat_account: '5712' };
    default:
      throw new Error(`vatRoutingForCompletionType: unrecognised antecedent type_id ${typeId}`);
  }
}

/**
 * Builds the refund-side reversal lines for O.7 / O.8. Mirrors the
 * v1.4 5-line completion entry shape (per accountant signoff doc) but
 * inverted: each Cr in the original becomes a Dr in the refund, and the
 * original Dr 5590 (suspense release) becomes Cr 2351 (refund clearing —
 * money pending bank-side disbursement; cleared by the C.5 cash leg in
 * the same atomic transaction).
 *
 * Math symmetry with completion: Σ Dr (refund) = gross_cart, identical to
 * Σ Cr (completion). Σ Cr (refund) = gross_cart from Cr 2351 alone.
 *
 * For B2B RC (vat_account=null): VAT line omitted; commission_net = gross,
 * shipping_net = gross. Σ still balances at gross_cart.
 */
function buildOrderRefundReversalLines(input: {
  counterparty_id: string;
  item_value_cents: number;
  shipping_value_cents: number;
  vat_rate: number;
  vat_country: 'LV' | 'LT' | 'EE';
  vat_account: string | null;
  context_label: string;
}): ComputedLine[] {
  const commission_gross = roundHalfUpCents(input.item_value_cents * COMMISSION_RATE);
  const seller_net = input.item_value_cents - commission_gross;
  const gross_cart = input.item_value_cents + input.shipping_value_cents;
  const commission = splitInclusiveVat(commission_gross, input.vat_rate);
  const shipping = splitInclusiveVat(input.shipping_value_cents, input.vat_rate);
  const total_vat = commission.vat_cents + shipping.vat_cents;

  const lines: ComputedLine[] = [];

  if (seller_net > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: '5351',
      debit_cents: seller_net,
      credit_cents: 0,
      currency: 'EUR',
      counterparty_type: 'seller',
      counterparty_id: input.counterparty_id,
      narrative: `Seller wallet — refund reversal of sale proceeds (${input.context_label})`
    });
  }

  if (commission.net_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: '6310-C',
      debit_cents: commission.net_cents,
      credit_cents: 0,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      counterparty_type: 'seller',
      counterparty_id: input.counterparty_id,
      narrative: `Commission revenue refund reversal (${input.context_label})`
    });
  }

  if (shipping.net_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: '6310-S',
      debit_cents: shipping.net_cents,
      credit_cents: 0,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      counterparty_type: 'seller',
      counterparty_id: input.counterparty_id,
      narrative: `Shipping-mgmt revenue refund reversal (${input.context_label})`
    });
  }

  if (input.vat_account !== null && total_vat > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: input.vat_account,
      debit_cents: total_vat,
      credit_cents: 0,
      currency: 'EUR',
      vat_country: input.vat_country,
      narrative: `Output VAT refund reversal (${input.context_label})`
    });
  }

  lines.push({
    line_number: lines.length + 1,
    account_code: '2351',
    debit_cents: 0,
    credit_cents: gross_cart,
    currency: 'EUR',
    narrative: `Refund clearing — pending bank settlement (${input.context_label})`
  });

  return lines;
}

/**
 * Flag-ON path for order-refund.ts:refundOrder. Reads the antecedent
 * O.x completion entry (if any), decides routing (O.7 current period vs
 * O.8 prior period — full refunds only for commit 7; partial refunds
 * deferred until refundOrder gains item/shipping decomposition support),
 * pre-computes reversal lines, builds events, calls
 * order_refund_with_event_atomic to compose state mutation + GL emits.
 *
 * Orphan path: when no O.x antecedent exists (cutover-window orders or
 * never-completed orders being cancelled-then-refunded), the wrap passes
 * NULL p_event so the parent RPC skips the refund-side O.x emit. The
 * cash leg (C.5) still fires when card_refunded > 0 — actual STG cash
 * leaving Swedbank/EveryPay regardless of whether revenue was ever
 * recognised. Telemetry fires on orphan return.
 *
 * Wallet-only refunds (card_refunded == 0): no C.5 emit (no STG cash
 * left the books; the wallet refund is intra-platform).
 */
export async function refundOrderWithGL(
  supabase: SupabaseClient,
  order: OrderForRefund,
  refundResult: RefundExecutionResult
): Promise<RefundOrderWithGLResult> {
  const counterpartyId = await resolveSellerCounterparty(supabase, order.seller_id);

  const today = new Date().toISOString().split('T')[0];
  const period = today.substring(0, 7);

  // Look up the antecedent O.x completion entry (if any) to route refund-side
  // dispatch and to derive vat_country / vat_account from its type_id.
  const { data: antecedent, error: antecedentErr } = await supabase
    .from('journal_entries')
    .select('id, type_id, tax_period')
    .eq('source_doc_type', 'order')
    .eq('source_doc_id', order.id)
    .in('type_id', ['O.1', 'O.2', 'O.3', 'O.4', 'O.5'])
    .maybeSingle();
  if (antecedentErr) {
    throw new Error(`refundOrderWithGL antecedent lookup failed for order ${order.id}: ${antecedentErr.message}`);
  }

  let refundEntryRpc: AssembledEntry | null = null;

  if (antecedent) {
    const refundType: RefundType =
      antecedent.tax_period === period ? 'full_current' : 'full_prior';
    const routing = vatRoutingForCompletionType(antecedent.type_id);
    const lookedUpRate = await lookupVatRate(supabase, routing.vat_country, today);
    // For B2B RC (vat_account=null), splitInclusiveVat with vat_rate=0
    // collapses to net=gross / vat=0 — correct shape; no VAT line emitted.
    const effectiveVatRate = routing.vat_account === null ? 0 : (lookedUpRate ?? 0);

    const lines = buildOrderRefundReversalLines({
      counterparty_id: counterpartyId,
      item_value_cents: order.items_total_cents,
      shipping_value_cents: order.shipping_cost_cents,
      vat_rate: effectiveVatRate,
      vat_country: routing.vat_country,
      vat_account: routing.vat_account,
      context_label: `${routing.vat_country}, refund of ${order.order_number}`
    });

    const refundEvent = buildRefundEvent({
      refund_type: refundType,
      order_id: order.id,
      seller_counterparty_id: counterpartyId,
      original_invoice_number: order.invoice_number ?? order.order_number,
      credit_note_number: order.credit_note_number ?? `STG-CN-PENDING-${order.order_number}`,
      original_invoice_id: refundType === 'full_prior' ? antecedent.id : undefined,
      original_period: refundType === 'full_prior' ? antecedent.tax_period : undefined,
      lines: lines as unknown as ReadonlyArray<unknown>,
      posting_date: today,
      accounting_period: period,
      tax_period: period
    });
    refundEntryRpc = await assembleEntryForRpc(supabase, refundEvent);
  }

  // C.5 cash leg fires when actual STG cash left the books. Wallet-only
  // refunds (card_refunded == 0) skip C.5: the buyer's wallet is credited
  // intra-platform; no Swedbank/EveryPay cash movement to record.
  let cashLegRpc: AssembledEntry | null = null;
  if (refundResult.card_refunded > 0) {
    const fundingSource = order.payment_method === 'bank_link' ? 'bank' : 'everypay';
    const cashLegEvent = buildRefundCashLegEvent({
      order_id: order.id,
      refund_reference: `STG-RF-${period}-${order.order_number}`,
      refund_cents: refundResult.card_refunded,
      funding_source: fundingSource,
      posting_date: today,
      accounting_period: period,
      tax_period: period
    });
    cashLegRpc = await assembleEntryForRpc(supabase, cashLegEvent);
  }

  const { data, error } = await supabase.rpc('order_refund_with_event_atomic', {
    p_order_id: order.id,
    p_actor_id: order.seller_id,
    p_refund_amount_cents: refundResult.total_refunded,
    p_refund_status: refundResult.refund_status,
    p_event: refundEntryRpc?.rpcEntry ?? null,
    p_lines: refundEntryRpc ? (refundEntryRpc.rpcLines as unknown as Record<string, unknown>[]) : null,
    p_cash_leg_event: cashLegRpc?.rpcEntry ?? null,
    p_cash_leg_lines: cashLegRpc ? (cashLegRpc.rpcLines as unknown as Record<string, unknown>[]) : null
  });

  if (error) {
    throw new Error(`order_refund_with_event_atomic failed (${error.code ?? 'unknown'}): ${error.message}`);
  }

  const result = data as RefundOrderWithGLResult;

  if (result.refund_entry_id && refundEntryRpc) {
    fireAccountingPostedAudit(supabase, result.refund_entry_id, refundEntryRpc, order.seller_id);
  }
  if (result.cash_leg_entry_id && cashLegRpc) {
    fireAccountingPostedAudit(supabase, result.cash_leg_entry_id, cashLegRpc, order.seller_id);
  }

  if (result.orphan) {
    void trackServer(
      'accounting.orphan_emit_skipped',
      order.seller_id,
      {
        orphan_type: 'refund',
        order_id: order.id,
        cart_payment_id: order.cart_group_id,
        expected_antecedent_type_ids: ['O.1', 'O.2', 'O.3', 'O.4', 'O.5'] as const,
        service_file: 'order-refund.ts'
      }
    );
  }

  return result;
}
