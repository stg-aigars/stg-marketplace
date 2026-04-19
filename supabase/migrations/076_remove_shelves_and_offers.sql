-- Remove Seller Shelves and Offers
-- Feature showed insufficient user engagement in tests; all code paths
-- already removed in the same PR. This migration tears down the backing
-- schema, updates the notifications CHECK, and rewrites get_pending_actions
-- to drop the seller_offers_pending key.

-- 1. Drop the cron-facing and app-facing tables. CASCADE removes indexes,
--    policies, triggers, and the FK from offers → shelf_items.
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS shelf_items CASCADE;

-- 2. Drop shelf-only helper.
DROP FUNCTION IF EXISTS get_seller_shelf_count(uuid);

-- 3. Drop the BGG username column (shelf-import only, no other readers).
ALTER TABLE user_profiles DROP COLUMN IF EXISTS bgg_username;

-- 4. Rewrite pending-actions RPC without seller_offers_pending.
--    Matches migration 064's shape minus that key.
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
    'buyer_disputes',
      (SELECT COUNT(*)::integer FROM orders
       WHERE buyer_id = p_user_id AND status = 'disputed'),
    'buyer_delivery_confirm',
      (SELECT COUNT(*)::integer FROM orders
       WHERE buyer_id = p_user_id AND status = 'delivered'),
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

GRANT EXECUTE ON FUNCTION get_pending_actions(uuid) TO authenticated;

-- 5. Delete historical offer.* notifications before tightening the CHECK,
--    otherwise the constraint rewrite would fail on legacy rows.
DELETE FROM notifications WHERE type LIKE 'offer.%';

-- 6. Drop 'offer' from the allowed type prefix list (current form defined
--    in migration 057).
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|comment|dispute|shipping|auction|wanted|dac7)\.');
