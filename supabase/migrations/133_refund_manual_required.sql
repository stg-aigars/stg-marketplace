-- Non-refundable payment method handling.
--
-- EveryPay cannot reverse open-banking (bank-link) payments: the buyer's bank
-- pushed a SEPA credit transfer, and there is no rail to pull it back. The
-- refund API answers with error code 4037 ("Open banking payments cannot be
-- refunded"). Before this migration that failure was silent — refund_status
-- stayed NULL, no queue entry, no notification — for 56% of orders.
--
-- Adds the persistence needed to route those refunds to a staff queue:
--   * orders.refund_blocked_reason / refund_blocked_at
--   * the `refund` notification prefix, for refund.manual_required
--
-- orders.refund_status has no CHECK constraint (freeform text), so the new
-- 'manual_required' value needs no constraint change here.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_blocked_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.refund_blocked_reason IS
  'Why the gateway refund could not be executed: open_banking_not_refundable (bank-link rail is irreversible) | unknown_payment_method (payment_method absent or unrecognised — routed to manual review rather than assumed refundable). NULL when no refund was ever blocked.';

COMMENT ON COLUMN orders.refund_blocked_at IS
  'When the gateway refund was blocked. Drives the age column in the /staff/refunds queue. Retained after resolution as the historical record — the queue filters on refund_status, not on this column.';

-- Partial index for the staff queue: only blocked rows are ever scanned.
CREATE INDEX IF NOT EXISTS idx_orders_refund_manual_required
  ON orders (refund_blocked_at DESC)
  WHERE refund_status = 'manual_required';

-- Paired notifications_type_check regex update for the new `refund.manual_required`
-- prefix. Per CLAUDE.md discipline: every new prefix in NotificationType MUST ship
-- with a paired regex update in the same migration — notify() swallows CHECK
-- violations in its internal try/catch, so a missing prefix breaks the bell silently.
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|comment|dispute|shipping|auction|wanted|dac7|moderation|listing|feedback|message|announcement|refund)\.');
