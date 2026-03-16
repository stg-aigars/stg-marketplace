-- ============================================
-- STG Marketplace MVP Schema
-- 4 tables + RLS policies + triggers
-- All monetary values in INTEGER CENTS
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USER PROFILES
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,             -- Denormalized from auth.users for easier querying
  country TEXT NOT NULL CHECK (country IN ('LV', 'EE', 'LT')),
  preferred_locale TEXT DEFAULT 'en',
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', 'LV')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- GAMES (BGG Game Catalog)
-- Populated via CSV import, enriched on-demand
-- ============================================

CREATE TABLE games (
  id INTEGER PRIMARY KEY,              -- BGG game ID (not auto-generated)
  name TEXT NOT NULL,                  -- Primary game title
  yearpublished INTEGER,               -- Year of first publication
  is_expansion BOOLEAN DEFAULT FALSE,  -- True if this is an expansion
  thumbnail TEXT,                      -- BGG thumbnail URL (fetched on-demand)
  image TEXT,                          -- BGG full image URL (fetched on-demand)
  alternate_names JSONB,               -- Array of alternate/localized titles
  bayesaverage DECIMAL(5,2),           -- BGG Bayesian average rating
  player_count TEXT,                   -- e.g., "2-4"
  min_age INTEGER,                     -- Minimum recommended age
  playing_time TEXT,                   -- e.g., "60-90"
  description TEXT,                    -- Full game description from BGG
  designers JSONB,                     -- Array of designer names
  metadata_fetched_at TIMESTAMPTZ,     -- When metadata was last fetched from BGG API
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_games_name_lower ON games (lower(name));
CREATE INDEX idx_games_base_games ON games (id) WHERE is_expansion = FALSE;

-- RLS: public read-only, writes via service role
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are publicly readable"
  ON games FOR SELECT
  USING (true);

-- ============================================
-- LISTINGS
-- ============================================

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  -- Game reference (FK to games catalog)
  bgg_game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  game_name TEXT NOT NULL,             -- Denormalized from games.name for query performance
  game_year INTEGER,                   -- Denormalized from games.yearpublished
  -- Version/edition details (from BGG API or manual entry)
  version_source TEXT NOT NULL CHECK (version_source IN ('bgg', 'manual')),
  bgg_version_id INTEGER,             -- BGG version ID (null if version_source = 'manual')
  version_name TEXT,                   -- e.g., "German First Edition"
  publisher TEXT,                      -- Publisher name(s), comma-separated if multiple
  language TEXT,                       -- Language(s) — critical for Baltic market
  edition_year INTEGER,                -- Year of this specific edition
  -- Listing details
  condition TEXT NOT NULL CHECK (condition IN ('like_new', 'very_good', 'good', 'acceptable', 'for_parts')),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'reserved')),
  photos TEXT[] DEFAULT '{}',
  country TEXT NOT NULL,               -- Inherited from seller's country
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_country ON listings(country);
CREATE INDEX idx_listings_created ON listings(created_at DESC);
CREATE INDEX idx_listings_bgg_game_id ON listings(bgg_game_id);

-- RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON listings FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "Authenticated users can create listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = seller_id);

-- ============================================
-- ORDERS
-- ============================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  seller_id UUID NOT NULL REFERENCES user_profiles(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  status TEXT NOT NULL DEFAULT 'pending_seller' CHECK (
    status IN ('pending_seller', 'accepted', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed', 'refunded')
  ),
  total_amount_cents INTEGER NOT NULL,
  items_total_cents INTEGER NOT NULL,
  shipping_cost_cents INTEGER NOT NULL DEFAULT 0,
  seller_country TEXT NOT NULL,       -- Snapshot for VAT (LV=21%, LT=21%, EE=24%)
  terminal_id TEXT,
  terminal_name TEXT,
  terminal_country TEXT,
  everypay_payment_reference TEXT,
  everypay_payment_state TEXT,
  payment_method TEXT,                -- 'card', 'bank_link', 'wallet'
  platform_commission_cents INTEGER,
  buyer_wallet_debit_cents INTEGER DEFAULT 0,
  seller_wallet_credit_cents INTEGER,
  wallet_credited_at TIMESTAMPTZ,
  refund_status TEXT,
  refund_amount_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_ref ON orders(everypay_payment_reference);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers and sellers can view their orders"
  ON orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- No INSERT policy: orders are created exclusively via service role (which bypasses RLS).
-- A WITH CHECK (true) policy would allow any authenticated user to insert orders directly.

CREATE POLICY "Participants can update orders"
  ON orders FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- ============================================
-- STORAGE BUCKET FOR LISTING PHOTOS
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'listing-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view listing photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
