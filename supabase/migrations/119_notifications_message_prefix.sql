-- 119_notifications_message_prefix.sql
-- Sweep the notifications_type_check regex to include every prefix actually
-- emitted by NotificationType (src/lib/notifications/types.ts).
--
-- The regex was last touched in migration 076 (which removed `offer` after
-- the shelves/offers feature was cut). It has fallen behind reality since:
--   - `feedback.` added by PR #326 — silently fails the CHECK
--   - `moderation.` + `listing.` added by the DSA PR — silently fail
--   - `message.` added by this PR (messaging feature) — would silently fail
--
-- notify()'s internal try/catch swallows CHECK violations, so each of these
-- broke the affected feature's in-app bell without a noisy error. Sweeping
-- now to align the regex with the type union and unblock messaging.
--
-- Going forward: every PR that adds a new prefix to NotificationType MUST
-- ship a paired migration adding the prefix to this regex.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|comment|dispute|shipping|auction|wanted|dac7|moderation|listing|feedback|message)\.');
