-- Track why an order was cancelled for user-facing copy
-- Values: 'declined', 'response_timeout', 'shipping_timeout', 'system'
ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
