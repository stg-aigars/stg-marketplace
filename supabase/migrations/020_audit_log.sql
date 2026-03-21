-- Audit log for financial operations and security-relevant events.
-- Replaces ephemeral console logs with a queryable database table.
-- RLS enabled with no policies = service role only (no user access).

CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'cron')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
