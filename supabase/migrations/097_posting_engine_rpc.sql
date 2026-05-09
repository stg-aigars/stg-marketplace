-- 097_posting_engine_rpc.sql
--
-- Posting engine atomicity primitive (PR #2).
--
-- Three concerns, in dependency order:
--   1. ALTER  — add type_id text NOT NULL to journal_entries
--   2. INDEX  — UNIQUE (source_doc_type, source_doc_id, type_id) for idempotency
--   3. RPC    — insert_journal_entry(p_entry, p_lines) returns uuid
--
-- The ALTER applies cleanly because PR #1 ships zero rows in journal_entries;
-- PR #2 is the writer. The UNIQUE index is the safety net for the rare race
-- where two concurrent emit() calls both pass the engine's pre-RPC SELECT
-- dedup check — the loser catches unique_violation (SQLSTATE 23505) and
-- converts to idempotent_skip via a fresh recovery SELECT (READ COMMITTED
-- guarantees the winner's committed row is visible).
--
-- The RPC is SECURITY DEFINER + search_path='' (mirrors 070 wallet RPCs and
-- 073 issue_document_number). RAISE EXCEPTION uses prefix-coded message
-- strings (no USING ERRCODE; SQLSTATE defaults to P0001) so PR #5 parent
-- RPCs catch by SQLSTATE='P0001' + SQLERRM LIKE 'POSTING:%' — same shape as
-- migration 070's INSUFFICIENT_BALANCE: pattern.
--
-- The RPC is inline-callable from PL/pgSQL via PERFORM. PR #5 marketplace
-- flows compose multi-step transactions (e.g. order completion + invoice
-- issuance + GL posting) inside parent RPCs that PERFORM this primitive.
-- PR #3 backfill reuses the same RPC for historical entries.

-- ============================================================================
-- 1. ALTER — add type_id column
-- ============================================================================

alter table public.journal_entries
  add column type_id text not null;

comment on column public.journal_entries.type_id is
  'V3 mapping table type ID (O.1, O.2, …, I.4, P.1, H.1, C.4, C.6 in PR #2; ~30 total once full catalog ships). Promoted to first-class column for DB-enforced idempotency: the UNIQUE (source_doc_type, source_doc_id, type_id) index would have a silent NULL hole if extracted from posting_context jsonb. Engine populates from VatMappingEntry.id at assembly time.';

-- ============================================================================
-- 2. INDEX — DB-enforced idempotency
-- ============================================================================

create unique index idx_journal_entries_idempotency
  on public.journal_entries (source_doc_type, source_doc_id, type_id);

-- ============================================================================
-- 3. RPC — insert_journal_entry
-- ============================================================================

create or replace function public.insert_journal_entry(
  p_entry jsonb,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_line_count int;
begin
  -- ────────────────────────────────────────────────────────────────────────
  -- p_entry validation
  -- period_close_adjustment is intentionally absent: it has DB default false
  -- and is only set true by authorised application code (PR #4 staff UI).
  -- All other validated fields are structurally required with no sane default.
  -- ────────────────────────────────────────────────────────────────────────

  if jsonb_typeof(p_entry) <> 'object' then
    raise exception 'POSTING:INVALID_SHAPE p_entry must be jsonb object';
  end if;

  if p_entry->>'posting_date' is null then
    raise exception 'POSTING:MISSING_KEY posting_date';
  end if;

  if p_entry->>'accounting_period' is null then
    raise exception 'POSTING:MISSING_KEY accounting_period';
  end if;

  if p_entry->>'tax_period' is null then
    raise exception 'POSTING:MISSING_KEY tax_period';
  end if;

  if p_entry->>'entry_type' is null then
    raise exception 'POSTING:MISSING_KEY entry_type';
  end if;

  if p_entry->>'type_id' is null then
    raise exception 'POSTING:MISSING_KEY type_id';
  end if;

  if p_entry->>'source_doc_type' is null then
    raise exception 'POSTING:MISSING_KEY source_doc_type';
  end if;

  if p_entry->>'source_doc_id' is null then
    raise exception 'POSTING:MISSING_KEY source_doc_id';
  end if;

  if p_entry->>'narrative' is null then
    raise exception 'POSTING:MISSING_KEY narrative';
  end if;

  if p_entry->>'created_by' is null then
    raise exception 'POSTING:MISSING_KEY created_by';
  end if;

  if p_entry->'posting_context' is null
     or jsonb_typeof(p_entry->'posting_context') <> 'object' then
    raise exception 'POSTING:MISSING_KEY posting_context (must be jsonb object)';
  end if;

  -- ────────────────────────────────────────────────────────────────────────
  -- p_lines validation
  -- ────────────────────────────────────────────────────────────────────────

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'POSTING:INVALID_SHAPE p_lines must be jsonb array';
  end if;

  v_line_count := jsonb_array_length(p_lines);
  if v_line_count < 2 then
    raise exception 'POSTING:INVALID_SHAPE entry needs >= 2 lines, got %', v_line_count;
  end if;

  -- ────────────────────────────────────────────────────────────────────────
  -- Insert entry. CHECK constraints + period-status trigger (094) +
  -- immutability trigger (094) fire transparently. UNIQUE
  -- idx_journal_entries_idempotency (this migration) catches concurrent
  -- duplicate inserts as SQLSTATE 23505.
  -- ────────────────────────────────────────────────────────────────────────

  insert into public.journal_entries (
    posting_date,
    accounting_period,
    tax_period,
    entry_type,
    type_id,
    source_doc_type,
    source_doc_id,
    reverses_entry_id,
    correction_reason,
    narrative,
    posting_context,
    created_by,
    period_close_adjustment
  )
  values (
    (p_entry->>'posting_date')::date,
    p_entry->>'accounting_period',
    p_entry->>'tax_period',
    p_entry->>'entry_type',
    p_entry->>'type_id',
    p_entry->>'source_doc_type',
    p_entry->>'source_doc_id',
    nullif(p_entry->>'reverses_entry_id', '')::uuid,
    p_entry->>'correction_reason',
    p_entry->>'narrative',
    p_entry->'posting_context',
    p_entry->>'created_by',
    coalesce((p_entry->>'period_close_adjustment')::boolean, false)
  )
  returning id into v_entry_id;

  -- ────────────────────────────────────────────────────────────────────────
  -- Insert lines. Deferred balanced-entry trigger (094) fires at COMMIT and
  -- enforces Σ debit = Σ credit per entry. Per-line CHECKs enforce
  -- (debit XOR credit) and (currency='EUR' iff fx_rate_snapshot null).
  -- ────────────────────────────────────────────────────────────────────────

  insert into public.journal_lines (
    entry_id,
    line_number,
    account_code,
    debit_cents,
    credit_cents,
    currency,
    fx_rate_snapshot,
    vat_rate_snapshot,
    vat_country,
    counterparty_type,
    counterparty_id,
    narrative
  )
  select
    v_entry_id,
    (line->>'line_number')::int,
    line->>'account_code',
    coalesce((line->>'debit_cents')::bigint, 0),
    coalesce((line->>'credit_cents')::bigint, 0),
    coalesce(line->>'currency', 'EUR'),
    nullif(line->>'fx_rate_snapshot', '')::numeric,
    nullif(line->>'vat_rate_snapshot', '')::numeric,
    line->>'vat_country',
    line->>'counterparty_type',
    nullif(line->>'counterparty_id', '')::uuid,
    line->>'narrative'
  from jsonb_array_elements(p_lines) as line;

  return v_entry_id;
end;
$$;

comment on function public.insert_journal_entry(jsonb, jsonb) is
  'Posting engine atomicity primitive (PR #2). Single Postgres transaction inserts 1 journal_entries row + N journal_lines rows under the period-status, balanced-entry, and immutability triggers from migration 094. SECURITY DEFINER + search_path='''' to bypass RLS uniformly. RAISE patterns mirror migration 070 (POSTING:LABEL prefix-coded; SQLSTATE P0001). Inline-callable from PL/pgSQL via PERFORM — PR #5 parent RPCs compose multi-step transactions on top. Idempotency enforced at DB level via idx_journal_entries_idempotency on (source_doc_type, source_doc_id, type_id); engine catches unique_violation and converts to idempotent_skip in TS.';

-- Lock down execute privilege — service role only. Application code never
-- calls this from anon/authenticated contexts.
revoke all on function public.insert_journal_entry(jsonb, jsonb) from public;
revoke all on function public.insert_journal_entry(jsonb, jsonb) from anon;
revoke all on function public.insert_journal_entry(jsonb, jsonb) from authenticated;
grant execute on function public.insert_journal_entry(jsonb, jsonb) to service_role;
