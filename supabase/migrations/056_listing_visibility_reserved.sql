-- Allow reserved listings to remain visible in public queries.
-- Buyers should still see reserved games (with a "Reserved" badge) rather than
-- having them vanish from browse/search results mid-session.
DROP POLICY IF EXISTS "Anyone can view active, auction_ended, or own-order listings" ON listings;

CREATE POLICY "Anyone can view active, reserved, auction_ended, or own-order listings" ON listings
  FOR SELECT USING (
    status IN ('active', 'reserved', 'auction_ended')
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM order_items
      JOIN orders ON orders.id = order_items.order_id
      WHERE order_items.listing_id = listings.id
        AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );
