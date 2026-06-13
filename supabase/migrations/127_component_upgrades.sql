-- Component upgrades on listings + BGG accessory cache.
--
-- Feedback: sellers want to declare that their pre-loved copy includes component
-- upgrades / extras (metal coins, custom inserts, upgraded tokens, sleeves, …).
-- The BGG "accessories section" is the source list the seller picks from.
--
-- BGG accessory data is noisy (Gloomhaven has 69 boardgameaccessory links,
-- dominated by per-token SKUs and third-party inserts), so the sell flow lets the
-- seller SEARCH the cached list and tick matches, plus free-text anything missing.

-- 1. Cache the game's BGG accessory list, mirroring the existing `versions` cache
--    (migration 006). Lazily fetched + cached so the sell flow doesn't depend on
--    the BGG API being up at listing-creation time.
ALTER TABLE games
  ADD COLUMN accessories JSONB,
  ADD COLUMN accessories_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN games.accessories IS
  'Cached BGG boardgameaccessory links: [{ id: number, name: string }]. Full list (noisy); the sell flow filters by search, not by pre-filtering.';

-- 2. The seller's per-listing declaration. Lightweight label list (id + name), not a
--    child table like listing_expansions — component upgrades are tags, not
--    first-class entities with their own version/condition/photos.
--    Shape: [{ bgg_accessory_id: number | null, name: string }]. Free-text entries
--    (not in BGG's list) have bgg_accessory_id = null. NULL / empty array = none.
ALTER TABLE listings
  ADD COLUMN component_upgrades JSONB;

COMMENT ON COLUMN listings.component_upgrades IS
  'Seller-declared included extras: [{ bgg_accessory_id: number | null, name: string }]. Free-text items have null id. NULL/empty = none declared.';
