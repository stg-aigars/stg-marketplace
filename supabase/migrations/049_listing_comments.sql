-- Public comment board on listings (replaces private messaging)

-- ============================================================
-- 1. Create listing_comments table
-- ============================================================

CREATE TABLE listing_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_comments_listing ON listing_comments(listing_id, created_at);
CREATE INDEX idx_listing_comments_user ON listing_comments(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE listing_comments ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can read non-deleted comments
CREATE POLICY "Anyone can view comments"
  ON listing_comments FOR SELECT
  USING (deleted_at IS NULL);

-- Authenticated users can post comments on their own behalf
CREATE POLICY "Authenticated users can post comments"
  ON listing_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy — soft-deletes handled via service role in deleteComment action

-- ============================================================
-- 2. Update notification type constraint (comment.* replaces message.*)
-- ============================================================

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|comment|offer|dispute|shipping|auction|wanted)\.');

-- ============================================================
-- 3. Drop private messaging system
-- ============================================================

DROP TRIGGER IF EXISTS on_new_message ON messages;
DROP FUNCTION IF EXISTS update_conversation_last_message();
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
