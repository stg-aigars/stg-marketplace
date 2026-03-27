-- Wanted Listings: buyers post games they're looking for, sellers make offers.
-- Reverse of shelf offers — same state machine, roles swapped.
-- Tables: wanted_listings, wanted_offers. Also adds wanted_offer_id FK to listings.

-- ============================================================================
-- WANTED LISTINGS TABLE
-- ============================================================================
-- Lightweight: game reference + buyer preferences (condition threshold, budget).
-- No photos, no detailed description — just what the buyer wants.

CREATE TABLE wanted_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  bgg_game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  game_name TEXT NOT NULL,
  game_year INTEGER,
  -- Minimum acceptable condition (threshold — buyer accepts this or better)
  min_condition TEXT NOT NULL DEFAULT 'acceptable'
    CHECK (min_condition IN ('like_new', 'very_good', 'good', 'acceptable', 'for_parts')),
  -- Optional budget guidance (not enforced on offers — sellers can offer above)
  max_price_cents INTEGER CHECK (max_price_cents IS NULL OR (max_price_cents >= 50 AND max_price_cents <= 9999999)),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  country TEXT NOT NULL CHECK (country IN ('LV', 'LT', 'EE')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active wanted listing per game per buyer
CREATE UNIQUE INDEX idx_wanted_listings_buyer_game_active
  ON wanted_listings(buyer_id, bgg_game_id)
  WHERE status = 'active';

-- Public browse: newest first, active only
CREATE INDEX idx_wanted_listings_browse
  ON wanted_listings(created_at DESC)
  WHERE status = 'active';

-- Buyer's own wanted listings
CREATE INDEX idx_wanted_listings_buyer
  ON wanted_listings(buyer_id, created_at DESC);

-- Lookup by game (for matching sellers)
CREATE INDEX idx_wanted_listings_game
  ON wanted_listings(bgg_game_id)
  WHERE status = 'active';

CREATE TRIGGER update_wanted_listings_updated_at
  BEFORE UPDATE ON wanted_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- WANTED LISTINGS RLS
-- ============================================================================

ALTER TABLE wanted_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active wanted listings (public marketplace)
CREATE POLICY "Anyone can view active wanted listings" ON wanted_listings
  FOR SELECT USING (status = 'active' OR auth.uid() = buyer_id);

-- Buyers can create their own wanted listings
CREATE POLICY "Buyers can create own wanted listings" ON wanted_listings
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Buyers can update their own wanted listings
CREATE POLICY "Buyers can update own wanted listings" ON wanted_listings
  FOR UPDATE USING (auth.uid() = buyer_id);

-- Buyers can delete their own wanted listings
CREATE POLICY "Buyers can delete own wanted listings" ON wanted_listings
  FOR DELETE USING (auth.uid() = buyer_id);

-- ============================================================================
-- WANTED OFFERS TABLE
-- ============================================================================
-- Sellers make offers on buyer wanted listings. Same state machine as shelf
-- offers but roles reversed: seller initiates, buyer counters/accepts.
-- Single-round counter only — no multi-round negotiation.
--
-- State machine:
--   pending   → accepted | countered | declined | expired | cancelled
--   countered → accepted | declined | expired | cancelled
--   accepted  → completed (seller creates listing) | expired (3-day deadline)

CREATE TABLE wanted_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wanted_listing_id UUID NOT NULL REFERENCES wanted_listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES user_profiles(id),
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  condition TEXT NOT NULL
    CHECK (condition IN ('like_new', 'very_good', 'good', 'acceptable', 'for_parts')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 50 AND price_cents <= 9999999),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  counter_price_cents INTEGER
    CHECK (counter_price_cents IS NULL OR (counter_price_cents >= 50 AND counter_price_cents <= 9999999)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'expired', 'cancelled', 'completed')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active offer per seller per wanted listing
CREATE UNIQUE INDEX idx_wanted_offers_active_per_seller
  ON wanted_offers(wanted_listing_id, seller_id)
  WHERE status IN ('pending', 'countered');

-- Seller's sent offers
CREATE INDEX idx_wanted_offers_seller
  ON wanted_offers(seller_id, created_at DESC);

-- Buyer's received offers
CREATE INDEX idx_wanted_offers_buyer
  ON wanted_offers(buyer_id, created_at DESC);

-- Cron: find expired wanted offers
CREATE INDEX idx_wanted_offers_expiry
  ON wanted_offers(expires_at)
  WHERE status IN ('pending', 'countered');

-- Cron: find accepted wanted offers past listing deadline
CREATE INDEX idx_wanted_offers_accepted_deadline
  ON wanted_offers(updated_at)
  WHERE status = 'accepted';

CREATE TRIGGER update_wanted_offers_updated_at
  BEFORE UPDATE ON wanted_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- WANTED OFFERS RLS
-- ============================================================================

ALTER TABLE wanted_offers ENABLE ROW LEVEL SECURITY;

-- Buyers and sellers can read their own wanted offers
CREATE POLICY "Users can view own wanted offers" ON wanted_offers
  FOR SELECT USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id
  );

-- Sellers can create offers on wanted listings (not on their own)
CREATE POLICY "Sellers can create wanted offers" ON wanted_offers
  FOR INSERT WITH CHECK (
    auth.uid() = seller_id
    AND auth.uid() != buyer_id
  );

-- All status transitions go through service role (same pattern as shelf offers)

-- ============================================================================
-- ADD wanted_offer_id FK TO LISTINGS
-- ============================================================================
-- Tracks which wanted offer a listing was created from (nullable).
-- Mirrors existing offer_id for shelf offers.

ALTER TABLE listings
  ADD COLUMN wanted_offer_id UUID REFERENCES wanted_offers(id);
