-- Accounting module — RLS (PR 1, migration 3 of 4).
--
-- All eight accounting tables follow the same RLS shape:
--
--   - ENABLE ROW LEVEL SECURITY on the table.
--   - One staff-SELECT policy: authenticated users with user_profiles.is_staff
--     can SELECT.
--   - Zero INSERT / UPDATE / DELETE policies for any role. Service role
--     bypasses RLS (Supabase convention; matches public.oss_submissions in
--     migration 087 and public.wallets in migration 018).
--   - Zero anon policies. Anon is denied by absence (the canonical pattern
--     for tax-grade tables in this repo).
--
-- The architectural rule "the posting engine is the only writer to journal_*"
-- is enforced at the application layer in PR #2 (src/lib/accounting/
-- posting-engine.ts), not here. RLS in this migration closes off
-- authenticated/anon writes; service-role discipline in application code is
-- the engineering rule on top.
--
-- Seller-facing read views (seller_wallet_view, seller_invoice_view per
-- architecture v2 §H.5) are out of scope for this PR. They land in PR #5
-- alongside the seller dashboard, projecting through journal_lines filtered
-- by counterparty_id = auth.uid().

-- ============================================================================
-- accounts
-- ============================================================================

alter table public.accounts enable row level security;

create policy accounts_staff_select on public.accounts
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- ============================================================================
-- periods
-- ============================================================================

alter table public.periods enable row level security;

create policy periods_staff_select on public.periods
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- ============================================================================
-- vat_rates
-- ============================================================================

alter table public.vat_rates enable row level security;

create policy vat_rates_staff_select on public.vat_rates
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- ============================================================================
-- counterparties
-- ============================================================================

alter table public.counterparties enable row level security;

create policy counterparties_staff_select on public.counterparties
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- ============================================================================
-- vendor_invoices
-- ============================================================================

alter table public.vendor_invoices enable row level security;

create policy vendor_invoices_staff_select on public.vendor_invoices
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- ============================================================================
-- fixed_assets
-- ============================================================================

alter table public.fixed_assets enable row level security;

create policy fixed_assets_staff_select on public.fixed_assets
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- ============================================================================
-- journal_entries
-- ============================================================================

alter table public.journal_entries enable row level security;

create policy journal_entries_staff_select on public.journal_entries
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- ============================================================================
-- journal_lines
-- ============================================================================

alter table public.journal_lines enable row level security;

create policy journal_lines_staff_select on public.journal_lines
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );
