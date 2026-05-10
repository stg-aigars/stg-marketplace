-- 103_lifecycle_parent_rpcs.sql
--
-- PR #5 — Marketplace lifecycle parent RPCs (stubs at this commit; bodies fill
-- in at later commits in the PR alongside their service-layer wraps).
--
-- Four SECURITY DEFINER + search_path='' parent RPCs that wrap marketplace
-- lifecycle hooks (cart fulfillment, order completion, withdrawal completion,
-- order refund) under the ACCOUNTING_ENGINE_ENABLED feature flag. Each will
-- compose a multi-step transaction with PERFORM public.insert_journal_entry
-- (migration 097's primitive) plus the existing marketplace-state writes that
-- live in the corresponding service layer today. Atomicity guarantees: marketplace
-- state and GL emit roll back together if either fails.
--
-- Stubs at this commit raise NOT_IMPLEMENTED with the same RAISE EXCEPTION
-- prefix-coded message convention as migration 097 (POSTING:LABEL, SQLSTATE
-- P0001). Parent-RPC error contract: callers catch four families per CLAUDE.md
-- — caller-input failures (P0001 with POSTING:/LIFECYCLE:), idempotency
-- (23505), trigger-raised invariants (23514), and trigger period-not-seeded
-- (P0001 with POSTING:UNKNOWN_PERIOD).
--
-- Naming convention: each RPC suffixed _with_gl to distinguish from the
-- existing migration 070 wallet RPCs which are GL-free. Future Shape 1 eager
-- withdrawal-firing migration would ship wallet_withdrawal_request_with_gl
-- alongside the present wallet_withdrawal_complete_with_gl (Shape 2 lazy).
--
-- Lock-graph invariant honoured: none of these RPCs read periods.status
-- directly. Period-status gating defers to insert_journal_entry's existing
-- enforce_period_status trigger (migration 099 made it FOR SHARE).
--
-- Companion DDL:
--   - orders.is_staff_test boolean — gates GL emission during the production
--     staff-only burn-in stage of the rollout. Application contract: parent
--     RPCs check this before emitting; once flag is global the column becomes
--     vestigial.

-- ============================================================================
-- 1. orders.is_staff_test column
-- ============================================================================

alter table public.orders
  add column is_staff_test boolean not null default false;

comment on column public.orders.is_staff_test is
  'Application contract: parent RPCs (cart_complete_payment_with_gl, complete_order_with_gl, etc.) check this during the staff-only burn-in stage of the ACCOUNTING_ENGINE_ENABLED rollout. Real customer orders skip GL emission until the global stage; staff test orders emit GL through the full pipeline. Once flag is global the column becomes vestigial (kept for audit/test reproducibility).';

-- ============================================================================
-- 2. cart_complete_payment_with_gl — wraps payment-fulfillment.ts:fulfillCartPayment
-- ============================================================================

create or replace function public.cart_complete_payment_with_gl(
  p_payment_id uuid,
  p_everypay_payment_id text,
  p_payment_method text,
  p_paid_amount_cents integer,
  p_callback_payload jsonb,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Body lands at commit 5 (payment-fulfillment.ts wrap). Validates cart payment
  -- intent (idempotency on everypay_payment_id), creates orders in pending_seller,
  -- updates cart_checkout_groups → completed, emits ONE entry of C.1 OR C.2 per
  -- cart (cash leg). No O.x emits at this stage — those fire at completion via
  -- complete_order_with_gl. Returns { order_ids[], cart_journal_entry_id }.
  raise exception 'LIFECYCLE:NOT_IMPLEMENTED cart_complete_payment_with_gl ships in PR #5 commit 5';
end;
$$;

comment on function public.cart_complete_payment_with_gl(uuid, text, text, integer, jsonb, uuid) is
  'PR #5 lifecycle parent RPC. Wraps fulfillCartPayment when ACCOUNTING_ENGINE_ENABLED. Emits C.1 (card) or C.2 (PIS) cart-cash-leg entry alongside the existing cart-fulfillment writes. Body lands at commit 5; stub raises LIFECYCLE:NOT_IMPLEMENTED.';

revoke all on function public.cart_complete_payment_with_gl(uuid, text, text, integer, jsonb, uuid) from public;
revoke all on function public.cart_complete_payment_with_gl(uuid, text, text, integer, jsonb, uuid) from anon;
revoke all on function public.cart_complete_payment_with_gl(uuid, text, text, integer, jsonb, uuid) from authenticated;
grant execute on function public.cart_complete_payment_with_gl(uuid, text, text, integer, jsonb, uuid) to service_role;

-- ============================================================================
-- 3. complete_order_with_gl — wraps order-transitions.ts:creditSellerWallet
-- ============================================================================

create or replace function public.complete_order_with_gl(
  p_order_id uuid,
  p_actor_id uuid,
  p_completion_source text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Body lands at commit 6 (order-transitions.ts:creditSellerWallet wrap +
  -- buildOrderRevenueLines 4 → 6 line rework with VAT-inclusive decomposition
  -- per docs/legal_audit/accountant-completion-entry-signoff.md v1.2).
  --
  -- Single integration point for completion-time GL emission: called from
  -- completeOrder, autoCompleteOrder, dispute.escalateDispute (resolved_no_refund),
  -- dispute.staffResolveDispute (no_refund). FOR UPDATE order; checks C.1/C.2
  -- antecedent (Q3 Option A — orphan returns true with journal_entry_id=null
  -- and skips GL emit, preserves wallet credit and status update); sets
  -- orders.status='completed'; wallet credit (existing creditWallet body
  -- inlined); emits 6-line O.1/O.2/O.3/O.4/O.5 by seller country + tax_status.
  -- Returns { wallet_txn_id, journal_entry_id, orphan: boolean }.
  raise exception 'LIFECYCLE:NOT_IMPLEMENTED complete_order_with_gl ships in PR #5 commit 6';
end;
$$;

comment on function public.complete_order_with_gl(uuid, uuid, text) is
  'PR #5 lifecycle parent RPC. Wraps creditSellerWallet when ACCOUNTING_ENGINE_ENABLED. Emits 6-line O.1-O.5 completion entry per accountant-signed v1.2 addendum (docs/legal_audit/accountant-completion-entry-signoff.md). Antecedent-check return shape (orphan: boolean) handles cutover-window orphan completions per round-3 §A.3. Body lands at commit 6; stub raises LIFECYCLE:NOT_IMPLEMENTED.';

revoke all on function public.complete_order_with_gl(uuid, uuid, text) from public;
revoke all on function public.complete_order_with_gl(uuid, uuid, text) from anon;
revoke all on function public.complete_order_with_gl(uuid, uuid, text) from authenticated;
grant execute on function public.complete_order_with_gl(uuid, uuid, text) to service_role;

-- ============================================================================
-- 4. wallet_withdrawal_complete_with_gl — wraps staff/withdrawals/[id]/route.ts
--    (Shape 2 lazy: fires at completion, not at request)
-- ============================================================================

create or replace function public.wallet_withdrawal_complete_with_gl(
  p_withdrawal_request_id uuid,
  p_actor_id uuid,
  p_bank_confirmation_ref text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Body lands at commit 8 (staff/withdrawals/[id]/route.ts:50-51 wrap).
  -- Shape 2: fires at staff completion, NOT at request — STG diverges from v3
  -- C.4's eager-firing prescription because manual-SEPA reality has days-long
  -- lag between request and bank send. Wraps existing withdrawal_requests
  -- status='completed' transition. FOR UPDATE withdrawal_requests + counterparty;
  -- KYC gate inline (rejects if legal_compliance_status IN ('pending_kyc',
  -- 'dac7_blocked', 'negative_wallet', 'suspended') — mirrors assertPayoutAllowed);
  -- updates status='completed' + bank-confirmation metadata; emits C.4
  -- (Dr 5351 Cr 2610). Returns { journal_entry_id }.
  raise exception 'LIFECYCLE:NOT_IMPLEMENTED wallet_withdrawal_complete_with_gl ships in PR #5 commit 8';
end;
$$;

comment on function public.wallet_withdrawal_complete_with_gl(uuid, uuid, text) is
  'PR #5 lifecycle parent RPC. Wraps the staff withdrawal completion handler at src/app/api/staff/withdrawals/[id]/route.ts (action=complete branch) when ACCOUNTING_ENGINE_ENABLED. Shape 2 (lazy at completion, not at request) — divergence from v3 C.4 documented in round-3 §A.1. Inline KYC gate. Body lands at commit 8; stub raises LIFECYCLE:NOT_IMPLEMENTED.';

revoke all on function public.wallet_withdrawal_complete_with_gl(uuid, uuid, text) from public;
revoke all on function public.wallet_withdrawal_complete_with_gl(uuid, uuid, text) from anon;
revoke all on function public.wallet_withdrawal_complete_with_gl(uuid, uuid, text) from authenticated;
grant execute on function public.wallet_withdrawal_complete_with_gl(uuid, uuid, text) to service_role;

-- ============================================================================
-- 5. order_refund_with_gl — wraps order-refund.ts:refundOrder
-- ============================================================================

create or replace function public.order_refund_with_gl(
  p_order_id uuid,
  p_actor_id uuid,
  p_refund_amount_cents integer,
  p_refund_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Body lands at commit 7 (order-refund.ts:refundOrder wrap). FOR UPDATE order;
  -- reads journal_entries WHERE source_doc_id = p_order_id AND type_id IN
  -- ('O.1','O.2','O.3','O.4','O.5') for routing decision (NOT lock-graph-relevant
  -- since the read is informational, not gating a write on period status).
  -- Routes to O.7 / O.8 / O.9 by:
  --   - tax_period match (current → O.7 / prior → O.8) for full refunds
  --   - p_refund_amount_cents < original total → O.9 (proportional split)
  -- Antecedent absent → orphan: true, emit C.5 cash leg only (no O.x reversal).
  -- Calls EveryPay refund (or wallet refund) for the cash leg; emits refund-side
  -- O.x + C.5 entries; updates orders.status. Returns { refund_amount_cents,
  -- refund_entry_id?, cash_leg_entry_id, orphan: boolean }.
  raise exception 'LIFECYCLE:NOT_IMPLEMENTED order_refund_with_gl ships in PR #5 commit 7';
end;
$$;

comment on function public.order_refund_with_gl(uuid, uuid, integer, text) is
  'PR #5 lifecycle parent RPC. Wraps refundOrder when ACCOUNTING_ENGINE_ENABLED. Routes to O.7 (current-period full) / O.8 (cross-period full) / O.9 (partial proportional) based on antecedent O.x tax_period and refund amount; emits paired C.5 cash leg. Antecedent-check return shape handles cutover-window orphan refunds per round-3 §A.6. Body lands at commit 7; stub raises LIFECYCLE:NOT_IMPLEMENTED.';

revoke all on function public.order_refund_with_gl(uuid, uuid, integer, text) from public;
revoke all on function public.order_refund_with_gl(uuid, uuid, integer, text) from anon;
revoke all on function public.order_refund_with_gl(uuid, uuid, integer, text) from authenticated;
grant execute on function public.order_refund_with_gl(uuid, uuid, integer, text) to service_role;
