-- Track email bounce/complaint status on user profiles.
-- When Resend reports a hard bounce or spam complaint, the user's email
-- is flagged so the app can show an in-app warning and skip future sends.

ALTER TABLE user_profiles ADD COLUMN email_bounced_at TIMESTAMPTZ;
