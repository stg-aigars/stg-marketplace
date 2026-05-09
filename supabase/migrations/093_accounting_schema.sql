-- Accounting module — foundational GL schema (PR 1 of N).
--
-- LEGAL POSTURE:
--   - Latvian SIA (Second Turn Games SIA, LV50203665371) maintains accounting
--     records under Cabinet Regulation 877 ("Grāmatvedības organizācijas un
--     kārtošanas noteikumi") and the Grāmatvedības likums. The general
--     ledger and supporting registers below are the systematic record of
--     business transactions required by §6 of the Grāmatvedības likums and
--     archived for the 10-year retention window per §10 of the same law.
--   - VAT-relevant journal entries serve as the underlying records for PVN
--     deklarācijas filed under PVN likums Article 118; OSS-routed entries
--     serve the quarterly OSS Union return per Article 369i of Directive
--     2006/112/EC; ESL-routed entries serve PVN 2 pielikums per Article 263
--     of the same Directive.
--
-- SCOPE OF THIS MIGRATION (PR 1):
--   Schema only. No triggers, no RLS, no seeds — those land in 094, 095, 096
--   respectively. The schema is the contract every subsequent accounting PR
--   builds against; once this is in staging, downstream PRs (posting engine,
--   Phase 0 backfill, OSS reporting layer, seller dashboard) work to it.
--
-- ARCHITECTURAL INVARIANTS:
--   - All monetary values: integer cents (no floats). bigint cents wide
--     enough for any plausible commercial scale.
--   - journal_entries / journal_lines: append-only — UPDATE and DELETE are
--     blocked at the DB level by triggers in migration 094. Corrections
--     happen via reversal entries with reverses_entry_id, never UPDATE.
--   - Σ debit_cents = Σ credit_cents per journal entry, enforced by a
--     deferred constraint trigger in 094 (fires at COMMIT, not per-row, so
--     multi-line entries can be inserted line-by-line).
--   - Period status (open / soft_locked / hard_locked) gates inserts via a
--     BEFORE INSERT trigger on journal_entries in 094. Hard-locked periods
--     reject; soft-locked periods reject without period_close_adjustment=true.
--
-- POSTING ENGINE IS THE ONLY WRITER (architectural rule, application-layer):
--   In production the posting engine (src/lib/accounting/posting-engine.ts,
--   landing in PR #2) is the only code path that inserts into journal_entries
--   and journal_lines. Service role bypasses RLS at the DB layer; the rule
--   "only the posting engine writes" is enforced in application code, not
--   here. RLS in 095 closes off authenticated/anon writes; service-role
--   discipline is the engineering rule on top.
--
-- COUNTERPARTY IDENTITY IS DUPLICATED FROM user_profiles:
--   `counterparties` carries its own country/tax_status/vat_number/tin/iban
--   columns rather than read-through-FK to user_profiles. The posting engine
--   snapshots from user_profiles when a seller first transacts; later drift
--   in user_profiles (seller changes IBAN, country) does not retroactively
--   change historical GL entries' counterparty record. This matches the
--   immutability principle of GL data.

-- ============================================================================
-- 1. accounts — chart of accounts
-- ============================================================================

create table public.accounts (
  code text primary key,
  name_lv text not null,
  name_en text not null,
  type text not null check (type in ('asset','liability','equity','revenue','expense','contra_asset')),
  is_vat boolean not null default false,
  is_active boolean not null default true,
  parent_code text references public.accounts(code) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.accounts is
  'Chart of accounts. Code is the natural primary key (e.g. 5710-LV-OUT). Hierarchy via parent_code FK lets parent accounts (5310 trade payables, 5710 VAT, 6310 commission revenue) sit alongside their sub-accounts. Latvian SME standard CoA with adaptations for marketplace VAT routing — see Phase 0 v2 spec for derivation.';

-- ============================================================================
-- 2. periods — accounting / tax period registry with lock state
-- ============================================================================

create table public.periods (
  period_key text not null,
  period_type text not null check (period_type in ('month','quarter','year')),
  status text not null default 'open' check (status in ('open','soft_locked','hard_locked')),
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (period_key, period_type)
);

comment on table public.periods is
  'Accounting / tax period registry. period_key is the human-readable label (2026-04 for monthly, 2026-Q2 for quarterly, 2026 for annual). State machine: open → soft_locked (after closing checklist green) → hard_locked (after VAT submission). Lock state is enforced by a BEFORE INSERT trigger on journal_entries in migration 094 — hard-locked rejects unconditionally, soft-locked rejects unless period_close_adjustment=true. Periods are seeded for known windows and never deleted.';

-- ============================================================================
-- 3. vat_rates — historical VAT rates by country with validity windows
-- ============================================================================

create table public.vat_rates (
  country char(2) not null,
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  valid_from date not null,
  valid_to date,
  notes text,
  created_at timestamptz not null default now(),
  primary key (country, valid_from),
  check (valid_to is null or valid_to >= valid_from)
);

comment on table public.vat_rates is
  'Historical VAT rates per country. valid_to=NULL means currently in force. The posting engine (PR #2) snapshots vat_rate_snapshot on every journal_lines row at posting time — historical rates carry forward in the GL even after this table is updated for prospective rate changes. Rate changes (e.g. Estonia 20% → 24% from 2025-07-01) close the prior row by setting valid_to and insert a new row with valid_from on the change date.';

-- ============================================================================
-- 4. counterparties — sellers, vendors, tax authorities, internal entities
-- ============================================================================

create table public.counterparties (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('seller','vendor','tax_authority','internal')),
  -- Seller-specific (NULL for non-sellers).
  user_id uuid references auth.users(id) on delete set null,
  full_name text,
  country char(2),
  tax_status text check (tax_status in ('private','sole_proprietor','vat_registered')),
  tin text,
  vat_number text,
  vies_verified_at timestamptz,
  iban text,
  iban_validated_at timestamptz,
  legal_compliance_status text not null default 'ok' check (
    legal_compliance_status in ('ok','pending_kyc','dac7_blocked','negative_wallet','suspended','dormant')
  ),
  kyc_status text not null default 'not_required' check (
    kyc_status in ('not_required','pending','verified','rejected')
  ),
  kyc_verified_at timestamptz,
  -- Vendor-specific.
  vendor_code text,
  -- Common.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.counterparties is
  'GL counterparties. Sellers link to auth.users via user_id (snapshotted at first-transaction time, not read-through); identity columns (country, vat_number, iban) are duplicated from user_profiles for audit immutability. Vendors carry vendor_code (e.g. UN, EP, AN). System counterparties (VID tax authority, STG_INTERNAL) have pinned constant UUIDs — see src/lib/accounting/system-counterparties.ts. Payouts are gated at the posting engine on legal_compliance_status and (post-PSD2-sunset) kyc_status.';

create index idx_counterparties_user
  on public.counterparties(user_id) where user_id is not null;
create index idx_counterparties_type_country
  on public.counterparties(type, country);
create index idx_counterparties_compliance
  on public.counterparties(legal_compliance_status, kyc_status);

-- ============================================================================
-- 5. vendor_invoices — invoices received from vendors (Anthropic, Hetzner,
--    Unisend, EveryPay/Maksekeskus, C&C, etc.)
-- ============================================================================

create table public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  counterparty_id uuid not null references public.counterparties(id) on delete restrict,
  vendor_invoice_number text not null,
  invoice_date date not null,
  due_date date,
  currency char(3) not null default 'EUR',
  net_amount_cents bigint not null check (net_amount_cents >= 0),
  vat_amount_cents bigint not null default 0 check (vat_amount_cents >= 0),
  gross_amount_cents bigint not null check (gross_amount_cents >= 0),
  vat_treatment text not null check (vat_treatment in (
    'standard',          -- LV vendor with VAT charged
    'domestic_rc',       -- LV vendor under PVN likums Article 143.7 reverse charge
    'eu_b2b_rc',         -- EU vendor B2B reverse-charge under Article 196 of Directive 2006/112/EC
    'non_eu_rc',         -- Non-EU vendor reverse-charge under PVN likums Article 88.4
    'exempt',            -- VAT-exempt service (Article 52 financial services etc.)
    'out_of_scope'       -- Out of LV VAT scope
  )),
  fx_rate numeric(20,10),
  fx_rate_source text check (fx_rate_source in ('bank_transaction','ecb_published','invoice_documented')),
  -- posted_entry_id and paid_entry_id reference journal_entries(id); the FK
  -- constraints are added after journal_entries is created (section 7) since
  -- Postgres needs the referenced table to exist before declaring the FK.
  posted_entry_id uuid,
  paid_entry_id uuid,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (counterparty_id, vendor_invoice_number)
);

comment on table public.vendor_invoices is
  'Inbound vendor invoice register. Distinct from the outbound public.invoices table (migration 073, marketplace commission invoices). Each row links to its posting journal_entry via posted_entry_id (debit expense + input/RC VAT, credit payable) and optionally to a payment journal_entry via paid_entry_id (debit payable, credit bank). The vat_treatment column drives VAT routing in the posting engine per the v3 mapping table.';

create index idx_vendor_invoices_counterparty_date
  on public.vendor_invoices(counterparty_id, invoice_date desc);
create index idx_vendor_invoices_unpaid
  on public.vendor_invoices(due_date) where paid_at is null;

-- ============================================================================
-- 6. fixed_assets — capitalised PP&E (laptops, future office equipment)
-- ============================================================================

create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  description text not null,
  serial_number text,
  acquired_date date not null,
  acquisition_cost_cents bigint not null check (acquisition_cost_cents > 0),
  vendor_invoice_id uuid references public.vendor_invoices(id) on delete restrict,
  account_code text not null references public.accounts(code) on delete restrict,
  useful_life_months integer not null check (useful_life_months > 0),
  depreciation_start_date date not null,
  disposed_date date,
  disposal_proceeds_cents bigint,
  notes text,
  created_at timestamptz not null default now(),
  check (disposed_date is null or disposed_date >= acquired_date),
  check (depreciation_start_date >= acquired_date)
);

comment on table public.fixed_assets is
  'Capitalised PP&E register. asset_code is human-readable (e.g. IT-2026-001). Monthly depreciation is computed by a cron in the posting engine: monthly = round(acquisition_cost_cents / useful_life_months), with the final month absorbing rounding residue. Depreciation begins the month following acquired_date per Latvian SME convention. Disposal closes the asset by setting disposed_date and disposal_proceeds_cents.';

create index idx_fixed_assets_active
  on public.fixed_assets(depreciation_start_date) where disposed_date is null;

-- ============================================================================
-- 7. journal_entries — append-only header for double-entry bookkeeping
-- ============================================================================

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  posting_date date not null,
  accounting_period text not null,
  tax_period text not null,
  entry_type text not null check (entry_type in (
    'checkout',
    'order',
    'refund',
    'dispute',
    'settlement',
    'payout',
    'accrual',
    'manual',
    'reversal',
    'dormancy',
    'writeoff',
    'provision',
    'depreciation',
    'period_close',
    'equity_contribution',
    'shareholder_loan',
    'vendor_invoice',
    'vendor_payment',
    'vat_refund'
  )),
  source_doc_type text,
  source_doc_id text,
  reverses_entry_id uuid references public.journal_entries(id) on delete restrict,
  correction_reason text,
  narrative text not null,
  posting_context jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  period_close_adjustment boolean not null default false
);

comment on table public.journal_entries is
  'Double-entry GL header. Append-only — UPDATE and DELETE blocked by trigger in migration 094. Every line under this entry must Σ debit = Σ credit (deferred constraint trigger in 094). accounting_period drives P&L truth (the period the economics belongs to); tax_period drives VAT obligation timing. period_close_adjustment=true flag bypasses soft_locked period gating — set only by application code with controller role authorisation. posting_context jsonb captures structured metadata (FX rate source, original_invoice_id for credit notes, reservation IDs, etc.) for audit traceability without bloating the schema.';

create index idx_je_period
  on public.journal_entries(accounting_period, tax_period);
create index idx_je_type
  on public.journal_entries(entry_type, posting_date);
create index idx_je_source
  on public.journal_entries(source_doc_type, source_doc_id);

-- Now wire vendor_invoices FKs to journal_entries (forward-reference resolved).
alter table public.vendor_invoices
  add constraint vendor_invoices_posted_entry_id_fkey
  foreign key (posted_entry_id) references public.journal_entries(id) on delete restrict;
alter table public.vendor_invoices
  add constraint vendor_invoices_paid_entry_id_fkey
  foreign key (paid_entry_id) references public.journal_entries(id) on delete restrict;

-- ============================================================================
-- 8. journal_lines — append-only debit/credit lines
-- ============================================================================

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete restrict,
  line_number integer not null,
  account_code text not null references public.accounts(code) on delete restrict,
  debit_cents bigint not null default 0,
  credit_cents bigint not null default 0,
  currency char(3) not null default 'EUR',
  fx_rate_snapshot numeric(20,10),
  vat_rate_snapshot numeric(5,2),
  vat_country char(2),
  counterparty_type text,
  counterparty_id uuid references public.counterparties(id) on delete restrict,
  narrative text,
  check (debit_cents >= 0 and credit_cents >= 0),
  -- Each line is debit-only OR credit-only (never both, never neither).
  check ((debit_cents = 0) <> (credit_cents = 0)),
  -- FX rate present iff non-EUR currency.
  check ((currency = 'EUR' and fx_rate_snapshot is null)
      or (currency <> 'EUR' and fx_rate_snapshot is not null)),
  unique (entry_id, line_number)
);

comment on table public.journal_lines is
  'Double-entry GL lines. Append-only — UPDATE and DELETE blocked by trigger in migration 094. line_number provides deterministic ordering within an entry (1, 2, 3 ...) for stable reporting and audit replay. vat_rate_snapshot and vat_country captured at posting time so historical lines retain the rate that was in effect even after vat_rates changes prospectively. counterparty_id enables per-seller / per-vendor aggregations (DAC7, payouts, vendor balances) without joining through journal_entries.';

create index idx_jl_account_entry
  on public.journal_lines(account_code, entry_id);
create index idx_jl_vat
  on public.journal_lines(account_code, vat_country, vat_rate_snapshot)
  include (debit_cents, credit_cents);
-- Lead with counterparty_id since it is unique across types and most queries
-- (DAC7 per-seller, seller wallet view, vendor balance) filter on it directly
-- without a counterparty_type predicate. account_code as the second column
-- supports the common per-counterparty-per-account aggregation shape.
create index idx_jl_counterparty
  on public.journal_lines(counterparty_id, account_code)
  where counterparty_id is not null;
