-- Migration: order_items table for multi-item order consolidation
-- Allows same-seller cart items to be grouped into a single order.

-- 1. Create order_items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  listing_id UUID NOT NULL REFERENCES listings(id),
  price_cents INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Prevents double-sell: each listing can appear in at most one ACTIVE order.
-- The `active` flag is set to false on decline/cancel, freeing the listing
-- for re-purchase while preserving the audit trail of cancelled orders.
CREATE UNIQUE INDEX idx_order_items_active_listing
  ON order_items(listing_id) WHERE (active = true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- SELECT requires join through orders to verify buyer/seller.
-- Performant because idx_order_items_order covers the join.
CREATE POLICY "Order participants can view order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );
-- No INSERT/UPDATE/DELETE policies — writes via service role only

-- 2. Alter orders table
ALTER TABLE orders ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN item_count INTEGER NOT NULL DEFAULT 1;

-- 3. Backfill existing orders into order_items for unified code paths.
-- Idempotent: ON CONFLICT DO NOTHING guards against re-runs.
-- Cancelled/refunded orders get active=false so they don't block re-listing.
INSERT INTO order_items (id, order_id, listing_id, price_cents, active)
SELECT
  gen_random_uuid(),
  o.id,
  o.listing_id,
  o.items_total_cents,
  o.status NOT IN ('cancelled', 'refunded')
FROM orders o
WHERE o.listing_id IS NOT NULL
ON CONFLICT DO NOTHING;
