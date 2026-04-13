-- Critical pre-launch DB constraint fixes
-- Addresses: payment ref uniqueness, wallet idempotency, seller cascade, order constraints

-- ============================================================
-- 1. UNIQUE on orders.everypay_payment_reference
--    Prevents duplicate order creation from concurrent callbacks
-- ============================================================

DROP INDEX IF EXISTS idx_orders_payment_ref;
CREATE UNIQUE INDEX idx_orders_payment_ref
  ON orders(everypay_payment_reference)
  WHERE everypay_payment_reference IS NOT NULL;

-- ============================================================
-- 2. UNIQUE on wallet_transactions(order_id, type)
--    DB-level idempotency for wallet credits/debits/refunds
-- ============================================================

CREATE UNIQUE INDEX idx_wallet_txn_order_type
  ON wallet_transactions(order_id, type)
  WHERE order_id IS NOT NULL;

-- Same for withdrawal-keyed transactions
CREATE UNIQUE INDEX idx_wallet_txn_withdrawal_type
  ON wallet_transactions(withdrawal_id, type)
  WHERE withdrawal_id IS NOT NULL;

-- ============================================================
-- 3. Change listings.seller_id from CASCADE to RESTRICT
--    Prevents silent deletion of listings (and historical data)
--    when a seller profile is removed
-- ============================================================

ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_seller_id_fkey,
  ADD CONSTRAINT listings_seller_id_fkey
    FOREIGN KEY (seller_id) REFERENCES user_profiles(id)
    ON DELETE RESTRICT;

-- ============================================================
-- 4. CHECK constraints on orders monetary columns
-- ============================================================

ALTER TABLE orders
  ADD CONSTRAINT orders_total_amount_check
    CHECK (total_amount_cents >= 0),
  ADD CONSTRAINT orders_items_total_check
    CHECK (items_total_cents >= 0),
  ADD CONSTRAINT orders_shipping_cost_check
    CHECK (shipping_cost_cents >= 0),
  ADD CONSTRAINT orders_commission_check
    CHECK (platform_commission_cents IS NULL OR platform_commission_cents >= 0),
  ADD CONSTRAINT orders_seller_credit_check
    CHECK (seller_wallet_credit_cents IS NULL OR seller_wallet_credit_cents >= 0),
  ADD CONSTRAINT orders_buyer_debit_check
    CHECK (buyer_wallet_debit_cents IS NULL OR buyer_wallet_debit_cents >= 0),
  ADD CONSTRAINT orders_refund_check
    CHECK (refund_amount_cents IS NULL OR refund_amount_cents >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_price_cents_check
    CHECK (price_cents > 0);

-- ============================================================
-- 5. CHECK on orders.cancellation_reason
-- ============================================================

ALTER TABLE orders
  ADD CONSTRAINT orders_cancellation_reason_check
    CHECK (cancellation_reason IS NULL OR cancellation_reason IN (
      'declined', 'response_timeout', 'shipping_timeout', 'system'
    ));

-- ============================================================
-- 6. FK orders.cart_group_id -> cart_checkout_groups
-- ============================================================

ALTER TABLE orders
  ADD CONSTRAINT orders_cart_group_id_fkey
    FOREIGN KEY (cart_group_id) REFERENCES cart_checkout_groups(id)
    ON DELETE SET NULL;
