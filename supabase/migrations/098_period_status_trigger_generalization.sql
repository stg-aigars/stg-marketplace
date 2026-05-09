-- supabase/migrations/098_period_status_trigger_generalization.sql
-- Resolves Issue B from PR #1: enforce_period_status() hardcoded period_type='month'.
--
-- Two coupled changes:
--
-- 1. Generalize the trigger to accept period_type IN ('month','quarter','year')
--    so quarterly and annual journal entries (e.g., year-end equity adjustments)
--    lock-gate correctly when needed in PR #5+.
--
-- 2. Add UNIQUE(period_key) constraint to enforce the disjoint-format invariant
--    the trigger now relies on. Period_key formats are disjoint by design:
--      month   = 'YYYY-MM'  (e.g., '2026-04')
--      quarter = 'YYYY-QN'  (e.g., '2026-Q2')
--      year    = 'YYYY'     (e.g., '2026')
--    The composite PK (period_key, period_type) from migration 093 doesn't
--    enforce this — a typo or copy-paste seed could create a duplicate
--    period_key under a different period_type, and the trigger's lookup would
--    raise TOO_MANY_ROWS at runtime. The UNIQUE constraint catches the seed
--    drift at insert time instead.
--
-- 3. Switch unknown-period error code from fake 23503 (foreign_key_violation —
--    semantically wrong, no FK exists) to P0001 with POSTING:UNKNOWN_PERIOD
--    prefix, matching migration 097's RPC error-code convention.

-- ============================================================================
-- 1. UNIQUE(period_key) constraint
-- ============================================================================
-- Pre-flight: this DDL fails if production has duplicate period_keys.
-- See operator runbook step 1 (verify before deploy via Supabase MCP).

alter table public.periods
  add constraint periods_period_key_unique unique (period_key);

comment on constraint periods_period_key_unique on public.periods is
  'Period_key formats are disjoint by design (YYYY-MM monthly, YYYY-QN quarterly, YYYY annual). This constraint enforces the invariant that enforce_period_status() relies on for its single-row lookup across period_types. Added in migration 098.';

-- ============================================================================
-- 2. Generalized enforce_period_status() function
-- ============================================================================

create or replace function public.enforce_period_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  -- Single-row lookup safe because periods_period_key_unique enforces uniqueness
  -- across all period_types; period_key formats are disjoint by design.
  select status into v_status
    from public.periods
    where period_key = new.accounting_period
      and period_type in ('month', 'quarter', 'year');

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
  'BEFORE INSERT trigger function on journal_entries. Looks up periods.status for accounting_period across all period_types — disjoint key formats + UNIQUE(period_key) ensure single-row lookup. Rejects on hard_locked or (soft_locked AND NOT period_close_adjustment). Generalized in migration 098 from migration 094''s monthly-only lookup; unknown-period error code switched from fake 23503 to P0001 with POSTING:UNKNOWN_PERIOD prefix (matching migration 097''s RPC convention).';

-- Trigger registration unchanged — function body swap only.
