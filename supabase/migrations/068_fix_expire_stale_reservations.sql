-- Critical fix: restore order_items check in expire_stale_reservations
--
-- Migration 039 added both the legacy orders.listing_id check AND the
-- order_items.listing_id check (for post-migration-035 cart-flow orders).
-- Migration 061 rewrote the function for schema qualification but
-- accidentally dropped the order_items subquery. Without it, the cron
-- reverts reserved listings to 'active' even when a valid cart-flow order
-- exists — enabling double-selling.

CREATE OR REPLACE FUNCTION public.expire_stale_reservations(cutoff TIMESTAMPTZ)
RETURNS SETOF UUID AS $$
  UPDATE public.listings SET status = 'active', reserved_at = NULL, reserved_by = NULL
  WHERE status = 'reserved'
    AND reserved_at IS NOT NULL
    AND reserved_at < cutoff
    -- Legacy path (pre-migration-035): orders.listing_id
    AND NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.listing_id = listings.id
        AND orders.status NOT IN ('cancelled', 'refunded')
    )
    -- New path (post-migration-035): order_items.listing_id
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items
        JOIN public.orders ON orders.id = order_items.order_id
      WHERE order_items.listing_id = listings.id
        AND order_items.active = true
        AND orders.status NOT IN ('cancelled', 'refunded')
    )
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER
SET search_path = '';
