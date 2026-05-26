-- Adds price-drop tracking to listings + a generated boolean for the
-- browse "Price drops only" filter. Design: docs/plans/2026-05-26-price-drop-design.md
--
-- Single-writer invariant
-- -----------------------
-- The BEFORE UPDATE trigger below is the authoritative writer for
-- previous_price_cents and price_changed_at. Application code MUST NOT
-- write these columns directly — the trigger overwrites caller payload on
-- every UPDATE where price_cents changes. Not enforced via column-level
-- GRANT; relying on this comment + code review. If a future BEFORE UPDATE
-- trigger is added to listings, verify trigger ordering deliberately.
--
-- Direction discipline
-- --------------------
-- Trigger fires on any price change (drop or increase). "Drop" semantics
-- (price_cents < previous_price_cents) are applied at the read path via
-- the has_price_decrease generated column + the 14d visibility window.
-- Increases silently reset the baseline so the next decrease is measured
-- from the new baseline.
--
-- Auction guard
-- -------------
-- Trigger checks OLD.listing_type AND NEW.listing_type are both
-- 'fixed_price'. This closes the auction→fixed_price conversion misfire
-- window. price_cents on auctions is the current high bid, not seller
-- intent, so auctions are excluded by construction.
--
-- Trigger / generated-column ordering
-- -----------------------------------
-- BEFORE triggers run before STORED generated-column computation, so
-- has_price_decrease reflects the trigger's updated previous_price_cents.
--
-- Generated column scope
-- ----------------------
-- STORED is required so the value is materialized and indexable
-- (VIRTUAL columns cannot be referenced in partial indexes). Adding a
-- STORED column to a populated table computes the value for every row at
-- migration time. At ~10k listings this is milliseconds; at 10M+ would
-- be a concern.
--
-- Index predicate vs. query predicate
-- -----------------------------------
-- The partial index predicate is `where has_price_decrease`. The browse
-- query additionally filters `price_changed_at > now() - 14d AND
-- price_changed_at <= now()`. The upper bound (clock-skew / future-dated
-- defense) is intentionally omitted from the index predicate because
-- now() is not immutable and cannot appear there. Rows with future-dated
-- price_changed_at remain in the index but are filtered out by the query.
--
-- CONCURRENTLY note
-- -----------------
-- Migrations in this repo are applied via Supabase MCP `apply_migration`
-- which wraps the file in a transaction; CREATE INDEX CONCURRENTLY is
-- incompatible with that. Plain CREATE INDEX is the codebase convention
-- (see migration 101 for the same reasoning on games). Listings is ~10k
-- rows; the brief AccessExclusive lock is acceptable.
--
-- Schema scope
-- ------------
-- Retains the most recent price change only. Historical drops are not
-- retained — by design. An event-sourced drop log is a deferred follow-up.
--
-- Rollback order
-- --------------
-- If this migration ever needs to be rolled back, drop in dependency
-- order:
--   drop index if exists idx_listings_recent_drops;
--   alter table listings drop column if exists has_price_decrease;
--   drop trigger if exists trg_listings_track_price_change on listings;
--   drop function if exists listings_track_price_change();
--   alter table listings drop column if exists price_changed_at;
--   alter table listings drop column if exists previous_price_cents;

alter table listings
  add column previous_price_cents integer,
  add column price_changed_at     timestamptz;

create function listings_track_price_change() returns trigger
language plpgsql as $$
begin
  if old.listing_type <> 'fixed_price' or new.listing_type <> 'fixed_price' then
    return new;
  end if;
  if new.price_cents is distinct from old.price_cents then
    new.previous_price_cents := old.price_cents;
    new.price_changed_at     := now();
  end if;
  return new;
end $$;

create trigger trg_listings_track_price_change
before update on listings
for each row execute function listings_track_price_change();

alter table listings
  add column has_price_decrease boolean
  generated always as (price_cents < previous_price_cents) stored;

create index if not exists idx_listings_recent_drops
  on listings (price_changed_at desc)
  where has_price_decrease;
