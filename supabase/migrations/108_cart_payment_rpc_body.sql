-- 108_cart_payment_rpc_body.sql
--
-- PR C commit 9 — fill the body of cart_complete_payment_with_event_atomic
-- + add cart_checkout_groups.paid_at column.
--
-- Migration 104 shipped the Choice 2 stub raising LIFECYCLE:NOT_IMPLEMENTED
-- under the parameter name p_payment_id. Per commit-9 preamble Q1+Q3
-- resolutions:
--
--   Q1 — Add paid_at column (mirrors complete_order_with_event_atomic's
--        wallet_credited_at idempotency-guard pattern from migration 106).
--        Without an RPC-owned write to detect retries, the only available
--        guard signal is status='completed' — which is mutated by
--        fulfillCartPayment's TS-side flow too. Same category of bug as
--        PR #292's wallet_credited_at race; preemptively closing it here.
--
--   Param rename — p_payment_id → p_cart_group_id. The stub's name was
--        misleading (no cart_payments table exists; cart-side identifier is
--        cart_checkout_groups.id). Stub was never called (ACCOUNTING_ENGINE_
--        ENABLED has been OFF since PR A); safe to drop + create with the
--        clearer name.
--
-- The RPC composes:
--   1. Cross-validate that p_event's source_doc references this cart group
--   2. FOR UPDATE on cart_checkout_groups row (serialises concurrent
--      fulfillment attempts — browser callback + reconcile-payments cron
--      hitting the same group)
--   3. Idempotent-retry guard via paid_at IS NOT NULL (the RPC's OWN write,
--      per the migration 106 pattern)
--   4. PERFORM insert_journal_entry(p_event, p_lines) for C.1 (card) or
--      C.2 (bank_link) — the engine's idempotency UNIQUE on (source_doc_type,
--      source_doc_id, type_id) protects against concurrent emits
--   5. Mutate cart_checkout_groups.status='completed', paid_at=now()
--   6. Return { journal_entry_id, idempotent_skip }
--
-- No orphan return shape on cart receipts per the commit-9 preamble: cart
-- payments ARE the antecedent that completion looks for; there is no
-- upstream type that could be missing.

-- ============================================================================
-- 1. Add paid_at column to cart_checkout_groups
-- ============================================================================

alter table public.cart_checkout_groups
  add column if not exists paid_at timestamptz;

comment on column public.cart_checkout_groups.paid_at is
  'Set by cart_complete_payment_with_event_atomic when the lifecycle wrap commits the C.1/C.2 GL entry. Doubles as the idempotent-retry guard signal (the RPC''s own write, never mutated by TS-side fulfillCartPayment). Null when status=''pending''; non-null when status=''completed'' via the engine path.';

-- ============================================================================
-- 2. Drop migration 104's stub (different parameter name)
-- ============================================================================

drop function if exists public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb);

-- ============================================================================
-- 3. cart_complete_payment_with_event_atomic — FULL BODY
-- ============================================================================

create or replace function public.cart_complete_payment_with_event_atomic(
  p_cart_group_id uuid,
  p_actor_id uuid,
  p_event jsonb,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.cart_checkout_groups%rowtype;
  v_journal_entry_id uuid;
begin
  -- Defensive cross-validation: caller's event must point at this cart group.
  -- Mirrors the pattern in migration 106's complete_order_with_event_atomic.
  if p_event->>'source_doc_type' is distinct from 'cart_payment'
     or p_event->>'source_doc_id' is distinct from p_cart_group_id::text then
    raise exception 'LIFECYCLE:EVENT_ID_MISMATCH event source (%/%) does not match p_cart_group_id (%)',
      p_event->>'source_doc_type', p_event->>'source_doc_id', p_cart_group_id;
  end if;

  -- FOR UPDATE on cart group — serialises concurrent fulfillment attempts
  -- for the same cart (browser callback + reconcile cron).
  select * into v_group from public.cart_checkout_groups
    where id = p_cart_group_id for update;
  if not found then
    raise exception 'LIFECYCLE:CART_GROUP_NOT_FOUND %', p_cart_group_id;
  end if;

  -- Idempotent-retry guard: paid_at IS NOT NULL is the RPC's OWN write.
  -- Distinguishes a retry of this function from "status was updated upstream"
  -- (which doesn't happen for the cart path today, but mirrors the migration
  -- 106 wallet_credited_at pattern that closed the same category of bug for
  -- the completion path — see PR #292).
  if v_group.paid_at is not null then
    return jsonb_build_object(
      'journal_entry_id', null,
      'idempotent_skip', true
    );
  end if;

  -- Atomic GL emit BEFORE the cart status mutation. If insert_journal_entry
  -- raises (balance trigger violation, period locked, etc.), the cart row
  -- stays unmodified and the TS-side retry path (reconcile-payments cron)
  -- will surface the failure. Engine's idempotency UNIQUE on
  -- (source_doc_type, source_doc_id, type_id) catches concurrent emits;
  -- on 23505 the parent bubbles and the TS wrap can recover via a fresh
  -- journal_entries SELECT.
  v_journal_entry_id := public.insert_journal_entry(p_event, p_lines);

  -- Marketplace state mutation — status flip + paid_at stamp.
  update public.cart_checkout_groups
    set status = 'completed', paid_at = now()
    where id = p_cart_group_id;

  return jsonb_build_object(
    'journal_entry_id', v_journal_entry_id,
    'idempotent_skip', false
  );
end;
$$;

comment on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) is
  'PR C commit 9 — cart fulfillment parent RPC. Wraps payment-fulfillment.ts:fulfillCartPayment when ACCOUNTING_ENGINE_ENABLED. Idempotency guard reads cart_checkout_groups.paid_at (the RPC''s own write — mirrors migration 106''s wallet_credited_at guard for the completion path, closing the same category of bug as PR #292). Service-layer wrap (lifecycle-wraps.ts:cartFulfillmentWithGL) builds the PostingEvent + lines via dispatcher + compute, then passes them here. RPC composes: cross-validate event, FOR UPDATE cart group, idempotent-retry check on paid_at, PERFORM insert_journal_entry, status+paid_at update. Returns { journal_entry_id, idempotent_skip }. No orphan return shape — cart payments are themselves the antecedent that completion looks for.';

revoke all on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) from anon;
revoke all on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) from authenticated;
grant execute on function public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb) to service_role;
