-- Private buyer/seller messaging on order pages

-- ============================================================
-- 1. Create order_messages table
-- ============================================================

CREATE TABLE order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('buyer', 'seller')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_messages_order_created ON order_messages(order_id, created_at);
CREATE INDEX idx_order_messages_user ON order_messages(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

-- Order participants can read non-deleted messages
CREATE POLICY "Order participants can view messages"
  ON order_messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND auth.uid() IN (
      SELECT buyer_id FROM orders WHERE id = order_id
      UNION ALL
      SELECT seller_id FROM orders WHERE id = order_id
    )
  );

-- Staff can view non-deleted messages (read/delete only, not a participant)
CREATE POLICY "Staff can view messages"
  ON order_messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_staff = true
    )
  );

-- Only order participants can post messages on their own behalf
CREATE POLICY "Order participants can post messages"
  ON order_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IN (
      SELECT buyer_id FROM orders WHERE id = order_id
      UNION ALL
      SELECT seller_id FROM orders WHERE id = order_id
    )
  );

-- No UPDATE policy — soft-deletes handled via service role in deleteOrderMessage action
