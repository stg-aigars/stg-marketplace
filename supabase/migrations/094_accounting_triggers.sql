-- Accounting module — integrity triggers (PR 1, migration 2 of 4).
--
-- Four triggers protect the GL integrity invariants from migration 093's
-- header comment:
--
--   1. trg_jl_balanced (CONSTRAINT TRIGGER, DEFERRABLE INITIALLY DEFERRED)
--      Σ debit = Σ credit per journal entry, checked at COMMIT.
--
--   2. trg_je_period_status (BEFORE INSERT)
--      Period state machine: open allows; soft_locked rejects unless
--      period_close_adjustment=true; hard_locked rejects unconditionally.
--
--   3. trg_je_immutable (BEFORE UPDATE OR DELETE on journal_entries)
--      Append-only — corrections via reversal entries with reverses_entry_id.
--
--   4. trg_jl_immutable (BEFORE UPDATE OR DELETE on journal_lines)
--      Same.
--
-- DEFERRED CONSTRAINT TRIGGER NOTE:
--   trg_jl_balanced is the first deferred constraint trigger in this codebase.
--   It is FOR EACH ROW (Postgres requires this for CONSTRAINT TRIGGER), so for
--   an N-line entry the function fires N times at COMMIT — each time it
--   re-runs the same SUM query against journal_lines for the entry. Slightly
--   redundant but correct; can be optimised later if it becomes a hot path
--   (e.g., switch to FOR EACH STATEMENT once Supabase offers deferred
--   statement triggers, or memoise the check in posting-engine application
--   code).

-- ============================================================================
-- 1. Balanced-entry trigger (CONSTRAINT TRIGGER, deferred)
-- ============================================================================

create or replace function public.assert_entry_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dr bigint;
  v_cr bigint;
  v_entry_id uuid;
begin
  v_entry_id := new.entry_id;
  select coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0)
    into v_dr, v_cr
    from public.journal_lines
    where entry_id = v_entry_id;
  if v_dr <> v_cr then
    raise exception 'Unbalanced journal entry %: dr=% cr=%', v_entry_id, v_dr, v_cr
      using errcode = '23514';
  end if;
  return null;
end;
$$;

comment on function public.assert_entry_balanced() is
  'Constraint trigger function: verifies Σ debit = Σ credit for the entry referenced by NEW.entry_id. Wired as a DEFERRABLE INITIALLY DEFERRED constraint trigger so multi-line inserts within a transaction succeed line-by-line and the balance check runs once at COMMIT (per inserted line, since CONSTRAINT TRIGGER is FOR EACH ROW).';

create constraint trigger trg_jl_balanced
  after insert on public.journal_lines
  deferrable initially deferred
  for each row
  execute function public.assert_entry_balanced();

-- ============================================================================
-- 2. Period-status trigger (BEFORE INSERT on journal_entries)
-- ============================================================================

create or replace function public.enforce_period_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
    from public.periods
    where period_key = new.accounting_period
      and period_type = 'month';
  if v_status is null then
    raise exception 'Unknown accounting_period %; period must be seeded in public.periods (period_type=month)', new.accounting_period
      using errcode = '23503';
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
  'BEFORE INSERT trigger function on journal_entries. Looks up periods.status for (accounting_period, period_type=month) and rejects on hard_locked or (soft_locked AND NOT period_close_adjustment). Open period passes through. Unknown period rejects with 23503 (FK violation analogue) — periods must be seeded before journal entries can post into them.';

create trigger trg_je_period_status
  before insert on public.journal_entries
  for each row
  execute function public.enforce_period_status();

-- ============================================================================
-- 3. Immutability trigger on journal_entries
-- ============================================================================

create or replace function public.journal_entries_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Journal entries are immutable; corrections via reversal entries with reverses_entry_id'
    using errcode = '23514';
end;
$$;

comment on function public.journal_entries_immutable() is
  'BEFORE UPDATE OR DELETE trigger function on journal_entries. Always raises. Mirrors the invoices_immutable() pattern from migration 073 — financial records are append-only by accounting principle (and by §10 of Latvian Grāmatvedības likums). To correct a posted entry, post a reversal entry with reverses_entry_id pointing at the original.';

create trigger trg_je_immutable
  before update or delete on public.journal_entries
  for each row
  execute function public.journal_entries_immutable();

-- ============================================================================
-- 4. Immutability trigger on journal_lines
-- ============================================================================

create or replace function public.journal_lines_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Journal lines are immutable; corrections via reversal entries'
    using errcode = '23514';
end;
$$;

comment on function public.journal_lines_immutable() is
  'BEFORE UPDATE OR DELETE trigger function on journal_lines. Same rationale as journal_entries_immutable() — append-only by accounting principle.';

create trigger trg_jl_immutable
  before update or delete on public.journal_lines
  for each row
  execute function public.journal_lines_immutable();
