-- Allow public access to auction_ended listings (winners need to see them to pay).
-- Previously only 'active' listings were publicly visible.
DROP POLICY IF EXISTS "Anyone can view active listings" ON listings;

CREATE POLICY "Anyone can view active and auction_ended listings" ON listings
  FOR SELECT
  USING (status IN ('active', 'auction_ended') OR seller_id = auth.uid());
