-- Declining-price listings: a fixed-price listing whose price_cents decreases
-- on a schedule until floor_price_cents or a buyer purchases at the current
-- price. Built on the fixed-price rails (cart/reservation/EveryPay/order flow
-- is untouched) — this is NOT the auction machinery. Design doc:
-- docs/plans/2026-06-23-declining-price-design.md

-- 1. Extend listing_type to include 'declining'. Mirrors the exact mechanism
--    migration 032 used to add 'auction' — the original CHECK was inline with
--    no explicit name, so Postgres auto-named it listings_listing_type_check.
alter table listings drop constraint if exists listings_listing_type_check;
alter table listings add constraint listings_listing_type_check
  check (listing_type in ('fixed_price', 'auction', 'declining'));

-- 2. Schedule columns. Plain nullable columns, no cross-type CHECK coupling —
--    matches the existing auction columns (032_auctions.sql), which are also
--    nullable with no "listing_type='auction' implies non-null" constraint.
--    starting_price_cents (already on the table from the auction work) is
--    reused as the declining listing's opening price; price_cents remains the
--    effective current price so browse/sort/filter/search/JSON-LD need no
--    changes.
alter table listings
  add column floor_price_cents integer,
  add column decrement_cents integer,
  add column drop_interval_days integer,
  add column schedule_start_at timestamptz,
  add column next_drop_at timestamptz;

-- 3. Value-range checks (same spirit as the single-column
--    `starting_price_cents >= 50` check from migration 032). The
--    floor-vs-starting check is nominally cross-column but each clause is
--    written with an explicit `is null or` guard rather than relying on
--    implicit CHECK NULL-pass semantics, so it reads unambiguously: rows
--    where either side is null (any non-declining listing) are untouched by
--    this constraint, and declining rows get the real comparison.
alter table listings add constraint listings_floor_price_cents_check
  check (floor_price_cents is null or floor_price_cents >= 0);

alter table listings add constraint listings_decrement_cents_check
  check (decrement_cents is null or decrement_cents > 0);

alter table listings add constraint listings_drop_interval_days_check
  check (drop_interval_days is null or drop_interval_days >= 1);

alter table listings add constraint listings_floor_below_starting_check
  check (
    floor_price_cents is null
    or starting_price_cents is null
    or floor_price_cents < starting_price_cents
  );

-- 4. Partial index for the hourly apply-price-drops cron query
--    (WHERE listing_type = 'declining' AND status = 'active' AND
--    next_drop_at <= now()). next_drop_at is NULL once the floor is reached,
--    so the partial predicate keeps the index small and self-pruning.
create index if not exists idx_listings_next_drop_at
  on listings (next_drop_at)
  where next_drop_at is not null;
