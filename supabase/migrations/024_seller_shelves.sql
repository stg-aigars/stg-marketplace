-- Seller Shelves: shelf_items, offers, and bgg_username on user_profiles
-- Sellers showcase their game collection publicly. Each game can be
-- "not for sale," "open to offers," or "listed" (linked to an active listing).
-- Buyers make structured price offers on unlisted games.

-- ============================================================================
-- BGG USERNAME ON USER PROFILES
-- ============================================================================
-- Optional BGG username for collection import feature.

ALTER TABLE user_profiles
  ADD COLUMN bgg_username TEXT CHECK (bgg_username IS NULL OR char_length(bgg_username) <= 50);

-- ============================================================================
-- SHELF ITEMS TABLE
-- ============================================================================
-- Lightweight entries: game reference + visibility + notes. No photos/condition/price.
-- One entry per game per seller (UNIQUE constraint).

CREATE TABLE shelf_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  bgg_game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  game_name TEXT NOT NULL,                -- Denormalized from games.name
  game_year INTEGER,                      -- Denormalized from games.yearpublished
  visibility TEXT NOT NULL DEFAULT 'not_for_sale'
    CHECK (visibility IN ('not_for_sale', 'open_to_offers', 'listed')),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One shelf entry per game per seller
CREATE UNIQUE INDEX idx_shelf_items_seller_game ON shelf_items(seller_id, bgg_game_id);

-- Public browsing: fetch a seller's shelf
CREATE INDEX idx_shelf_items_seller ON shelf_items(seller_id, created_at DESC);

-- Look up shelf item when a listing is created (for auto-linking)
CREATE INDEX idx_shelf_items_seller_bgg ON shelf_items(seller_id, bgg_game_id)
  WHERE listing_id IS NULL;

CREATE TRIGGER update_shelf_items_updated_at
  BEFORE UPDATE ON shelf_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SHELF ITEMS RLS
-- ============================================================================

ALTER TABLE shelf_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read shelf items (public storefront)
CREATE POLICY "Anyone can view shelf items" ON shelf_items
  FOR SELECT USING (true);

-- Sellers can insert their own shelf items
CREATE POLICY "Sellers can insert own shelf items" ON shelf_items
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own shelf items
CREATE POLICY "Sellers can update own shelf items" ON shelf_items
  FOR UPDATE USING (auth.uid() = seller_id);

-- Sellers can delete their own shelf items
CREATE POLICY "Sellers can delete own shelf items" ON shelf_items
  FOR DELETE USING (auth.uid() = seller_id);

-- ============================================================================
-- OFFERS TABLE
-- ============================================================================
-- Structured price offers on shelf items. Single-round counter allowed.
-- State machine: pending → accepted | countered | declined | expired | cancelled
--                countered → accepted | declined | expired | cancelled
--                accepted → completed (listing created + purchased)

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shelf_item_id UUID NOT NULL REFERENCES shelf_items(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  seller_id UUID NOT NULL REFERENCES user_profiles(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 50 AND amount_cents <= 9999999),
  counter_amount_cents INTEGER CHECK (counter_amount_cents IS NULL OR (counter_amount_cents >= 50 AND counter_amount_cents <= 9999999)),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'expired', 'cancelled', 'completed')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active offer per buyer per shelf item
CREATE UNIQUE INDEX idx_offers_active_per_buyer
  ON offers(shelf_item_id, buyer_id)
  WHERE status IN ('pending', 'countered');

-- Seller's received offers (for the offers management page)
CREATE INDEX idx_offers_seller ON offers(seller_id, created_at DESC);

-- Buyer's sent offers
CREATE INDEX idx_offers_buyer ON offers(buyer_id, created_at DESC);

-- Cron job: find expired offers efficiently
CREATE INDEX idx_offers_expiry ON offers(expires_at)
  WHERE status IN ('pending', 'countered');

-- Cron job: find accepted offers past listing deadline
CREATE INDEX idx_offers_accepted_deadline ON offers(updated_at)
  WHERE status = 'accepted';

CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- OFFERS RLS
-- ============================================================================

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Buyers and sellers can read their own offers
CREATE POLICY "Users can view own offers" ON offers
  FOR SELECT USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id
  );

-- Buyers can create offers (visibility validation is in app layer —
-- CHECK constraints can't reference other tables)
CREATE POLICY "Buyers can create offers" ON offers
  FOR INSERT WITH CHECK (
    auth.uid() = buyer_id
    AND auth.uid() != seller_id
  );

-- All status transitions go through service role (same pattern as orders)
-- This ensures state machine validation happens in application code.

-- ============================================================================
-- HELPER: count shelf items for a seller (public, no sensitive data)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_seller_shelf_count(p_seller_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM shelf_items
  WHERE seller_id = p_seller_id;
$$;

GRANT EXECUTE ON FUNCTION get_seller_shelf_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_seller_shelf_count(uuid) TO authenticated;
