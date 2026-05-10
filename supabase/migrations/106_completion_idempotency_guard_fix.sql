-- 106_completion_idempotency_guard_fix.sql
--
-- Fix critical bug surfaced by PR #292 code review on commit 6.
--
-- complete_order_with_event_atomic (migration 104) used `v_order.status =
-- 'completed'` as the idempotent-retry guard signal. Under the actual
-- caller flow, this fires on the FIRST call (not a retry):
-- order-transitions.ts:completeOrder calls transitionOrder('completed')
-- BEFORE creditSellerWallet, so by the time the RPC executes, the order
-- is already in 'completed' state. The RPC mistook the legitimate first
-- call for an idempotent retry and returned idempotent_skip without
-- crediting the wallet or emitting the GL entry. Affects all 4 callers
-- (completeOrder, autoCompleteOrder, dispute.escalateDispute,
-- dispute.staffResolveDispute).
--
-- Fix: change the guard signal to wallet_credited_at IS NOT NULL — the
-- RPC's own write. If wallet_credited_at is already set, the wrap has
-- already credited the wallet (in a prior successful call), so this is
-- a retry. Otherwise it's a first-time call regardless of status.
--
-- Same signature; CREATE OR REPLACE updates the body.

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
  if p_event->>'source_doc_type' is distinct from 'order'
     or p_event->>'source_doc_id' is distinct from p_order_id::text then
    raise exception 'LIFECYCLE:EVENT_ID_MISMATCH event source (%/%) does not match p_order_id (%)',
      p_event->>'source_doc_type', p_event->>'source_doc_id', p_order_id;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'LIFECYCLE:ORDER_NOT_FOUND %', p_order_id;
  end if;

  -- Idempotent-retry guard: wallet_credited_at is the RPC's OWN write
  -- (set after wallet_credit succeeds). Distinguishes a retry of THIS
  -- function's work from "order has been transitioned upstream" — the
  -- latter is the FIRST call, not a retry. Pre-fix used `v_order.status
  -- = 'completed'` which fired immediately on the first call because
  -- order-transitions.ts:completeOrder runs transitionOrder before
  -- invoking creditSellerWallet → completeOrderWithGL → this RPC.
  if v_order.wallet_credited_at is not null then
    return jsonb_build_object(
      'wallet_txn_id', null,
      'journal_entry_id', null,
      'orphan', false,
      'idempotent_skip', true
    );
  end if;

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

  -- Status update is idempotent (set the same value if already set);
  -- wallet_credited_at is the load-bearing write that the guard above
  -- detects on retries.
  update public.orders
    set status = 'completed', wallet_credited_at = now()
    where id = p_order_id;

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

  if not v_has_antecedent then
    return jsonb_build_object(
      'wallet_txn_id', v_wallet_txn_id,
      'journal_entry_id', null,
      'orphan', true,
      'idempotent_skip', false
    );
  end if;

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
  'PR #5 commit 6 — completion parent RPC. Wraps creditSellerWallet when ACCOUNTING_ENGINE_ENABLED. Idempotency guard reads wallet_credited_at (the RPC''s own write), NOT status (set upstream by transitionOrder before this RPC fires) — see migration 106 fix. Service-layer wrap (order-transitions.ts:creditSellerWallet) builds the PostingEvent + lines via dispatcher + compute, then passes them here. RPC composes: FOR UPDATE order, idempotent-retry check on wallet_credited_at, antecedent check (cart C.1/C.2), status+wallet_credited_at update, PERFORM wallet_credit, PERFORM insert_journal_entry. Returns { wallet_txn_id, journal_entry_id, orphan: boolean, idempotent_skip: boolean }.';
