-- Store EveryPay payment_reference on checkout sessions for reconciliation.
-- Without this, orphaned sessions (buyer paid but browser didn't redirect)
-- are invisible to the reconciliation cron — it needs the reference to
-- query EveryPay for actual payment status.

ALTER TABLE checkout_sessions
  ADD COLUMN everypay_payment_reference TEXT;

ALTER TABLE cart_checkout_groups
  ADD COLUMN everypay_payment_reference TEXT;

CREATE INDEX idx_checkout_sessions_payment_ref
  ON checkout_sessions(everypay_payment_reference)
  WHERE everypay_payment_reference IS NOT NULL;

CREATE INDEX idx_cart_checkout_groups_payment_ref
  ON cart_checkout_groups(everypay_payment_reference)
  WHERE everypay_payment_reference IS NOT NULL;
