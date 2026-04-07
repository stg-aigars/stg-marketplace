-- Add avatar support to user profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Recreate public_profiles view to include avatar_url
-- Must DROP + CREATE because adding a column changes column order
DROP VIEW IF EXISTS public_profiles;
CREATE VIEW public_profiles AS
  SELECT id, full_name, avatar_url, country, created_at
  FROM user_profiles;
GRANT SELECT ON public_profiles TO anon;
GRANT SELECT ON public_profiles TO authenticated;

-- Storage bucket for user avatars (public, small files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view avatars
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload to their own folder
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can overwrite their own avatar
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
