-- 119_notifications_message_prefix.sql
-- Add `message` to notifications_type_check regex so `message.received`
-- (introduced by the 1:1 messaging feature in 117/118) can be inserted.
--
-- Without this, every notify(..., 'message.received', ...) call from the
-- messaging server actions throws a CHECK violation that notify()'s internal
-- try/catch silently swallows — the in-app bell never increments for messages.
-- See docs/plans/2026-05-25-message-seller-design.md §4.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|comment|dispute|shipping|auction|wanted|dac7|message)\.');
