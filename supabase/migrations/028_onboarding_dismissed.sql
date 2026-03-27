-- Add onboarding dismissed tracking to user profiles
ALTER TABLE user_profiles
  ADD COLUMN onboarding_dismissed_at timestamptz;

-- Backfill existing users so they never see the onboarding checklist
UPDATE user_profiles
  SET onboarding_dismissed_at = NOW()
  WHERE created_at < NOW();
