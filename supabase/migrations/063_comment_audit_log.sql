-- Document that audit_log is intentionally service-role-only.
-- RLS is enabled with zero SELECT policies — all reads/writes use createServiceClient().

COMMENT ON TABLE public.audit_log IS
  'Service-role-only. No SELECT policies by design — never add anon or authenticated SELECT.';
