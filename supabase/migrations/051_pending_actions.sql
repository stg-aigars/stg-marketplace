-- Composite index for efficient buyer + status filtering (buyer-side pending actions)
-- Existing idx_orders_buyer is on (buyer_id) alone, which requires a secondary filter on status.
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status);

-- Returns counts of actions requiring user attention, both as seller and buyer.
-- SECURITY DEFINER bypasses RLS to count across orders/offers/wanted_offers,
-- but only returns aggregate counts (no sensitive row data).
CREATE OR REPLACE FUNCTION get_pending_actions(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'seller_orders_pending',
      (SELECT COUNT(*)::integer FROM orders
       WHERE seller_id = p_user_id AND status = 'pending_seller'),
    'seller_orders_to_ship',
      (SELECT COUNT(*)::integer FROM orders
       WHERE seller_id = p_user_id AND status = 'accepted'),
    'seller_disputes',
      (SELECT COUNT(*)::integer FROM orders
       WHERE seller_id = p_user_id AND status = 'disputed'),
    'seller_offers_pending',
      (SELECT COUNT(*)::integer FROM offers
       WHERE seller_id = p_user_id AND status = 'pending'),
    'buyer_disputes',
      (SELECT COUNT(*)::integer FROM orders
       WHERE buyer_id = p_user_id AND status = 'disputed'),
    'buyer_delivery_confirm',
      (SELECT COUNT(*)::integer FROM orders
       WHERE buyer_id = p_user_id AND status = 'delivered'),
    'buyer_wanted_offers',
      (SELECT COUNT(*)::integer FROM wanted_offers
       WHERE buyer_id = p_user_id AND status = 'pending')
  );
$$;

GRANT EXECUTE ON FUNCTION get_pending_actions(uuid) TO authenticated;
