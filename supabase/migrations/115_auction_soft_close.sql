-- 115_auction_soft_close.sql
-- Replaces the 5-minute snipe rule with a 24-hour soft-close window in place_bid.
-- Also nulls listings.auction_ending_soon_notified_at atomically when the deadline
-- extends, so the existing auction-ending-soon cron re-fires for each new deadline
-- without code changes on its side.
--
-- IMPORTANT: auction_original_end_at is the seller's original-deadline audit field.
-- This migration MUST NOT modify or null auction_original_end_at under any code path.

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

  -- Soft close: if bid within last 24 hours, extend by 24 hours
  v_new_end_at := v_listing.auction_end_at;
  IF v_listing.auction_end_at - NOW() < INTERVAL '24 hours' THEN
    v_new_end_at := NOW() + INTERVAL '24 hours';
  END IF;

  -- Update listing denormalized fields
  UPDATE listings SET
    current_bid_cents = p_amount_cents,
    bid_count = v_listing.bid_count + 1,
    highest_bidder_id = p_bidder_id,
    price_cents = p_amount_cents,
    auction_end_at = v_new_end_at,
    auction_ending_soon_notified_at = CASE
      WHEN v_new_end_at <> v_listing.auction_end_at THEN NULL
      ELSE auction_ending_soon_notified_at
    END
  WHERE id = p_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_end_at', v_new_end_at,
    'bid_count', v_listing.bid_count + 1,
    'prev_bidder_id', v_prev_bidder_id
  );
END;
$$;

COMMENT ON COLUMN public.listings.auction_ending_soon_notified_at IS
  'Timestamp of the last ending-soon notification batch for this auction. '
  'Set by the auction-ending-soon cron when it dispatches. Nulled atomically '
  'by place_bid when auction_end_at is extended, so the cron re-fires for '
  'each new deadline. Null means "ready to notify for the current deadline."';
