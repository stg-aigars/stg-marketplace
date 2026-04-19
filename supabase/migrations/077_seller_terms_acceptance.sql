-- Seller Terms acceptance: adds two columns to user_profiles to stamp when
-- a seller last accepted the Seller Agreement and which version. Used by
-- the /sell page gate (Phase 2 PR 2B-3) to block listing creation until
-- the seller has accepted the current SELLER_TERMS_VERSION.
--
-- Deliberately additive-only:
--   - No RLS policy changes (existing user_profiles policies cover the new
--     columns; they are read as part of normal authenticated profile reads).
--   - No backfill (seller_terms_accepted_at = NULL means "never accepted").
--     Existing sellers re-accept on their next sell-flow visit.
--   - public_profiles view intentionally NOT regenerated. The view uses an
--     explicit column list (id, full_name, avatar_url, country, created_at)
--     set in migration fix_public_profiles_view, so adding columns to
--     user_profiles does not auto-expose them to the anon role. Same
--     pattern as terms_acceptance migration (2026-04-13) which added
--     terms_accepted_at + terms_version without touching the view.

ALTER TABLE public.user_profiles
  ADD COLUMN seller_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN seller_terms_version TEXT
    CHECK (seller_terms_version ~ '^\d{4}-\d{2}-\d{2}$');

COMMENT ON COLUMN public.user_profiles.seller_terms_accepted_at IS
  'Timestamp of the user''s most recent Seller Agreement acceptance. NULL = never accepted.';

COMMENT ON COLUMN public.user_profiles.seller_terms_version IS
  'Version stamp (YYYY-MM-DD) of the Seller Agreement the user accepted. Compared against SELLER_TERMS_VERSION at the sell gate; mismatch forces re-acceptance.';
