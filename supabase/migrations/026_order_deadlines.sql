-- Track whether a deadline reminder has been sent for the current order status phase.
-- Reset to NULL on status transitions (handled in application code) so the next
-- phase's reminder can fire correctly.
ALTER TABLE orders ADD COLUMN deadline_reminder_sent_at TIMESTAMPTZ;
