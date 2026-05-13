-- 111_refund_idempotency_guard.sql
--
-- PR C post-implementation review Finding 1.3a — refund RPC missing
-- idempotency guard pattern parity.
--
-- Migrations 106 (completion), 108 (cart), 109 (withdrawal) all include
-- an early-return idempotent-retry guard:
--
--     if v_<entity>.<RPC-owned-column> is not null then
--       return jsonb_build_object(..., 'idempotent_skip', true);
--     end if;
--
-- Migration 105 (refund RPC body) lacked this guard. The engine UNIQUE
-- on (source_doc_type, source_doc_id, type_id) catches duplicate emits
-- via 23505 → engine recovery returns idempotent_skip from the unique
-- path, so the functional impact is limited. But two issues remained:
--
--   1. `refunded_at = now()` overwrites on each retry — timestamp drift
--      against the "RPC-owned column is the load-bearing write"
--      discipline declared in 106/108/109.
--   2. Pattern drift across the 4 parent RPCs — the discipline was
--      explicitly chosen post-PR-#292 to close the same class of bug.
--
-- This migration replaces the function body with the same signature +
-- the early-return guard, restoring uniform discipline across all four
-- lifecycle parent RPCs. v_has_antecedent is computed BEFORE the guard
-- so the return shape (`orphan: not v_has_antecedent`) stays consistent
-- on the retry path.
--
-- Same signature as 105; CREATE OR REPLACE updates the body.

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
  -- Defensive cross-validation: events must reference this order
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

  -- FOR UPDATE on order — serialise concurrent refund attempts
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'LIFECYCLE:ORDER_NOT_FOUND %', p_order_id;
  end if;

  -- Antecedent check: was this order completed via the engine? Computed
  -- BEFORE the idempotency guard so the retry return shape can include
  -- `orphan: not v_has_antecedent` consistent with the first-call return.
  select exists(
    select 1 from public.journal_entries
    where source_doc_type = 'order'
      and source_doc_id = p_order_id::text
      and type_id in ('O.1', 'O.2', 'O.3', 'O.4', 'O.5')
  ) into v_has_antecedent;

  -- Idempotent-retry guard: refunded_at IS NOT NULL is the RPC's OWN
  -- write below. If set, this is a retry — return idempotent_skip without
  -- re-stamping refunded_at, re-updating refund_status / refund_amount_cents,
  -- or re-emitting GL entries. Engine UNIQUE on
  -- (source_doc_type, source_doc_id, type_id) provides a backstop for
  -- the GL side, but this guard fires earlier and avoids the round-trip.
  -- Pattern parity with migrations 106 (wallet_credited_at), 108 (paid_at),
  -- 109 (completed_at). See `accounting_conventions.md §3`.
  if v_order.refunded_at is not null then
    return jsonb_build_object(
      'refund_entry_id', null,
      'cash_leg_entry_id', null,
      'orphan', not v_has_antecedent,
      'idempotent_skip', true
    );
  end if;

  -- Marketplace state update — fires regardless of GL emit path. Mirrors
  -- the pre-PR-#5 refundOrder flow's status update; under flag-ON the wrap
  -- delegates this to the parent RPC for transactional atomicity with the
  -- GL emits below.
  update public.orders
    set refund_status = p_refund_status,
        refund_amount_cents = p_refund_amount_cents,
        refunded_at = now(),
        status = case
          when p_refund_status = 'completed' then 'refunded'
          else status
        end
    where id = p_order_id;

  -- Refund-side O.x emit (caller passes NULL p_event for orphan path)
  if p_event is not null and p_event != 'null'::jsonb then
    if not v_has_antecedent then
      raise exception 'LIFECYCLE:ORPHAN_REFUND_WITH_EVENT order % has no completion antecedent but caller passed p_event; orphan path requires p_event=null',
        p_order_id;
    end if;
    v_refund_entry_id := public.insert_journal_entry(p_event, p_lines);
  end if;

  -- C.5 cash leg emit (caller passes NULL when no actual cash moved —
  -- e.g. wallet-only refunds where money never left STG's accounts)
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
  'PR #5 commit 7 + PR C post-review 1.3a — refund parent RPC. Choice 2: TS layer (lifecycle-wraps.ts:refundOrderWithGL) builds events + lines via dispatcher + compute, passes them as jsonb. RPC composes: FOR UPDATE order, antecedent check, idempotent-retry guard on refunded_at (added migration 111 for pattern parity with 106/108/109), status mutation, conditional emits (refund-side O.x + C.5 cash leg). Caller passes NULL p_event on orphan path (no completion antecedent); NULL p_cash_leg_event when no cash moved (wallet-only refunds). Returns { refund_entry_id, cash_leg_entry_id, orphan, idempotent_skip }. Service-layer wrap fires accounting.orphan_emit_skipped telemetry on orphan: true return.';
