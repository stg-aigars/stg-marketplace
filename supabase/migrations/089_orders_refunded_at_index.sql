-- Partial index on `orders.refunded_at` for the OSS prior-period
-- adjustment query (PR #225 / E11e in the staff dashboard plan).
--
-- The OSS tab issues `WHERE refunded_at >= q_start AND refunded_at < q_end
-- AND seller_country != 'LV' AND refund_amount_cents > 0` on every quarter
-- view. Without an index on refunded_at, the planner falls back to the
-- existing idx_orders_created (covers `created_at < q_start`, the other
-- half of the query) and filters refunded_at in the heap — fine at launch
-- volume, painful at 50k+ orders.
--
-- Partial: only rows where `refund_amount_cents > 0` ever match the
-- query. The index is small relative to the full table (refunded orders
-- are a minority) and exactly matches the access pattern.

CREATE INDEX IF NOT EXISTS idx_orders_refunded_at
  ON orders(refunded_at)
  WHERE refund_amount_cents > 0;
