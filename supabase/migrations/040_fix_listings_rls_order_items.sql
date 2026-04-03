-- Fix: buyer sees "Unknown game" on cart orders because RLS policy referenced
-- the removed orders.listing_id column instead of order_items.listing_id.
DROP POLICY IF EXISTS "Anyone can view active, auction_ended, or own-order listings" ON listings;

CREATE POLICY "Anyone can view active, auction_ended, or own-order listings" ON listings
  FOR SELECT
  USING (
    status IN ('active', 'auction_ended')
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM order_items
      JOIN orders ON orders.id = order_items.order_id
      WHERE order_items.listing_id = listings.id
        AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );
