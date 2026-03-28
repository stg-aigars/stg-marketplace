-- Auctions: extends listings table with auction fields, adds bids table,
-- and a place_bid RPC for atomic bid placement with snipe protection.

-- ============================================================================
-- EXTEND LISTINGS TABLE
-- ============================================================================

-- Add listing type
ALTER TABLE listings
  ADD COLUMN listing_type TEXT NOT NULL DEFAULT 'fixed_price'
    CHECK (listing_type IN ('fixed_price', 'auction'));

-- Add auction-specific fields
ALTER TABLE listings
  ADD COLUMN auction_end_at TIMESTAMPTZ,
  ADD COLUMN auction_original_end_at TIMESTAMPTZ,
  ADD COLUMN starting_price_cents INTEGER CHECK (starting_price_cents IS NULL OR starting_price_cents >= 50),
  ADD COLUMN current_bid_cents INTEGER,
  ADD COLUMN bid_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN highest_bidder_id UUID REFERENCES user_profiles(id),
  ADD COLUMN payment_deadline_at TIMESTAMPTZ,
  ADD COLUMN auction_payment_reminder_sent BOOLEAN NOT NULL DEFAULT false;

-- Add 'auction_ended' to status constraint
-- Must drop and recreate since CHECK constraints can't be altered in-place
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('active', 'sold', 'cancelled', 'reserved', 'auction_ended'));

-- Indexes for auction queries
CREATE INDEX idx_listings_auction_end
  ON listings(auction_end_at)
  WHERE listing_type = 'auction' AND status = 'active';

CREATE INDEX idx_listings_auction_payment_deadline
  ON listings(payment_deadline_at)
  WHERE status = 'auction_ended' AND payment_deadline_at IS NOT NULL;

CREATE INDEX idx_listings_type_status
  ON listings(listing_type, status, auction_end_at DESC);

-- ============================================================================
-- BIDS TABLE
-- ============================================================================

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES user_profiles(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient highest-bid lookup
CREATE INDEX idx_bids_listing_amount ON bids(listing_id, amount_cents DESC);

-- Bid history display (newest first)
CREATE INDEX idx_bids_listing_created ON bids(listing_id, created_at DESC);

-- User's bid history
CREATE INDEX idx_bids_bidder ON bids(bidder_id, created_at DESC);

-- ============================================================================
-- BIDS RLS
-- ============================================================================

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Anyone can read bids (transparency builds trust)
CREATE POLICY "Anyone can view bids" ON bids
  FOR SELECT USING (true);

-- Authenticated users can insert their own bids (actual validation in RPC)
CREATE POLICY "Users can insert own bids" ON bids
  FOR INSERT WITH CHECK (auth.uid() = bidder_id);

-- ============================================================================
-- PLACE BID RPC
-- ============================================================================
-- Atomic bid placement: validates, inserts bid, updates listing denormalized
-- fields, and handles snipe protection — all in one transaction.

CREATE OR REPLACE FUNCTION place_bid(
  p_listing_id UUID,
  p_bidder_id UUID,
  p_amount_cents INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_min_bid INTEGER;
  v_new_end_at TIMESTAMPTZ;
  v_prev_bidder_id UUID;
BEGIN
  -- Verify caller identity (prevent bidder spoofing via SECURITY DEFINER)
  IF p_bidder_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Lock the listing row to prevent concurrent bid races
  SELECT id, seller_id, listing_type, status, auction_end_at,
         starting_price_cents, current_bid_cents, bid_count, highest_bidder_id
  INTO v_listing
  FROM listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  -- Validate listing is an active auction
  IF v_listing.listing_type != 'auction' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is not an auction listing');
  END IF;

  IF v_listing.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This auction is no longer active');
  END IF;

  IF v_listing.auction_end_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This auction has ended');
  END IF;

  -- Bidder cannot be the seller
  IF p_bidder_id = v_listing.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot bid on your own auction');
  END IF;

  -- No self-outbidding (already the highest bidder)
  IF p_bidder_id = v_listing.highest_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the highest bidder');
  END IF;

  -- Calculate minimum bid: starting price if no bids, else current + €1
  IF v_listing.current_bid_cents IS NULL THEN
    v_min_bid := v_listing.starting_price_cents;
  ELSE
    v_min_bid := v_listing.current_bid_cents + 100;
  END IF;

  IF p_amount_cents < v_min_bid THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Minimum bid is %s cents', v_min_bid));
  END IF;

  -- Remember previous highest bidder for outbid notification
  v_prev_bidder_id := v_listing.highest_bidder_id;

  -- Insert bid
  INSERT INTO bids (listing_id, bidder_id, amount_cents)
  VALUES (p_listing_id, p_bidder_id, p_amount_cents);

  -- Snipe protection: if bid within last 5 minutes, extend by 5 minutes
  v_new_end_at := v_listing.auction_end_at;
  IF v_listing.auction_end_at - NOW() < INTERVAL '5 minutes' THEN
    v_new_end_at := NOW() + INTERVAL '5 minutes';
  END IF;

  -- Update listing denormalized fields
  UPDATE listings SET
    current_bid_cents = p_amount_cents,
    bid_count = v_listing.bid_count + 1,
    highest_bidder_id = p_bidder_id,
    price_cents = p_amount_cents,
    auction_end_at = v_new_end_at
  WHERE id = p_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_end_at', v_new_end_at,
    'bid_count', v_listing.bid_count + 1,
    'prev_bidder_id', v_prev_bidder_id
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION place_bid(UUID, UUID, INTEGER) TO authenticated;
