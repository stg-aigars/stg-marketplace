-- Index for the new order_number lookup pattern (Task 1 changed session lookup from id to order_number).
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order_number
  ON checkout_sessions(order_number) WHERE order_number IS NOT NULL;
