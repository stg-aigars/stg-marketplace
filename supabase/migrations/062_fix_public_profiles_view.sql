-- Fix: migration 059 added security_invoker=true to public_profiles, which broke
-- anonymous access because the view now runs as the caller (anon) and user_profiles
-- SELECT policy requires auth.uid() IS NOT NULL.
-- Revert to definer mode so the view can read through user_profiles RLS.
-- Uses explicit DROP+CREATE with security_invoker=false (not CREATE OR REPLACE,
-- which doesn't reliably reset WITH options on existing views).

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
  SELECT id, full_name, avatar_url, country, created_at
  FROM user_profiles;

-- Lock down: SELECT only, no writes via this view.
REVOKE ALL ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Public projection of user_profiles. Exposes only non-sensitive seller fields '
  '(id, full_name, avatar_url, country, created_at) so unauthenticated visitors '
  'can see seller display info on listing detail, browse, sitemap, and JSON-LD. '
  'This view intentionally runs in DEFINER mode (security_invoker = false) so '
  'it can read through the locked-down user_profiles RLS. Do NOT switch this view '
  'to security_invoker=true without first adding an anon-permissive SELECT policy '
  'on user_profiles, or every anon-reachable listing page will silently break. '
  'Do NOT add columns containing PII, payout, or DAC7 data to this view.';
