-- Bank-statement reconciliation (PR #4b).
--
-- Makes the period-close bank reconciliation (checklist item 2) data-driven and
-- multi-account, replacing the hardcoded single-account BANK_WALK_CHECKPOINTS
-- (2610 only) constant. The new e-commerce settlement account 2620 — where all
-- marketplace cash lands — gets a standing reconciliation gate.
--
-- Design: docs/plans/2026-06-03-bank-statement-reconciliation-design.md
--   - accounts.is_bank_reconcilable flags which accounts must reconcile.
--   - bank_statement_closures holds the staff-recorded statement closing per
--     (account, period). Item 2 compares GL closing == recorded closing for
--     every flagged account that has activity ("in-use" guard) in the period.
--   - Manual staff entry (no statement-file parsing); editable while the period
--     is open, frozen once locked (enforced at the application layer).

-- 1. Flag bank accounts that reconcile against a Swedbank statement.
alter table public.accounts
  add column is_bank_reconcilable boolean not null default false;

update public.accounts
  set is_bank_reconcilable = true
  where code in ('2610', '2620');

-- 2. Staff-recorded statement closing balances.
create table public.bank_statement_closures (
  id uuid primary key default gen_random_uuid(),
  account_code text not null references public.accounts(code) on delete restrict,
  period_key text not null,                       -- 'YYYY-MM'
  closing_balance_cents bigint not null,          -- signed net-debit (matches getAccountClosingBalance)
  statement_ref text,
  statement_date date,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  notes text,
  unique (account_code, period_key)               -- one closing per account per month
);

create index idx_bank_statement_closures_period
  on public.bank_statement_closures (period_key);

comment on table public.bank_statement_closures is
  'Staff-recorded Swedbank statement closing balance per (bank account, period). Period-close checklist item 2 reconciles GL closing against these. Replaces the hardcoded BANK_WALK_CHECKPOINTS constant. Editable while the period is open; the application layer (recordBankStatementClosing) blocks writes once the period is soft/hard-locked. closing_balance_cents is signed net-debit to match getAccountClosingBalance.';

-- 3. RLS — staff SELECT only; writes go through the service-role server action
-- (recordBankStatementClosing), which validates is_staff + period status in the
-- application layer. Mirrors the accounting tables seeded in migration 095.
alter table public.bank_statement_closures enable row level security;

create policy bank_statement_closures_staff_select on public.bank_statement_closures
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = (select auth.uid()) and is_staff = true)
  );

-- 4. Historical seed — migrate the existing BANK_WALK_CHECKPOINTS (2610 closings,
-- 2025-07 → 2026-05) plus the new 2620 May closing, so already-closed periods
-- keep reconciling after item 2 switches to the table. recorded_by is null
-- (system seed); statement_ref marks the provenance.
insert into public.bank_statement_closures
  (account_code, period_key, closing_balance_cents, statement_ref, statement_date, recorded_by, notes)
values
  ('2610', '2025-07', 5100,  'historical-seed', '2025-07-31', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2025-08', 8993,  'historical-seed', '2025-08-31', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2025-09', 5421,  'historical-seed', '2025-09-30', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2025-10', 3658,  'historical-seed', '2025-10-31', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2025-11', 3658,  'historical-seed', '2025-11-30', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2025-12', 1904,  'historical-seed', '2025-12-31', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2026-01', 43185, 'historical-seed', '2026-01-31', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2026-02', 44490, 'historical-seed', '2026-02-28', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2026-03', 44490, 'historical-seed', '2026-03-31', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2026-04', 44931, 'historical-seed', '2026-04-30', null, 'Migrated from BANK_WALK_CHECKPOINTS'),
  ('2610', '2026-05', 38378, 'historical-seed', '2026-05-31', null, 'Swedbank statement A 31.05.2026'),
  ('2620', '2026-05', 14920, 'historical-seed', '2026-05-31', null, 'Swedbank statement B (LV24…4950 3) 31.05.2026')
on conflict (account_code, period_key) do nothing;
