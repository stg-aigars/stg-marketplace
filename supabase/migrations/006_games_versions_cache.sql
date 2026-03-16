-- Add versions cache columns to games table
-- Versions are lazily fetched from BGG API and cached as JSONB for reliable
-- access during listing creation (avoids BGG API dependency at Step 2).
ALTER TABLE games
  ADD COLUMN versions JSONB,
  ADD COLUMN versions_fetched_at TIMESTAMPTZ;
