-- Let a user who favorited a listing still see it after it sells/gets cancelled.
--
-- The listings SELECT policy (059_advisor_fixes.sql) only whitelists
-- status IN ('active', 'reserved', 'auction_ended') for non-seller,
-- non-order-participant viewers. Once a listing flips to 'sold' or
-- 'cancelled', the favorites page's join to listings resolves to null for
-- anyone who isn't the seller/buyer, even though the row still exists with
-- its game_name/photos intact — the favorites UI then renders a blank
-- "No longer available" placeholder instead of the existing unavailable-card
-- treatment it already has for reserved/auction_ended listings.

DROP POLICY IF EXISTS "Anyone can view active, reserved, auction_ended, or own-order l" ON listings;
CREATE POLICY "Anyone can view active, reserved, auction_ended, or own-order l" ON listings FOR SELECT USING (
  status = ANY (ARRAY['active', 'reserved', 'auction_ended'])
  OR seller_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM order_items JOIN orders ON orders.id = order_items.order_id
    WHERE order_items.listing_id = listings.id
    AND (orders.buyer_id = (select auth.uid()) OR orders.seller_id = (select auth.uid()))
  )
  OR EXISTS (
    SELECT 1 FROM favorites
    WHERE favorites.listing_id = listings.id
    AND favorites.user_id = (select auth.uid())
  )
);
