-- Order tracking migration
-- Adds checkout sessions, shipping data, status timestamps, and phone support

-- Checkout sessions (replaces base64 order reference encoding)
CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  terminal_id TEXT NOT NULL,
  terminal_name TEXT NOT NULL,
  terminal_country TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers can view own sessions" ON checkout_sessions
  FOR SELECT USING (auth.uid() = buyer_id);

-- Orders: shipping data
ALTER TABLE orders ADD COLUMN unisend_parcel_id INTEGER;
ALTER TABLE orders ADD COLUMN barcode TEXT;
ALTER TABLE orders ADD COLUMN tracking_url TEXT;
ALTER TABLE orders ADD COLUMN shipping_method TEXT DEFAULT 'unisend_t2t';
ALTER TABLE orders ADD COLUMN buyer_phone TEXT;
ALTER TABLE orders ADD COLUMN seller_phone TEXT;

-- Orders: status timestamps for timeline
ALTER TABLE orders ADD COLUMN accepted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN disputed_at TIMESTAMPTZ;

-- User profiles: phone number
ALTER TABLE user_profiles ADD COLUMN phone TEXT;

-- Index for parcel ID lookups
CREATE INDEX idx_orders_unisend_parcel_id ON orders(unisend_parcel_id) WHERE unisend_parcel_id IS NOT NULL;
