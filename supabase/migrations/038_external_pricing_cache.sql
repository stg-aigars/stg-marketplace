-- Migration: external pricing cache for BoardGamePrices.co.uk data
-- One row per game, upserted on cache miss. TTL enforced in application code (65 min).

CREATE TABLE external_pricing_cache (
  bgg_game_id INTEGER PRIMARY KEY REFERENCES games(id),
  cheapest_price_cents INTEGER,
  shop_name TEXT,
  source_url TEXT,
  offer_count INTEGER NOT NULL DEFAULT 0,
  response_json JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For TTL-based cache invalidation queries
CREATE INDEX idx_external_pricing_cache_fetched
  ON external_pricing_cache(fetched_at);

ALTER TABLE external_pricing_cache ENABLE ROW LEVEL SECURITY;

-- Public read (pricing data is not sensitive), writes via service role only
CREATE POLICY "Pricing cache is publicly readable"
  ON external_pricing_cache FOR SELECT USING (true);
