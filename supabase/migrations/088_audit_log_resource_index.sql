-- Recreate the (resource_type, resource_id) index on audit_log.
--
-- Migration 020 created `idx_audit_log_resource ON audit_log(resource_type,
-- resource_id)`. Migration 059 dropped it under "drop unused indexes" — at
-- the time the table was small and no surface read by resource. The staff
-- order detail page (refactored in PR #222) now hits this index on every
-- load to fetch the recent `order.refunded` audit entries for a given
-- order, and the audit log accumulates continuously (regulatory rows are
-- retained 10 years per CLAUDE.md). Without the index, every staff order
-- detail load sequential-scans the whole table.

CREATE INDEX IF NOT EXISTS idx_audit_log_resource
  ON audit_log(resource_type, resource_id);
