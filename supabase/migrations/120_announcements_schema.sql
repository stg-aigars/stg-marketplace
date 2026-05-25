-- 120_announcements_schema.sql
-- Platform announcements: table, indexes, RLS, plus paired update of
-- notifications_type_check regex to include the new `announcement` prefix.
-- Design: docs/plans/2026-05-25-announcements-design.md

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body_markdown text NOT NULL CHECK (length(body_markdown) BETWEEN 1 AND 20000),
  published_at timestamptz,
  notified_at timestamptz,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_published
  ON public.announcements (published_at DESC)
  WHERE published_at IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_announcements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_announcements_updated_at();

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anon-permissive SELECT for published, non-deleted rows.
-- Per CLAUDE.md "RLS Policies and Anonymous Access": every column is
-- genuinely public when published; no view needed.
CREATE POLICY "Public reads published announcements"
  ON public.announcements
  FOR SELECT
  USING (published_at IS NOT NULL AND deleted_at IS NULL);

-- Staff INSERT/UPDATE/DELETE. Matches the migration 095 staff-gating pattern
-- (EXISTS subquery against user_profiles, (SELECT auth.uid()) initplan wrap).
CREATE POLICY "Staff create announcements"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  );

CREATE POLICY "Staff update announcements"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  );

CREATE POLICY "Staff delete announcements"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  );
