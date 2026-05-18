-- Site feedback queue. Private posture: staff reads via service role at
-- /staff/feedback. Mirrors listing_comments' user_id ON DELETE SET NULL
-- anonymization (don't cascade — feedback stays for triage even if the
-- submitter deletes their account).

CREATE TABLE site_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('idea', 'bug', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  contact_email TEXT,
  page_url TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_feedback_status_created_at
  ON site_feedback (status, created_at DESC);
CREATE INDEX idx_site_feedback_user_id
  ON site_feedback (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE site_feedback ENABLE ROW LEVEL SECURITY;

-- No policies on purpose. RLS enabled + zero policies = deny-all for the anon
-- and authenticated roles. The API route at /api/feedback inserts via the
-- service role, which bypasses RLS — so policies for those roles would be dead
-- code and create a false sense of an in-DB guard. The route enforces the
-- "anon submissions must have user_id = null" invariant in application code.
-- Staff reads + status mutations at /staff/feedback also go through the service
-- role.

COMMENT ON TABLE site_feedback IS
  'Private user-feedback queue. RLS enabled with no policies (deny-all to anon and authenticated). All reads + writes go through the service role: writes from /api/feedback, reads + status mutations from /staff/feedback. The application enforces user_id = auth.uid() for signed-in submissions and user_id IS NULL for anon submissions; this is not enforceable via RLS because the service-role insert path bypasses policies.';
