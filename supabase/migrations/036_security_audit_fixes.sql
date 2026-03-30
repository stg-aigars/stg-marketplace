-- Security audit fixes (2026-03-30)
-- Findings: F5 (CRITICAL), F6 (CRITICAL), F7 (MEDIUM), F8 (MEDIUM), F9 (MEDIUM)
-- Report: docs/security-audit-report.md

-- ============================================================
-- F5: Prevent users from modifying is_staff via RLS
-- BEFORE UPDATE trigger with SECURITY DEFINER + REVOKE
-- (Pragmatic immediate fix; separate staff_roles table is follow-up)
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_staff_self_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_staff IS DISTINCT FROM OLD.is_staff THEN
    RAISE EXCEPTION 'is_staff cannot be modified via client';
  END IF;
  RETURN NEW;
END;
$$;

-- Prevent anyone from replacing or dropping this function via REST API
REVOKE EXECUTE ON FUNCTION prevent_staff_self_promotion() FROM public, anon, authenticated;

CREATE TRIGGER trg_prevent_staff_self_promotion
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_staff_self_promotion();

-- ============================================================
-- F6: Remove user-facing UPDATE policy on orders
-- All order state transitions already use service role
-- ============================================================

DROP POLICY IF EXISTS "Participants can update orders" ON orders;

-- ============================================================
-- F7: Revoke execute on expire_stale_reservations from all roles
-- Only callable by service role (cron job)
-- ============================================================

REVOKE EXECUTE ON FUNCTION expire_stale_reservations(TIMESTAMPTZ) FROM public, anon, authenticated;

-- ============================================================
-- F8: Revoke execute on reserve/unreserve functions
-- Only callable by service role (checkout routes)
-- ============================================================

REVOKE EXECUTE ON FUNCTION reserve_listings_atomic(UUID[], UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION unreserve_listings(UUID[], UUID) FROM public, anon, authenticated;

-- ============================================================
-- F9: Remove user-facing UPDATE policy on listings
-- Verified: ALL listing mutations go through service role
-- (createListing, updateListing, cancelListing in actions.ts,
--  cron jobs, order-deadlines — all use createServiceClient())
-- ============================================================

DROP POLICY IF EXISTS "Sellers can update own listings" ON listings;
