-- Cart checkout groups for multi-item purchases
-- Each group represents a single payment session covering multiple listings.
-- Individual orders are created in the callback, one per listing.

CREATE TABLE cart_checkout_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  callback_token TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  terminal_id TEXT NOT NULL,
  terminal_name TEXT NOT NULL,
  terminal_country TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  wallet_debit_cents INTEGER NOT NULL DEFAULT 0,
  wallet_allocation JSONB NOT NULL DEFAULT '{}',
  listing_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cart_checkout_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own cart checkout groups"
  ON cart_checkout_groups FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE INDEX idx_cart_checkout_groups_order_number ON cart_checkout_groups(order_number);
CREATE INDEX idx_cart_checkout_groups_buyer ON cart_checkout_groups(buyer_id);
CREATE INDEX idx_cart_checkout_groups_pending ON cart_checkout_groups(status) WHERE status = 'pending';

-- Add cart_group_id to orders for grouping display
ALTER TABLE orders ADD COLUMN cart_group_id UUID;
CREATE INDEX idx_orders_cart_group ON orders(cart_group_id) WHERE cart_group_id IS NOT NULL;

-- Atomic reservation: reserves all listings or none.
-- Returns array of listing IDs that could NOT be reserved (empty = all succeeded).
CREATE OR REPLACE FUNCTION reserve_listings_atomic(
  p_listing_ids UUID[],
  p_buyer_id UUID
) RETURNS UUID[] AS $$
DECLARE
  v_unavailable UUID[];
  v_id UUID;
BEGIN
  -- Lock all target listings in a consistent order to prevent deadlocks
  PERFORM id FROM listings
    WHERE id = ANY(p_listing_ids)
    ORDER BY id
    FOR UPDATE;

  -- Check which listings are NOT available for reservation
  SELECT ARRAY_AGG(id) INTO v_unavailable
  FROM (
    SELECT UNNEST(p_listing_ids) AS id
    EXCEPT
    SELECT id FROM listings
      WHERE id = ANY(p_listing_ids)
        AND status = 'active'
  ) AS unavailable;

  -- If any are unavailable, return them without making changes
  IF v_unavailable IS NOT NULL AND array_length(v_unavailable, 1) > 0 THEN
    RETURN v_unavailable;
  END IF;

  -- All available — reserve them all
  UPDATE listings
  SET status = 'reserved',
      reserved_by = p_buyer_id,
      reserved_at = NOW()
  WHERE id = ANY(p_listing_ids)
    AND status = 'active';

  RETURN ARRAY[]::UUID[];
END;
$$ LANGUAGE plpgsql;

-- Best-effort unreservation: processes each listing individually.
-- Silently skips listings already unreserved, sold, or reserved by someone else.
-- Returns count of actually unreserved listings.
CREATE OR REPLACE FUNCTION unreserve_listings(
  p_listing_ids UUID[],
  p_buyer_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE listings
  SET status = 'active',
      reserved_by = NULL,
      reserved_at = NULL
  WHERE id = ANY(p_listing_ids)
    AND status = 'reserved'
    AND reserved_by = p_buyer_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
