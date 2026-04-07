-- Add is_seller flag to pending actions RPC.
-- Matches account page logic: completedSales > 0 || activeListings > 0.
-- A user with only cancelled listings and no sales sees the buyer experience.
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
       WHERE buyer_id = p_user_id AND status = 'pending'),
    'is_seller',
      (
        (SELECT COUNT(*)::integer FROM orders
         WHERE seller_id = p_user_id AND status = 'completed') > 0
        OR
        (SELECT COUNT(*)::integer FROM listings
         WHERE seller_id = p_user_id AND status = 'active') > 0
      )
  );
$$;
