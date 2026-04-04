-- Add auction.* and wanted.* prefixes to the notifications type check constraint.
-- These types were defined in application code but rejected by the DB constraint.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|message|offer|dispute|shipping|auction|wanted)\.');
