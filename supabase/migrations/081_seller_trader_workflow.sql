-- Phase 7 of PTAC distance-trading compliance plan.
-- Adds the rolling 12-month trader-volume counters + the soft-touch verification
-- workflow columns the lawyer's 2026-04-28 framework requires
-- (filed at docs/legal_audit/trader-detection-deferral.md).

alter table public.user_profiles
  -- Counters (rolling 12 months, refreshed daily by trader-signals cron)
  add column completed_sales_12mo_count integer not null default 0,
  add column completed_sales_12mo_revenue_cents integer not null default 0,
  -- Signal state (advisory at launch; never auto-mutates seller_status)
  add column trader_signal_first_crossed_at timestamptz,
  add column trader_signal_threshold_version text,
  -- Verification workflow (lawyer-required soft-touch step before suspension)
  add column verification_requested_at timestamptz,
  add column verification_response text check (verification_response in ('collector','trader','unresponsive')),
  add column verification_responded_at timestamptz;

create index idx_user_profiles_trader_signal on public.user_profiles(trader_signal_first_crossed_at)
  where trader_signal_first_crossed_at is not null;

create index idx_user_profiles_verification_pending on public.user_profiles(verification_requested_at)
  where verification_requested_at is not null and verification_response is null;

comment on column public.user_profiles.trader_signal_first_crossed_at is
  'Set when seller first crosses the verification trigger in TRADER_THRESHOLDS (25 sales OR €1,800 revenue, rolling 12 months). Surfaces to staff dashboard. Does not auto-suspend. See docs/legal_audit/trader-detection-deferral.md.';

comment on column public.user_profiles.verification_requested_at is
  'When staff sent the soft-touch verification email (Phase 7). Sets the 14-day clock for verification-escalation cron.';

comment on column public.user_profiles.verification_response is
  'Seller''s self-classification: collector (private cull), trader (commercial), or unresponsive (no reply within 14d). Becomes structured evidence in any subsequent dismissal or suspension audit event.';
