-- Add country_confirmed flag to distinguish "default LV" from "user chose LV"
-- Fixes: Google OAuth users from Latvia get stuck in redirect loop because
-- the middleware can't tell if country=LV means "hasn't chosen yet" or "chose LV"

ALTER TABLE user_profiles ADD COLUMN country_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- Email/password signups already provide country during registration, so mark them confirmed
-- OAuth users get country_confirmed = false (trigger default) until they complete their profile
UPDATE user_profiles SET country_confirmed = TRUE
WHERE id IN (
  SELECT id FROM auth.users
  WHERE raw_app_meta_data->>'provider' = 'email'
);

-- Update the signup trigger to set country_confirmed = true for email signups
-- (OAuth signups still get the default false)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email, country, country_confirmed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'country', 'LV'),
    -- Email signups pass country in metadata; OAuth signups don't
    CASE WHEN NEW.raw_user_meta_data->>'country' IS NOT NULL THEN TRUE ELSE FALSE END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
