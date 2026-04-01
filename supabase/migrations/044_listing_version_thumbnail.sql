-- Add version_thumbnail to listings for edition-specific BGG cover images
ALTER TABLE listings ADD COLUMN IF NOT EXISTS version_thumbnail TEXT;
