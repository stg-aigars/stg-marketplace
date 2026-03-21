-- Fix: user_profiles SELECT policy exposes email, phone, is_staff to anonymous users.
-- Replace the broad "anyone can view" policy with authenticated-only access.
-- Create a public_profiles view for anonymous pages (seller profile, listing detail).

-- 1. Drop the overly-broad SELECT policy
DROP POLICY "Users can view any profile" ON user_profiles;

-- 2. Authenticated users can view any profile (needed for messaging, orders, FK joins)
CREATE POLICY "Authenticated users can view any profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Create a view exposing only safe columns for anonymous access
CREATE VIEW public_profiles AS
  SELECT id, full_name, country, created_at
  FROM user_profiles;

-- Grant anon and authenticated roles access to the view
GRANT SELECT ON public_profiles TO anon;
GRANT SELECT ON public_profiles TO authenticated;
