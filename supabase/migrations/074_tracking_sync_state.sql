-- Track the last successful bulk tracking sync timestamp.
-- Used as dateFrom in POST /api/v2/tracking/events to fetch only new events.
CREATE TABLE IF NOT EXISTS tracking_sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single row.
INSERT INTO tracking_sync_state (id, last_synced_at) VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- Service role only — internal cron state, not user-facing.
ALTER TABLE tracking_sync_state ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN tracking_sync_state.last_synced_at IS
  'Safety-margin-adjusted timestamp used as dateFrom for the next bulk tracking fetch. Not the literal last-sync time — offset backward by SYNC_SAFETY_MARGIN_MS so the idempotent RPC can retry failed event inserts.';
