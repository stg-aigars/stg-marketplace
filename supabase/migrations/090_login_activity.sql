-- Login-activity logging for fraud / account-takeover detection.
--
-- LEGAL POSTURE (per privacy lawyer review, 2026-04-30):
--   - Lawful basis: GDPR Art. 6(1)(f) legitimate interest (fraud prevention,
--     account-security protection — Recital 47 explicitly cites this).
--   - Retention: 30 days, automatic and irreversible deletion via the
--     /api/cron/cleanup-login-activity cron route. The 30-day window matches
--     the existing privacy-policy disclosure (§9 retention table — "Security
--     logs (IP, login activity) — 30 days").
--   - DSAR: erasure refused during the 30-day window per Art. 17(3)(b)
--     (legal obligation to ensure security) / Art. 21(1) (compelling
--     legitimate grounds). After 30 days the row is gone via the cron.
--   - DPIA: not required — does not meet Art. 35 high-risk thresholds.
--   - Data captured: user_id, raw IP address, user_agent, country (when
--     available), created_at. Country is nullable — the trigger source
--     (auth.sessions) does not record it; an optional app-side path can
--     populate it later from cf-ipcountry header on auth-callback flows.
--
-- CAPTURE MECHANISM:
--   AFTER INSERT trigger on auth.sessions (Supabase's internal session
--   table). One row in auth.sessions per fresh sign-in (refreshes update
--   the same row, they don't insert a new one), so this captures actual
--   login events rather than every request. Trigger is in-database — no
--   webhook configuration needed, survives DR rebuilds. SECURITY DEFINER
--   so it can write to public.login_activity from the auth schema's trigger
--   context, and wrapped in EXCEPTION so a failure here never blocks
--   sign-in (capture is best-effort; auth correctness is load-bearing).
--
--   IMPLICIT COUPLING TO SUPABASE-INTERNAL SCHEMA:
--   The trigger function references new.ip / new.user_agent / new.user_id
--   / new.created_at on auth.sessions. These columns are not part of any
--   documented stable Supabase contract — if a future GoTrue release renames
--   or drops them, the trigger will fail (gracefully — caught by the
--   EXCEPTION block, capture goes silent). Operationally:
--     - Renaming/dropping mirror_session_to_login_activity() requires
--       dropping trg_mirror_session_to_login_activity FIRST. Otherwise
--       every sign-in fails on the orphaned trigger reference.
--     - On Supabase upgrades, validate that auth.sessions still has the
--       four referenced columns. If a column rename lands, update the
--       function body to match.

create table public.login_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address inet,
  user_agent text,
  country text,
  created_at timestamptz not null default now()
);

comment on table public.login_activity is
  'Per-login security log for fraud / ATO detection. 30-day retention via cleanup-login-activity cron. Lawful basis: GDPR Art. 6(1)(f) legitimate interest (fraud prevention). See migration 090 header for full legal posture.';

-- Indexes: user-scoped queries (user views own activity), IP clustering
-- (multi-account-abuse detection), and the cleanup cron's time scan.
create index idx_login_activity_user_created
  on public.login_activity(user_id, created_at desc);
create index idx_login_activity_ip_created
  on public.login_activity(ip_address, created_at desc)
  where ip_address is not null;
create index idx_login_activity_created
  on public.login_activity(created_at);

alter table public.login_activity enable row level security;

-- Users can read their own activity (visibility into where their account
-- has been used from — also a GDPR-Art. 15 access-by-design pattern).
create policy login_activity_user_select on public.login_activity
  for select to authenticated using (user_id = auth.uid());

-- Staff read all.
create policy login_activity_staff_select on public.login_activity
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- No INSERT / UPDATE / DELETE policies — writes via the trigger run with
-- SECURITY DEFINER (postgres-owned), and the cleanup cron uses the service
-- role. End users + staff can never mutate this table directly.

-- ============================================================================
-- TRIGGER: mirror auth.sessions -> public.login_activity
-- ============================================================================

create or replace function public.mirror_session_to_login_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_activity (user_id, ip_address, user_agent, created_at)
  values (new.user_id, new.ip, new.user_agent, new.created_at);
  return new;
exception
  when others then
    -- Capture is best-effort — sign-in must succeed even if logging fails.
    raise warning 'login_activity mirror failed: %', sqlerrm;
    return new;
end;
$$;

create trigger trg_mirror_session_to_login_activity
  after insert on auth.sessions
  for each row execute function public.mirror_session_to_login_activity();

-- ============================================================================
-- RPC: suspicious-activity flagger (ported from the legacy STG migration 100)
-- ============================================================================
--
-- Returns users whose recent login pattern looks unusual. Default thresholds:
-- ≥5 distinct IPs in the last 7 days. Tuneable via parameters; staff UI
-- exposes the defaults but accepts overrides for investigation.
--
-- SECURITY DEFINER so it can read login_activity bypassing RLS — the API
-- route gates by is_staff before invoking. EXECUTE revoked from public/anon/
-- authenticated; only service role calls this through the API route.

create or replace function public.get_suspicious_login_activity(
  p_days integer default 7,
  p_min_unique_ips integer default 5
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  login_count bigint,
  distinct_ip_count bigint,
  distinct_country_count bigint,
  countries text[]
)
language sql
security definer
set search_path = public
as $$
  select
    la.user_id,
    up.full_name,
    up.email,
    count(*) as login_count,
    count(distinct la.ip_address) as distinct_ip_count,
    count(distinct la.country) as distinct_country_count,
    array_agg(distinct la.country) filter (where la.country is not null) as countries
  from public.login_activity la
  left join public.user_profiles up on up.id = la.user_id
  where la.created_at >= now() - (p_days || ' days')::interval
  group by la.user_id, up.full_name, up.email
  having count(distinct la.ip_address) >= p_min_unique_ips
  order by count(distinct la.ip_address) desc, count(*) desc
$$;

revoke execute on function public.get_suspicious_login_activity(integer, integer) from public, anon, authenticated;
grant execute on function public.get_suspicious_login_activity(integer, integer) to service_role;
