-- ============================================
-- LISTING EXPANSIONS
-- Allows listings to include expansion games
-- bundled with the base game.
-- ============================================

CREATE TABLE listing_expansions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bgg_game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  game_name TEXT NOT NULL,
  version_source TEXT CHECK (version_source IN ('bgg', 'manual')),
  bgg_version_id INTEGER,
  version_name TEXT,
  publisher TEXT,
  language TEXT,
  edition_year INTEGER,
  version_thumbnail TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Composite unique: same expansion can't be added twice to one listing.
  -- Also serves as index for listing_id lookups (leftmost column).
  UNIQUE(listing_id, bgg_game_id)
);

-- RLS
ALTER TABLE listing_expansions ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see what expansions are included in a listing
CREATE POLICY "Anyone can view listing expansions"
  ON listing_expansions FOR SELECT
  USING (true);

-- Sellers can insert expansions for their own listings
CREATE POLICY "Sellers can add expansions to own listings"
  ON listing_expansions FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT seller_id FROM listings WHERE id = listing_id)
  );

-- Sellers can update expansion version info on own listings
CREATE POLICY "Sellers can update expansions on own listings"
  ON listing_expansions FOR UPDATE
  USING (
    auth.uid() = (SELECT seller_id FROM listings WHERE id = listing_id)
  );

-- Sellers can remove expansions from own listings
CREATE POLICY "Sellers can delete expansions from own listings"
  ON listing_expansions FOR DELETE
  USING (
    auth.uid() = (SELECT seller_id FROM listings WHERE id = listing_id)
  );
