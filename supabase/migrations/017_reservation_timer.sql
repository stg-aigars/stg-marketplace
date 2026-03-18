-- Reservation timer: 30-minute listing lock during checkout
-- Prevents two buyers paying for the same item simultaneously

ALTER TABLE listings ADD COLUMN reserved_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN reserved_by UUID REFERENCES user_profiles(id);

-- Partial index for cron job: find expired reservations efficiently
CREATE INDEX idx_listings_reservation_expiry ON listings(reserved_at)
  WHERE status = 'reserved' AND reserved_at IS NOT NULL;

-- Atomic cron function: revert expired reservations that have no active order
-- Called by the expire-reservations cron endpoint
CREATE OR REPLACE FUNCTION expire_stale_reservations(cutoff TIMESTAMPTZ)
RETURNS SETOF UUID AS $$
  UPDATE listings SET status = 'active', reserved_at = NULL, reserved_by = NULL
  WHERE status = 'reserved'
    AND reserved_at IS NOT NULL
    AND reserved_at < cutoff
    AND NOT EXISTS (
      SELECT 1 FROM orders
      WHERE orders.listing_id = listings.id
      AND orders.status NOT IN ('cancelled', 'refunded')
    )
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER;
