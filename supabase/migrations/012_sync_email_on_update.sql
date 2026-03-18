-- Keep user_profiles.email in sync when auth.users.email changes
-- (e.g., user updates their email via Supabase Auth)

CREATE OR REPLACE FUNCTION public.sync_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_profile_email();
