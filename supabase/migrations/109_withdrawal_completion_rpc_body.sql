-- 109_withdrawal_completion_rpc_body.sql
--
-- PR C commit 10 — fill the body of wallet_withdrawal_complete_with_event_atomic.
--
-- Migration 104 shipped the Choice 2 stub raising LIFECYCLE:NOT_IMPLEMENTED.
-- Commit 10 replaces it with a body that composes:
--   1. Cross-validate event references this withdrawal
--   2. FOR UPDATE on withdrawal_requests row (serialise concurrent completes)
--   3. Idempotent-retry guard via completed_at IS NOT NULL (the RPC's OWN
--      write — mirrors migration 106's wallet_credited_at pattern; the
--      status='completed' state CAN be set by upstream paths under flag-OFF
--      so using status as guard would risk the same PR #292-style false-retry)
--   4. State invariant: status must equal 'approved'
--   5. PERFORM insert_journal_entry(p_event, p_lines) — GL emit FIRST per
--      Pattern A (no orphan path exists for withdrawal completion — every
--      approved withdrawal that gets completed should produce a C.4)
--   6. Marketplace state mutation — status='completed', completed_at, staff_notes
--
-- Per PR C commit 10 preamble:
--   - Q1 Option B: bank_confirmation_ref captured in posting_context only
--     (via the C.4 event payload); withdrawal_requests gets NO new column.
--   - Q2 TS-only KYC gate: the RPC does NOT load counterparties or run
--     assertPayoutAllowed; that fires in assembleEntryForRpc before this
--     RPC is called.
--
-- Signature change from migration 104: adds p_staff_notes parameter (optional)
-- so the RPC can do the same coalesce-with-existing pattern as the legacy
-- TS-side mutation (route.ts:103-118).

drop function if exists public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb);

create or replace function public.wallet_withdrawal_complete_with_event_atomic(
  p_withdrawal_request_id uuid,
  p_actor_id uuid,
  p_event jsonb,
  p_lines jsonb,
  p_staff_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_withdrawal public.withdrawal_requests%rowtype;
  v_journal_entry_id uuid;
begin
  -- Defensive cross-validation: caller's event must point at this withdrawal.
  -- Same pattern as cart / completion / refund parent RPCs.
  if p_event->>'source_doc_type' is distinct from 'withdrawal_request'
     or p_event->>'source_doc_id' is distinct from p_withdrawal_request_id::text then
    raise exception 'LIFECYCLE:EVENT_ID_MISMATCH event source (%/%) does not match p_withdrawal_request_id (%)',
      p_event->>'source_doc_type', p_event->>'source_doc_id', p_withdrawal_request_id;
  end if;

  -- FOR UPDATE on withdrawal — serialises concurrent completion attempts.
  select * into v_withdrawal from public.withdrawal_requests
    where id = p_withdrawal_request_id for update;
  if not found then
    raise exception 'LIFECYCLE:WITHDRAWAL_NOT_FOUND %', p_withdrawal_request_id;
  end if;

  -- Idempotent-retry guard: completed_at IS NOT NULL is the RPC's OWN write.
  -- Distinguishes a retry of this function's work from "status was flipped
  -- upstream" (the latter shouldn't happen for withdrawal completion under
  -- flag-ON, but the guard mirrors migration 106's wallet_credited_at
  -- discipline preemptively — same category of bug that PR #292 surfaced
  -- for the order-completion path).
  if v_withdrawal.completed_at is not null then
    return jsonb_build_object(
      'journal_entry_id', null,
      'idempotent_skip', true
    );
  end if;

  -- State invariant: only approved withdrawals can complete. The TS handler
  -- checks this BEFORE the RPC call (route.ts:50-51), but the RPC re-checks
  -- under FOR UPDATE for defense against concurrent state mutations between
  -- TS check and RPC commit (e.g., concurrent reject + complete race).
  if v_withdrawal.status is distinct from 'approved' then
    raise exception 'LIFECYCLE:INVALID_WITHDRAWAL_STATUS expected approved, got %', v_withdrawal.status;
  end if;

  -- Atomic GL emit BEFORE the marketplace mutation. Pattern A per accounting
  -- conventions memory: no orphan path exists for withdrawal completion —
  -- every approved withdrawal that gets completed should produce a C.4.
  -- If insert_journal_entry raises (balance trigger violation, period
  -- locked, idempotency UNIQUE race), the withdrawal stays in 'approved'
  -- state and the next staff "complete" action will retry. Order-reversal
  -- would risk an orphan state: marketplace marks completed without GL.
  v_journal_entry_id := public.insert_journal_entry(p_event, p_lines);

  -- Marketplace state mutation. staff_notes coalesce mirrors the legacy
  -- TS-side behavior (route.ts:103-118) where the previous staff_notes is
  -- preserved when the new request body doesn't include one.
  update public.withdrawal_requests
    set status = 'completed',
        completed_at = now(),
        staff_notes = coalesce(p_staff_notes, staff_notes)
    where id = p_withdrawal_request_id;

  return jsonb_build_object(
    'journal_entry_id', v_journal_entry_id,
    'idempotent_skip', false
  );
end;
$$;

comment on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb, text) is
  'PR C commit 10 — withdrawal-completion parent RPC. Shape 2 timing: GL emits at staff-marked completion, NOT at request (manual SEPA reality has days-long lag). Wallet table was already debited at request time via wallet_withdrawal_debit (migration 071). This RPC writes the C.4 GL entry (Dr 5351 / Cr 2610) atomically with the withdrawal_requests status flip. Idempotency guard reads completed_at (the RPC''s own write) per migration 106 discipline. KYC gate runs TS-side via assembleEntryForRpc before this RPC is called; no SQL-side counterparty load. bank_confirmation_ref (when present in p_event payload) lands in posting_context only — no withdrawal_requests column mutation per commit-10 Q1 Option B.';

revoke all on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb, text) from public;
revoke all on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb, text) from anon;
revoke all on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb, text) from authenticated;
grant execute on function public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb, text) to service_role;
