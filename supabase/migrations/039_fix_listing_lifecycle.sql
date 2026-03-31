-- Fix listing lifecycle: expire_stale_reservations + mark sold + data repair
-- Bugs fixed:
--   1. expire_stale_reservations checked orders.listing_id (NULL since migration 035)
--      instead of order_items.listing_id — reverted paid listings to 'active'
--   2. No code path ever set listing status to 'sold' (data repair below)

-- ============================================================
-- Part A: Fix expire_stale_reservations to check order_items
-- ============================================================

CREATE OR REPLACE FUNCTION expire_stale_reservations(cutoff TIMESTAMPTZ)
RETURNS SETOF UUID AS $$
  UPDATE listings SET status = 'active', reserved_at = NULL, reserved_by = NULL
  WHERE status = 'reserved'
    AND reserved_at IS NOT NULL
    AND reserved_at < cutoff
    -- Legacy path (pre-migration-035): orders.listing_id
    AND NOT EXISTS (
      SELECT 1 FROM orders
      WHERE orders.listing_id = listings.id
        AND orders.status NOT IN ('cancelled', 'refunded')
    )
    -- New path (post-migration-035): order_items.listing_id
    AND NOT EXISTS (
      SELECT 1 FROM order_items
        JOIN orders ON orders.id = order_items.order_id
      WHERE order_items.listing_id = listings.id
        AND order_items.active = true
        AND orders.status NOT IN ('cancelled', 'refunded')
    )
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Preserve security revocation from migration 036
REVOKE EXECUTE ON FUNCTION expire_stale_reservations(TIMESTAMPTZ) FROM public, anon, authenticated;

-- ============================================================
-- Part B: Data repair — mark listings as 'sold' for completed orders
-- ============================================================

-- Fix via order_items (new path, post-migration-035)
UPDATE listings
SET status = 'sold', reserved_at = NULL, reserved_by = NULL
WHERE id IN (
  SELECT oi.listing_id FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'completed' AND oi.active = true
)
AND status IN ('reserved', 'active');

-- Fix via legacy orders.listing_id (pre-migration-035)
UPDATE listings
SET status = 'sold', reserved_at = NULL, reserved_by = NULL
WHERE id IN (
  SELECT o.listing_id FROM orders o
  WHERE o.listing_id IS NOT NULL AND o.status = 'completed'
)
AND status IN ('reserved', 'active');
