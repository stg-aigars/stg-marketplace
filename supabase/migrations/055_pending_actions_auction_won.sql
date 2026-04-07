-- Add buyer_auctions_won count to pending actions RPC.
-- Counts auctions the user has won but not yet paid for (status = 'auction_ended').
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
    'buyer_auctions_won',
      (SELECT COUNT(*)::integer FROM listings
       WHERE highest_bidder_id = p_user_id AND status = 'auction_ended'
         AND listing_type = 'auction'),
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
