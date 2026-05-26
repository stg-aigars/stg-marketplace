-- 121_announcements_staff_select.sql
-- Add a staff SELECT policy on public.announcements.
--
-- Migration 120 shipped only one SELECT policy (anon-permissive, gated to
-- `published_at IS NOT NULL AND deleted_at IS NULL`). That hid drafts /
-- unpublished / deleted rows from the user-scoped Supabase client used in
-- src/lib/announcements/actions.ts.
--
-- The actions chain `.insert(...).select('id').single()` and
-- `.update(...).select('id, slug, title').maybeSingle()` after writes.
-- The INSERT / UPDATE itself passed the staff WITH CHECK policy, but
-- PostgREST's RETURNING runs through the SELECT policy on the *new* row
-- state. createAnnouncement (draft, no published_at), unpublishAnnouncement
-- (published_at set back to null), and softDeleteAnnouncement (deleted_at
-- set) all ended in states the anon SELECT policy excludes, so the chained
-- read came back empty and the actions returned 'create_failed' /
-- 'not_found' even though the writes had succeeded.
--
-- This policy is additive: the anon-permissive SELECT stays, so public
-- visibility is unchanged. Matches the staff INSERT / UPDATE / DELETE
-- pattern already on the table (migration 120) and the broader staff-gating
-- pattern from migration 095.

CREATE POLICY "Staff read all announcements"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  );
