-- Add order_number to checkout_sessions so the same STG-YYYYMMDD-XXXX
-- identifier flows from checkout -> EveryPay -> callback -> order.
ALTER TABLE checkout_sessions ADD COLUMN order_number TEXT UNIQUE;
