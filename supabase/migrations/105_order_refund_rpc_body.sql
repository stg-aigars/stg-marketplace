-- 105_order_refund_rpc_body.sql
--
-- PR #5 commit 7 — fill the body of order_refund_with_event_atomic.
--
-- Migration 104 shipped the Choice 2 stub raising LIFECYCLE:NOT_IMPLEMENTED.
-- Commit 7 replaces it with a body that composes:
--   1. FOR UPDATE on the order (serialise concurrent refund attempts)
--   2. Cross-validation that p_event / p_cash_leg_event point at this order
--   3. Antecedent check (refund-side O.x exists for this order's completion)
--   4. Marketplace state update (orders.refund_status / refund_amount_cents /
--      refunded_at) — happens regardless of antecedent presence
--   5. Conditional emits:
--      - p_event present → PERFORM insert_journal_entry for refund-side O.x
--      - p_cash_leg_event present → PERFORM insert_journal_entry for C.5
--      - On orphan (antecedent absent), wrap may pass NULL for p_event +
--        p_lines to skip the refund-side emit; cash leg still fires if
--        applicable
--
-- Signature change from migration 104: parameter list is reordered + adds
-- p_refund_amount_cents and p_refund_status (orders state mutation inputs).
-- Old signature dropped + new created (CREATE OR REPLACE can't change
-- parameter types). The migration 104 stub was never called; safe to drop.

drop function if exists public.order_refund_with_event_atomic(uuid, uuid, jsonb, jsonb, jsonb, jsonb);

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

  -- Antecedent check: was this order completed via the engine? If so the
  -- caller is expected to pass p_event for the refund-side O.x reversal.
  -- If absent (cutover-window orphan or never-completed), the caller
  -- should pass NULL p_event and only emit C.5 cash leg (if applicable).
  select exists(
    select 1 from public.journal_entries
    where source_doc_type = 'order'
      and source_doc_id = p_order_id::text
      and type_id in ('O.1', 'O.2', 'O.3', 'O.4', 'O.5')
  ) into v_has_antecedent;

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
  'PR #5 commit 7 — refund parent RPC. Choice 2: TS layer (lifecycle-wraps.ts:refundOrderWithGL) builds events + lines via dispatcher + compute, passes them as jsonb. RPC composes: FOR UPDATE order, antecedent check, status mutation, conditional emits (refund-side O.x + C.5 cash leg). Caller passes NULL p_event on orphan path (no completion antecedent); NULL p_cash_leg_event when no cash moved (wallet-only refunds). Returns { refund_entry_id, cash_leg_entry_id, orphan, idempotent_skip }. Service-layer wrap fires accounting.orphan_emit_skipped telemetry on orphan: true return.';

revoke all on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) from anon;
revoke all on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.order_refund_with_event_atomic(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb) to service_role;
