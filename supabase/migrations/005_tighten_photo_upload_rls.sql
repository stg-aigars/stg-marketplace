-- Tighten listing-photos upload policy to enforce user folder ownership
-- Old policy only checked auth.role() = 'authenticated'
-- New policy also validates the upload path starts with the user's ID

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-photos'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
