-- Indexes for checkout session lookups and cleanup
CREATE INDEX idx_checkout_sessions_listing ON checkout_sessions(listing_id);
CREATE INDEX idx_checkout_sessions_buyer ON checkout_sessions(buyer_id);
CREATE INDEX idx_checkout_sessions_status_created ON checkout_sessions(status, created_at)
  WHERE status = 'pending';
