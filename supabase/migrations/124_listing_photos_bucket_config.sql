-- Align the listing-photos bucket's storage-side limits with the application
-- contract, and capture them in code so they can't silently drift via the
-- dashboard again.
--
-- Background: production photo uploads were failing with an opaque 500
-- ("Failed to upload photos") because the bucket config — set by hand in the
-- dashboard, never in a migration — disagreed with the app:
--
--   1. file_size_limit was 10 MB while the app accepts up to 25 MB
--      (MAX_PHOTO_SIZE_BYTES, raised in the 25MB photo-size PR). Files in the
--      10–25 MB band passed the app checks and were then rejected by storage.
--
--   2. allowed_mime_types was entered as "image/jpeg, image/png, image/webp".
--      We normalize EVERY upload to WebP before writing (the route uploads
--      stripExifMetadata() output with contentType 'image/webp'), so the
--      bucket only ever receives image/webp. The comma+space dashboard entry
--      is the classic Supabase footgun (values stored with a leading space
--      never match), which can reject every WebP upload.
--
-- Authoritative format enforcement already happens in the app via magic-byte
-- sniffing (detectImageType) plus the re-encode to WebP, so the bucket-level
-- MIME restriction is defense-in-depth. We keep it, but scoped precisely to
-- what we actually store — image/webp — with no whitespace.

UPDATE storage.buckets
SET
  -- 25 MB, matching MAX_PHOTO_SIZE_BYTES in src/lib/listings/types.ts.
  file_size_limit = 26214400,
  -- We always normalize to WebP before upload, so WebP is the only type ever
  -- written to this bucket.
  allowed_mime_types = ARRAY['image/webp']
WHERE id = 'listing-photos';
