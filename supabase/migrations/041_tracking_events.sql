-- Tracking events table for Unisend parcel tracking
-- Stores events synced from Unisend API via sync-tracking cron

CREATE TABLE tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  state_type TEXT NOT NULL,
  state_text TEXT,
  location TEXT,
  description TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, state_type, event_timestamp)
);

CREATE INDEX idx_tracking_events_order_timestamp ON tracking_events(order_id, event_timestamp DESC);

-- RPC for idempotent event insertion (called by sync-tracking cron via service role)
CREATE OR REPLACE FUNCTION add_tracking_event(
  p_order_id UUID,
  p_event_type TEXT,
  p_state_type TEXT,
  p_state_text TEXT,
  p_location TEXT,
  p_description TEXT,
  p_event_timestamp TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO tracking_events (order_id, event_type, state_type, state_text, location, description, event_timestamp)
  VALUES (p_order_id, p_event_type, p_state_type, p_state_text, p_location, p_description, p_event_timestamp)
  ON CONFLICT (order_id, state_type, event_timestamp) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- RLS: order participants can read tracking events
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order participants can view tracking events"
  ON tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = tracking_events.order_id
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );
