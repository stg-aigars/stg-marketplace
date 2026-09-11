-- 134_fix_backfill_antecedent_lookup.sql
--
-- Fixes a silent GL-skip bug surfaced during the August 2026 close.
--
-- Both `complete_order_with_event_atomic` (migration 106) and
-- `order_refund_with_event_atomic` (migration 111) determine whether an
-- order has a valid antecedent (a prior cart-payment or completion entry)
-- by matching `source_doc_id` exactly:
--
--   complete_order_with_event_atomic:  source_doc_id = cart_group_id::text
--   order_refund_with_event_atomic:    source_doc_id = order_id::text
--
-- This holds for every entry the LIVE lifecycle wraps post — they always
-- set source_doc_id to the real UUID. It does NOT hold for entries posted
-- by the monthly backfill scripts (april/may/june/july-2026-backfill.ts):
-- those use human-readable labels as source_doc_id (e.g. 'july_2026_entry_27'),
-- while the real UUID is carried in `posting_context.cart_payment_id`
-- (cart entries) or `posting_context.order_id` (completion entries) — the
-- same canonical fields `getInFlightCartReceiptsTotal` in queries.ts already
-- reads for exactly this reason (see that function's JSDoc).
--
-- Impact discovered: orders STG-20260730-4DUR and STG-20260729-KL77 had
-- their cart payments backfilled in July 2026 (correct `cart_payment_id`
-- in posting_context, label source_doc_id) but completed in August 2026
-- via the live engine. complete_order_with_event_atomic's antecedent check
-- found nothing, so it credited the seller wallet and flipped the order to
-- 'completed' but silently skipped the O.1 journal entry (`orphan: true`,
-- telemetry fired, no error surfaced) — EUR2.14 of commission/shipping
-- output VAT went unrecognized until manually reconciled during the August
-- close (see docs date 2026-09-11).
--
-- A parallel scan found 35 completed orders whose O.1-O.5 entry was
-- backfilled the same way and is therefore invisible to
-- order_refund_with_event_atomic's antecedent check too — any of them
-- being refunded or disputed today would hit the identical failure mode
-- (silently skip the O.7/O.8 VAT-reversal credit note while still moving
-- cash via C.5, overstating recognized revenue on a refunded order).
--
-- Fix: both antecedent checks now match EITHER the live shape
-- (source_doc_id equality) OR the backfill shape (the canonical
-- posting_context field), so a backfilled antecedent is recognized
-- regardless of which convention posted it.
--
-- Companion fix: lifecycle-wraps.ts:refundOrderWithGL's own antecedent
-- lookup (used to decide whether to build a refund event at all) has the
-- same source_doc_id-only pattern and is fixed in the same commit as this
-- migration — the RPC's own re-check must agree with what the caller
-- decided, or a now-correctly-found antecedent on the TS side would trip
-- the RPC's `LIFECYCLE:ORPHAN_REFUND_WITH_EVENT` guard.
--
-- Same signatures as 106 and 111; CREATE OR REPLACE updates the bodies.

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

  if v_order.wallet_credited_at is not null then
    return jsonb_build_object(
      'wallet_txn_id', null,
      'journal_entry_id', null,
      'orphan', false,
      'idempotent_skip', true
    );
  end if;

  -- Antecedent check — matches either the live shape (source_doc_id is
  -- the cart UUID) or the backfill shape (posting_context.cart_payment_id
  -- carries the cart UUID; source_doc_id is a human-readable label). See
  -- migration header for why both are required.
  if v_order.cart_group_id is not null then
    select exists(
      select 1 from public.journal_entries
      where source_doc_type = 'cart_payment'
        and type_id in ('C.1', 'C.2')
        and (
          source_doc_id = v_order.cart_group_id::text
          or posting_context->>'cart_payment_id' = v_order.cart_group_id::text
        )
    ) into v_has_antecedent;
  else
    v_has_antecedent := false;
  end if;

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
  'PR #5 commit 6 — completion parent RPC. Wraps creditSellerWallet when ACCOUNTING_ENGINE_ENABLED. Idempotency guard reads wallet_credited_at (migration 106). Antecedent check matches either source_doc_id (live entries) or posting_context.cart_payment_id (backfill entries) — migration 134, fixing a silent orphan-skip for orders whose cart payment was backfilled but completed later via the live engine. Service-layer wrap (order-transitions.ts:creditSellerWallet) builds the PostingEvent + lines via dispatcher + compute, then passes them here. RPC composes: FOR UPDATE order, idempotent-retry check on wallet_credited_at, antecedent check (cart C.1/C.2), status+wallet_credited_at update, PERFORM wallet_credit, PERFORM insert_journal_entry. Returns { wallet_txn_id, journal_entry_id, orphan: boolean, idempotent_skip: boolean }.';

revoke all on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) from anon;
revoke all on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) from authenticated;
grant execute on function public.complete_order_with_event_atomic(uuid, uuid, jsonb, jsonb) to service_role;

create or replace function public.order_refund_with_event_atomic(
  p_order_id uuid,
  p_actor_id uuid,
  p_refund_amount_cents integer,
  p_refund_status text,
  p_event jsonb,
  p_lines jsonb,
  p_cash_leg_event jsonb,
  p_cash_leg_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_has_antecedent boolean;
  v_refund_entry_id uuid;
  v_cash_leg_entry_id uuid;
begin
  if p_event is not null and p_event != 'null'::jsonb then
    if p_event->>'source_doc_type' is distinct from 'order'
       or p_event->>'source_doc_id' is distinct from p_order_id::text then
      raise exception 'LIFECYCLE:EVENT_ID_MISMATCH refund p_event source (%/%) does not match p_order_id (%)',
        p_event->>'source_doc_type', p_event->>'source_doc_id', p_order_id;
    end if;
  end if;

  if p_cash_leg_event is not null and p_cash_leg_event != 'null'::jsonb then
    if p_cash_leg_event->>'source_doc_type' is distinct from 'refund' then
      raise exception 'LIFECYCLE:EVENT_ID_MISMATCH refund p_cash_leg_event source_doc_type must be ''refund'' (got %)',
        p_cash_leg_event->>'source_doc_type';
    end if;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'LIFECYCLE:ORDER_NOT_FOUND %', p_order_id;
  end if;

  -- Antecedent check — matches either the live shape (source_doc_id is the
  -- order UUID) or the backfill shape (posting_context.order_id carries the
  -- order UUID; source_doc_id is a human-readable label). See migration
  -- header for why both are required.
  select exists(
    select 1 from public.journal_entries
    where source_doc_type = 'order'
      and type_id in ('O.1', 'O.2', 'O.3', 'O.4', 'O.5')
      and (
        source_doc_id = p_order_id::text
        or posting_context->>'order_id' = p_order_id::text
      )
  ) into v_has_antecedent;

  if v_order.refunded_at is not null then
    return jsonb_build_object(
      'refund_entry_id', null,
      'cash_leg_entry_id', null,
      'orphan', not v_has_antecedent,
      'idempotent_skip', true
    );
  end if;

  update public.orders
    set refund_status = p_refund_status,
        refund_amount_cents = p_refund_amount_cents,
        refunded_at = now(),
        status = case
          when p_refund_status = 'completed' then 'refunded'
          else status
        end
    where id = p_order_id;

  if p_event is not null and p_event != 'null'::jsonb then
    if not v_has_antecedent then
      raise exception 'LIFECYCLE:ORPHAN_REFUND_WITH_EVENT order % has no completion antecedent but caller passed p_event; orphan path requires p_event=null',
        p_order_id;
    end if;
    v_refund_entry_id := public.insert_journal_entry(p_event, p_lines);
  end if;

  if p_cash_leg_event is not null and p_cash_leg_event != 'null'::jsonb then
    v_cash_leg_entry_id := public.insert_journal_entry(p_cash_leg_event, p_cash_leg_lines);
  end if;

  return jsonb_build_object(
    'refund_entry_id', v_refund_entry_id,
    'cash_leg_entry_id', v_cash_leg_entry_id,
    'orphan', not v_has_antecedent,
    'idempotent_skip', false
  );
end;
$$;

comment on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) is
  'PR #5 commit 7 + PR C post-review 1.3a + migration 134 — refund parent RPC. Choice 2: TS layer (lifecycle-wraps.ts:refundOrderWithGL) builds events + lines via dispatcher + compute, passes them as jsonb. RPC composes: FOR UPDATE order, antecedent check (matches source_doc_id OR posting_context.order_id, migration 134 — the latter for backfill-posted completions), idempotent-retry guard on refunded_at, status mutation, conditional emits (refund-side O.x + C.5 cash leg). Caller passes NULL p_event on orphan path (no completion antecedent); NULL p_cash_leg_event when no cash moved (wallet-only refunds). Returns { refund_entry_id, cash_leg_entry_id, orphan, idempotent_skip }. Service-layer wrap fires accounting.orphan_emit_skipped telemetry on orphan: true return.';

revoke all on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) from anon;
revoke all on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) to service_role;
