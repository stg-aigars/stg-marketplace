-- Post-implementation-review fix for PR #214: dismissal-loop.
--
-- The original Phase 7 design had `dismissTraderSignal` clear
-- `trader_signal_first_crossed_at` to null to "mark the signal reviewed."
-- But the 12-month rolling counters don't reset, so the daily trader-signals
-- cron's first-crossing guard (signal === 'verify' && !trader_signal_first_crossed_at)
-- treats the dismissed seller as a fresh first-crossing and re-fires
-- seller.trader_signal_crossed within 24 hours. The mandatory dismissal-
-- logging audit trail (lawyer 2026-04-28 requirement) is undone before it's
-- useful. Fix: separate sentinel column for dismissal; cron's first-crossing
-- guard requires both crossing-not-recorded AND not-dismissed-at-this-version.

alter table public.user_profiles
  add column trader_signal_dismissed_at timestamptz,
  add column trader_signal_dismissed_threshold_version text;

create index idx_user_profiles_trader_signal_dismissed on public.user_profiles(trader_signal_dismissed_at)
  where trader_signal_dismissed_at is not null;

comment on column public.user_profiles.trader_signal_dismissed_at is
  'When staff dismissed a trader-volume signal with rationale (Phase 7 + PR #214 post-review fix). Used by trader-signals cron to suppress re-firing seller.trader_signal_crossed for the same threshold version. Cleared if TRADER_THRESHOLDS.version changes (a new threshold definition restarts the review window).';

comment on column public.user_profiles.trader_signal_dismissed_threshold_version is
  'The TRADER_THRESHOLDS.version at the moment of dismissal. If the version changes (new threshold definition), the cron treats the seller as a fresh review candidate.';
