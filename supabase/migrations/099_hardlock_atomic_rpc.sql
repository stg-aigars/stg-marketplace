-- 099_hardlock_atomic_rpc.sql
--
-- Atomic hard-lock primitive (PR #4.5d) closing the TOCTOU race between the
-- entries-since check and the status update in hardLockPeriod
-- (period-actions.ts pre-099). Two coupled changes:
--
--   1. RPC hard_lock_period_atomic(period_key, period_type, expected_locked_at)
--      Conditional UPDATE under SELECT ... FOR UPDATE so the period row is
--      exclusively locked through both the entries-since check and the UPDATE.
--      Returns the new periods row on success, NULL on any precondition
--      mismatch (status drift, locked_at drift, or entries posted since).
--
--   2. enforce_period_status() trigger function rewrite — the status read uses
--      SELECT ... FOR SHARE on the period row so concurrent journal_entries
--      INSERTs serialise on the period row lock. Without this, the trigger's
--      plain SELECT (migration 094 / 098) would let an INSERT slip through
--      after the RPC's NOT EXISTS evaluates but before the RPC's UPDATE
--      commits — the two transactions take locks on different tables and
--      neither sees the other's pre-commit state in READ COMMITTED. FOR SHARE
--      does not conflict with itself, so concurrent INSERTs to the same
--      period are not serialised against each other — only against the
--      hard-lock UPDATE.
--
-- Lock-graph invariant for future readers:
--   Period-status readers that gate journal entry writes MUST hold ≥FOR SHARE
--   on the period row. The trigger does this; any future reader (e.g. a
--   quarterly-close UI's pre-flight, an OSS aggregation cron's pre-check)
--   that reads periods.status to decide whether journal entries can land
--   must follow suit. Postgres has no schema-level enforcement for "this row
--   must be read with a lock"; the invariant is documented here and any
--   regression must reproduce the analysis above.
--
-- Pattern: SECURITY DEFINER + set search_path = '' + revoke-then-grant to
-- service_role only. Mirrors migration 070 (wallet RPCs) and 097
-- (insert_journal_entry).

-- ============================================================================
-- 1. RPC — hard_lock_period_atomic
-- ============================================================================

create or replace function public.hard_lock_period_atomic(
  p_period_key text,
  p_period_type text,
  p_expected_locked_at timestamptz
) returns setof public.periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  -- Acquire exclusive row lock on the period and verify status / locked_at
  -- preconditions atomically. If status drifted (someone unsoft-locked,
  -- someone else hard-locked first, etc.) or locked_at drifted (period was
  -- re-soft-locked at a different timestamp), the SELECT ... FOR UPDATE
  -- returns no row and the RPC returns zero rows. SETOF (not a scalar
  -- composite return) is deliberate: PostgREST + supabase-js .maybeSingle()
  -- treats a SETOF empty result as `data: null`, but a scalar composite
  -- return populated with a NULL row reaches the client as a row of all-null
  -- columns instead of `null` — defeating the contract.
  select true into v_found
    from public.periods
    where period_key = p_period_key
      and period_type = p_period_type
      and status = 'soft_locked'
      and locked_at = p_expected_locked_at
    for update;

  if not found then
    return;
  end if;

  -- With the exclusive lock held, any concurrent journal_entries INSERT into
  -- this period blocks at the BEFORE INSERT trigger's SELECT ... FOR SHARE
  -- (registered below) until this transaction commits or rolls back. The
  -- EXISTS check therefore evaluates against fully committed state.
  if exists (
    select 1 from public.journal_entries
      where accounting_period = p_period_key
        and created_at >= p_expected_locked_at
  ) then
    return;
  end if;

  return query
    update public.periods
      set status = 'hard_locked'
      where period_key = p_period_key
        and period_type = p_period_type
      returning *;
end;
$$;

comment on function public.hard_lock_period_atomic(text, text, timestamptz) is
  'Atomic conditional UPDATE for soft_locked → hard_locked transitions (PR #4.5d, migration 099). Acquires SELECT ... FOR UPDATE on the period row, verifies (status=soft_locked AND locked_at=expected) and (no journal entries posted since locked_at), then UPDATEs status. Returns the new periods row on success or NULL on any precondition mismatch. Paired with FOR SHARE in enforce_period_status() so concurrent INSERTs serialise against the lock. SECURITY DEFINER + service-role-only EXECUTE matches migration 070/097.';

revoke all on function public.hard_lock_period_atomic(text, text, timestamptz) from public;
revoke all on function public.hard_lock_period_atomic(text, text, timestamptz) from anon;
revoke all on function public.hard_lock_period_atomic(text, text, timestamptz) from authenticated;
grant execute on function public.hard_lock_period_atomic(text, text, timestamptz) to service_role;

-- ============================================================================
-- 2. enforce_period_status() — FOR SHARE on the period row
-- ============================================================================

create or replace function public.enforce_period_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  -- FOR SHARE so concurrent hard_lock_period_atomic UPDATEs (which take
  -- FOR UPDATE on the same row) block this read until they commit or roll
  -- back. FOR SHARE does not conflict with itself, so concurrent INSERTs to
  -- the same period proceed in parallel.
  select status into v_status
    from public.periods
    where period_key = new.accounting_period
      and period_type in ('month', 'quarter', 'year')
    for share;

  if v_status is null then
    raise exception 'POSTING:UNKNOWN_PERIOD %; period must be seeded in public.periods (period_type in month/quarter/year)', new.accounting_period
      using errcode = 'P0001';
  end if;
  if v_status = 'hard_locked' then
    raise exception 'Period % is hard_locked; corrections must post to current open period as reversal entries', new.accounting_period
      using errcode = '23514';
  end if;
  if v_status = 'soft_locked' and new.period_close_adjustment is not true then
    raise exception 'Period % is soft_locked; only entries marked period_close_adjustment=true allowed (set by authorised role at application layer)', new.accounting_period
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.enforce_period_status() is
  'BEFORE INSERT trigger function on journal_entries. SELECT ... FOR SHARE on the period row (added in migration 099) so concurrent hard_lock_period_atomic UPDATEs block this read. FOR SHARE does not conflict with itself, so concurrent INSERTs do not serialise. Disjoint period_key formats + UNIQUE(period_key) (migration 098) keep the lookup single-row across period_types. Error contract unchanged from migration 098: POSTING:UNKNOWN_PERIOD/P0001 for unseeded periods, 23514 for hard_locked or soft_locked-without-flag.';

-- Trigger registration unchanged — function body swap only.
