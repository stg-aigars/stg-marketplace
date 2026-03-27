-- Fix full_name handling: use NULL instead of empty string for missing names.
-- The original trigger used COALESCE(full_name, '') which stored '' when no name
-- was provided, making null checks unreliable across the codebase.

-- 1. Update trigger to store NULL instead of empty string
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email, country, country_confirmed)
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'country', 'LV'),
    CASE WHEN NEW.raw_user_meta_data->>'country' IS NOT NULL THEN TRUE ELSE FALSE END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up existing empty strings to NULL
UPDATE user_profiles
  SET full_name = NULL
  WHERE full_name = '';
