-- Allow order participants (buyer or seller) to view listings referenced by their orders,
-- regardless of listing status. Fixes: buyer sees "Unknown game" on order detail because
-- listing status left the 'active'/'auction_ended' whitelist after purchase.
DROP POLICY IF EXISTS "Anyone can view active and auction_ended listings" ON listings;

CREATE POLICY "Anyone can view active, auction_ended, or own-order listings" ON listings
  FOR SELECT
  USING (
    status IN ('active', 'auction_ended')
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.listing_id = listings.id
        AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );
