-- 104_lifecycle_choice2_signatures.sql
--
-- PR #5 commit 6 — switch lifecycle parent RPCs to Choice 2 signatures.
--
-- Migration 103 shipped Choice 1 stubs taking explicit parameters
-- (p_order_id, p_actor_id, p_completion_source, etc.) — the body would have
-- assembled the PostingEvent server-side. Per round-3 follow-up + commit 6
-- preamble, we switched to Choice 2: TS layer (service-layer wrap) builds
-- the event via dispatcher + compute, then passes a pre-built p_event jsonb +
-- p_lines jsonb to the RPC. Cleaner separation: SQL just composes the
-- atomic transaction; engine layer (TS) owns dispatch + compute.
--
-- The Choice 1 stubs from migration 103 were never called in production
-- (ACCOUNTING_ENGINE_ENABLED has been OFF since PR A shipped). Drop them
-- cleanly + create Choice 2 signatures. complete_order_with_event_atomic
-- gets its full body in this migration; the other three stay as
-- LIFECYCLE:NOT_IMPLEMENTED stubs until commits 7 / 8 fill them in via
-- CREATE OR REPLACE.

-- ============================================================================
-- 1. Drop Choice 1 stubs from migration 103
-- ============================================================================

drop function if exists public.cart_complete_payment_with_gl(uuid, text, text, integer, jsonb, uuid);
drop function if exists public.complete_order_with_gl(uuid, uuid, text);
drop function if exists public.wallet_withdrawal_complete_with_gl(uuid, uuid, text);
drop function if exists public.order_refund_with_gl(uuid, uuid, integer, text);

-- ============================================================================
-- 2. cart_complete_payment_with_event_atomic — STUB (body lands at later commit)
-- ============================================================================

create or replace function public.cart_complete_payment_with_event_atomic(
  p_payment_id uuid,
  p_actor_id uuid,
  p_event jsonb,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'LIFECYCLE:NOT_IMPLEMENTED cart_complete_payment_with_event_atomic ships in a later PR #5 commit';
end;
$$;

comment on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) is
  'PR #5 lifecycle parent RPC — Choice 2 signature (TS layer pre-builds event + lines via dispatcher + compute). Wraps fulfillCartPayment when ACCOUNTING_ENGINE_ENABLED. Body lands in a later commit; stub raises LIFECYCLE:NOT_IMPLEMENTED.';

revoke all on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) from anon;
revoke all on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) from authenticated;
grant execute on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) to service_role;

-- ============================================================================
-- 3. complete_order_with_event_atomic — FULL BODY (commit 6's deliverable)
-- ============================================================================

create or replace function public.complete_order_with_event_atomic(
  p_order_id uuid,
  p_actor_id uuid,
  p_event jsonb,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_has_antecedent boolean;
  v_wallet_credit_cents integer;
  v_wallet_credit_result jsonb;
  v_wallet_txn_id uuid;
  v_journal_entry_id uuid;
begin
  -- Defensive cross-validation: caller's event must point at this order
  if p_event->>'source_doc_type' is distinct from 'order'
     or p_event->>'source_doc_id' is distinct from p_order_id::text then
    raise exception 'LIFECYCLE:EVENT_ID_MISMATCH event source (%/%) does not match p_order_id (%)',
      p_event->>'source_doc_type', p_event->>'source_doc_id', p_order_id;
  end if;

  -- FOR UPDATE on order — serialise concurrent completion attempts
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'LIFECYCLE:ORDER_NOT_FOUND %', p_order_id;
  end if;

  -- Idempotent retry: order already completed; return no-op shape so the
  -- service-layer wrap can short-circuit without firing duplicate telemetry
  if v_order.status = 'completed' then
    return jsonb_build_object(
      'wallet_txn_id', null,
      'journal_entry_id', null,
      'orphan', false,
      'idempotent_skip', true
    );
  end if;

  -- Antecedent check (round-3 §A.3 Q3 Option A): cart-payment C.1/C.2 must
  -- exist for this order's cart_group_id. If absent, this is a cutover-
  -- window orphan (order originated pre-flag-on; completing post-flag-on).
  -- We still credit the wallet + advance status; only the GL emit is skipped.
  -- Service-layer wrap fires accounting.orphan_completion_emit_skipped
  -- telemetry on this return.
  if v_order.cart_group_id is not null then
    select exists(
      select 1 from public.journal_entries
      where source_doc_type = 'cart_payment'
        and source_doc_id = v_order.cart_group_id::text
        and type_id in ('C.1', 'C.2')
    ) into v_has_antecedent;
  else
    v_has_antecedent := false;
  end if;

  -- Update marketplace state regardless of antecedent — this is the
  -- byte-identical-to-flag-OFF behaviour for the wallet credit and status
  -- update. Failure here rolls back the whole transaction (parent RPC
  -- atomicity invariant).
  update public.orders
    set status = 'completed', wallet_credited_at = now()
    where id = p_order_id;

  -- Wallet credit via existing migration 070 RPC. PERFORM keeps us inside
  -- the same transaction; on failure the orders update above rolls back.
  -- seller_wallet_credit_cents = item_value_cents − commission_cents per
  -- pricing.ts:walletCreditCents (matches v1.4 seller_net formula).
  v_wallet_credit_cents := coalesce(v_order.seller_wallet_credit_cents, 0);
  if v_wallet_credit_cents > 0 then
    v_wallet_credit_result := public.wallet_credit(
      v_order.seller_id,
      v_wallet_credit_cents,
      p_order_id,
      'Sale completion - order ' || coalesce(v_order.order_number, p_order_id::text)
    );
    v_wallet_txn_id := (v_wallet_credit_result->>'id')::uuid;
  end if;

  -- Cutover-window orphan: skip GL emit; return shape signals telemetry
  if not v_has_antecedent then
    return jsonb_build_object(
      'wallet_txn_id', v_wallet_txn_id,
      'journal_entry_id', null,
      'orphan', true,
      'idempotent_skip', false
    );
  end if;

  -- Atomic GL emit. Caller pre-built p_event + p_lines via TS dispatcher +
  -- compute. The engine's idempotency UNIQUE on (source_doc_type,
  -- source_doc_id, type_id) protects us from races; if a concurrent emitter
  -- already inserted, insert_journal_entry raises 23505 and the parent
  -- RPC bubbles the error — service-layer wrap converts to idempotent_skip
  -- via a fresh SELECT, matching engine.ts's pattern.
  v_journal_entry_id := public.insert_journal_entry(p_event, p_lines);

  return jsonb_build_object(
    'wallet_txn_id', v_wallet_txn_id,
    'journal_entry_id', v_journal_entry_id,
    'orphan', false,
    'idempotent_skip', false
  );
end;
$$;

comment on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) is
  'PR #5 commit 6 — completion parent RPC. Wraps creditSellerWallet when ACCOUNTING_ENGINE_ENABLED is true. Service-layer wrap (order-transitions.ts:creditSellerWallet) builds the PostingEvent + lines via dispatcher + compute, then passes them here. RPC composes: FOR UPDATE order, antecedent check (cart C.1/C.2), status+wallet_credited_at update, PERFORM wallet_credit, PERFORM insert_journal_entry. Returns { wallet_txn_id, journal_entry_id, orphan: boolean, idempotent_skip: boolean }. Idempotent retry on already-completed order returns idempotent_skip=true with nulls. Orphan return shape (no cart antecedent) is the cutover-window pattern from round-3 §A.3 — wallet still credits, GL emit skipped, telemetry fires from wrap site.';

revoke all on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) from anon;
revoke all on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) from authenticated;
grant execute on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) to service_role;

-- ============================================================================
-- 4. wallet_withdrawal_complete_with_event_atomic — STUB (body lands at commit 8)
-- ============================================================================

create or replace function public.wallet_withdrawal_complete_with_event_atomic(
  p_withdrawal_request_id uuid,
  p_actor_id uuid,
  p_event jsonb,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'LIFECYCLE:NOT_IMPLEMENTED wallet_withdrawal_complete_with_event_atomic ships in PR #5 commit 8';
end;
$$;

comment on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb) is
  'PR #5 commit 8 — withdrawal completion parent RPC. Choice 2 signature. Shape 2 timing (lazy: fires at staff-marked completion, not at request) per round-2 brief §3.3. Body lands at commit 8; stub raises LIFECYCLE:NOT_IMPLEMENTED.';

revoke all on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb) from anon;
revoke all on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb) from authenticated;
grant execute on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb) to service_role;

-- ============================================================================
-- 5. order_refund_with_event_atomic — STUB (body lands at commit 7)
-- ============================================================================

create or replace function public.order_refund_with_event_atomic(
  p_order_id uuid,
  p_actor_id uuid,
  p_event jsonb,
  p_lines jsonb,
  p_cash_leg_event jsonb,
  p_cash_leg_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'LIFECYCLE:NOT_IMPLEMENTED order_refund_with_event_atomic ships in PR #5 commit 7';
end;
$$;

comment on function public.order_refund_with_event_atomic(uuid, uuid, jsonb, jsonb, jsonb, jsonb) is
  'PR #5 commit 7 — refund parent RPC. Choice 2 signature. Two-event payload: (p_event, p_lines) is the credit-note side (O.7 / O.8 / O.9 by tax_period and amount); (p_cash_leg_event, p_cash_leg_lines) is the C.5 cash-leg pair. Both emit atomically. Body lands at commit 7; stub raises LIFECYCLE:NOT_IMPLEMENTED.';

revoke all on function public.order_refund_with_event_atomic(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.order_refund_with_event_atomic(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from anon;
revoke all on function public.order_refund_with_event_atomic(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.order_refund_with_event_atomic(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
