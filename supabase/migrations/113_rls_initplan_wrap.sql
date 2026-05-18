-- 113_rls_initplan_wrap.sql
--
-- Wrap auth.<fn>() calls inside RLS policies in (select auth.<fn>()) so
-- Postgres evaluates the auth function once per query (InitPlan node)
-- instead of once per row. Same row-visibility semantics; reduces
-- per-query overhead on authenticated reads at scale.
--
-- Per Supabase performance advisor lint `auth_rls_initplan`:
-- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
--
-- DELIBERATELY NOT FIXED: `multiple_permissive_policies` on `public.invoices`.
-- The two policies below (`Sellers can view own invoices` and `Buyers can
-- view own invoices`) could be OR-combined into a single policy to halve
-- per-query evaluations. We keep them split because `invoices` is a
-- regulatory table and the named per-role policies carry audit clarity
-- worth more than the marginal saving. The multiple_permissive_policies
-- advisor lint should remain open after this migration — do not "fix" it
-- in a future advisor sweep.

-- invoices ---------------------------------------------------------------
drop policy if exists "Sellers can view own invoices" on public.invoices;
create policy "Sellers can view own invoices" on public.invoices for select
  using (exists (
    select 1 from public.orders
    where orders.id = invoices.order_id
      and orders.seller_id = (select auth.uid())
  ));

drop policy if exists "Buyers can view own invoices" on public.invoices;
create policy "Buyers can view own invoices" on public.invoices for select
  using (exists (
    select 1 from public.orders
    where orders.id = invoices.order_id
      and orders.buyer_id = (select auth.uid())
  ));

-- dsa_notices ------------------------------------------------------------
drop policy if exists dsa_notices_staff_read on public.dsa_notices;
create policy dsa_notices_staff_read on public.dsa_notices
  for select to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = (select auth.uid()) and is_staff = true
    )
  );

drop policy if exists dsa_notices_staff_update on public.dsa_notices;
create policy dsa_notices_staff_update on public.dsa_notices
  for update to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = (select auth.uid()) and is_staff = true
    )
  );

-- oss_submissions --------------------------------------------------------
drop policy if exists oss_submissions_insert on public.oss_submissions;
create policy oss_submissions_insert on public.oss_submissions
  for insert to authenticated with check (
    exists (
      select 1 from public.user_profiles
      where id = (select auth.uid()) and is_staff = true
    )
  );

drop policy if exists oss_submissions_select on public.oss_submissions;
create policy oss_submissions_select on public.oss_submissions
  for select to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = (select auth.uid()) and is_staff = true
    )
  );

drop policy if exists oss_submissions_update_payment on public.oss_submissions;
create policy oss_submissions_update_payment on public.oss_submissions
  for update to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = (select auth.uid()) and is_staff = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where id = (select auth.uid()) and is_staff = true
    )
  );

-- login_activity ---------------------------------------------------------
drop policy if exists login_activity_user_select on public.login_activity;
create policy login_activity_user_select on public.login_activity
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists login_activity_staff_select on public.login_activity;
create policy login_activity_staff_select on public.login_activity
  for select to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = (select auth.uid()) and is_staff = true
    )
  );
