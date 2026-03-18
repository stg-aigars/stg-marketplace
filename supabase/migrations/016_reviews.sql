-- Reviews: buyer reviews seller after order delivery
-- Thumbs up/down + optional text comment, one review per order

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES user_profiles(id),
  seller_id UUID NOT NULL REFERENCES user_profiles(id),
  is_positive BOOLEAN NOT NULL,
  comment TEXT CHECK (comment IS NULL OR (char_length(comment) >= 1 AND char_length(comment) <= 500)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seller profile queries: recent reviews for a seller
CREATE INDEX idx_reviews_seller ON reviews(seller_id, created_at DESC);

-- Order detail lookups: check if review exists for an order
CREATE INDEX idx_reviews_order ON reviews(order_id);

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (public trust signals)
CREATE POLICY reviews_select ON reviews
  FOR SELECT USING (true);

-- Buyers can insert a review for their own delivered/completed orders within 30 days
CREATE POLICY reviews_insert ON reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = reviews.order_id
        AND orders.buyer_id = auth.uid()
        AND orders.seller_id = reviews.seller_id
        AND orders.status IN ('delivered', 'completed')
        AND orders.delivered_at IS NOT NULL
        AND orders.delivered_at > now() - interval '30 days'
    )
  );

-- No UPDATE or DELETE policies: reviews are immutable
-- Future moderation should use a soft-delete admin flag via service role
