-- PR 0b (second migration of two) — Tighten retention_class to NOT NULL.
--
-- This migration runs after the code change in audit.ts has been deployed.
-- Every emission site now passes retention_class explicitly, so any new rows
-- land with a non-null value. Existing rows were backfilled in migration 084.
--
-- The defensive UPDATE below closes a deploy race window: between migration
-- 084 running and this migration running, in-flight requests / workers that
-- started before the audit.ts deploy can briefly emit rows without the column
-- (column was nullable, value was undefined → NULL). Misclassifying race-
-- window rows as 'operational' is the safe direction — worst case is a few
-- last-30-day events drop at the next cleanup-cron run, not silent
-- regulatory data loss.

update public.audit_log
   set retention_class = 'operational'
 where retention_class is null;

alter table public.audit_log
  alter column retention_class set not null;
