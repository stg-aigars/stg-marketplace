-- Add terms acceptance tracking to user_profiles.
-- Stores consent timestamp + version for legal evidence.
--
-- Existing users created before this migration will have NULL for both columns.
-- This is intentional: we cannot retroactively manufacture consent.
-- Do NOT backfill these columns with synthetic timestamps.
ALTER TABLE user_profiles
  ADD COLUMN terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN terms_version TEXT
    CHECK (terms_version ~ '^\d{4}-\d{2}-\d{2}$');

-- Update handle_new_user() to persist terms consent from signup metadata.
-- Preserves existing search_path='' from migration 059.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, full_name, email, country, country_confirmed,
    terms_accepted_at, terms_version
  )
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'country', 'LV'),
    CASE WHEN NEW.raw_user_meta_data->>'country' IS NOT NULL THEN TRUE ELSE FALSE END,
    CASE
      WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'terms_version'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
