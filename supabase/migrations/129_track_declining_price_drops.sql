-- Extends price-drop tracking (migration 122) to declining-price listings
-- (migration 128), so the browse "Price drops" filter and the homepage
-- price-drops rail surface a declining listing once it has ACTUALLY dropped —
-- not at listing time. Design: docs/plans/2026-05-26-price-drop-design.md +
-- docs/plans/2026-06-23-declining-price-design.md
--
-- What changed vs. migration 122
-- ------------------------------
-- 122's guard short-circuited unless BOTH old and new listing_type were
-- 'fixed_price'. That excluded declining listings entirely, so their
-- cron-applied drops (apply-price-drops) never populated
-- previous_price_cents / price_changed_at. This migration widens the tracked
-- set to {'fixed_price','declining'} so the apply-price-drops cron's
-- price_cents UPDATE records the drop via the same single-writer trigger.
--
-- Single-writer invariant (unchanged)
-- -----------------------------------
-- This BEFORE UPDATE trigger remains the authoritative writer for
-- previous_price_cents and price_changed_at. Application code MUST NOT write
-- these columns directly — the trigger overwrites caller payload on every
-- UPDATE. The apply-price-drops cron writes price_cents + next_drop_at only;
-- the trigger fills the tracking columns. convertListingToDeclining writes
-- listing_type + schedule columns only (see baseline-reset note below).
--
-- Type-change baseline reset (new in 129)
-- ---------------------------------------
-- On ANY listing_type change we now NULL out previous_price_cents and
-- price_changed_at, then return early. Rationale: a fixed-price listing that
-- was dropped (e.g. 2500 -> 2000, has_price_decrease = true, recent
-- price_changed_at) and then converted to declining keeps price_cents at the
-- starting value and, under 122, kept those stale tracking columns too. Once
-- isPriceDropActive() includes declining (this PR), that just-converted
-- listing would surface a drop inherited from its fixed-price life — before
-- any declining drop has occurred — until the first cron drop overwrote the
-- columns. Resetting the baseline on the type-change UPDATE makes a converted
-- listing start clean (has_price_decrease computes to NULL); only a real
-- declining drop sets the fields. This still closes 122's auction conversion
-- misfire window: any type change (old <> new) short-circuits before the
-- price-cents comparison, so a conversion is never recorded as a "drop".
-- Auctions stay excluded by construction — 'auction' is not in the tracked
-- set, so a steady-state auction price_cents change (current high bid) never
-- records, and a conversion into/out of auction hits the reset-and-return path.
--
-- Direction discipline / window / generated-column ordering / index predicate
-- --------------------------------------------------------------------------
-- All unchanged from 122. "Drop" semantics (price_cents < previous_price_cents)
-- live in the has_price_decrease generated column; the 14d visibility window is
-- applied at the read path. No schema change here — function body only.
--
-- No backfill
-- -----------
-- Existing declining listings have not dropped under the new tracking, so
-- their previous_price_cents / price_changed_at stay NULL until their first
-- post-deploy cron drop populates them via this trigger. This is exactly the
-- "only when it drops as declining" contract — no data migration required.
--
-- Rollback
-- --------
-- Restore migration 122's function body via another create or replace; the
-- trigger and generated column are untouched by this migration.

create or replace function listings_track_price_change() returns trigger
language plpgsql as $$
begin
  if old.listing_type is distinct from new.listing_type then
    new.previous_price_cents := null;
    new.price_changed_at     := null;
    return new;
  end if;
  if new.listing_type not in ('fixed_price', 'declining') then
    return new;
  end if;
  if new.price_cents is distinct from old.price_cents then
    new.previous_price_cents := old.price_cents;
    new.price_changed_at     := now();
  end if;
  return new;
end $$;
