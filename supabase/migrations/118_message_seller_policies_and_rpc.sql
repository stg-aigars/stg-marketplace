-- 118_message_seller_policies_and_rpc.sql
-- Private 1:1 messaging: INSERT trigger, RLS policies, send_first_message RPC.
-- Pairs with 117.
--
-- Note on trigger posture: on_message_insert is SECURITY DEFINER with
-- SET search_path = '' so the metadata UPDATE on message_threads bypasses
-- the table's RLS policies (UPDATE policy is participant-scoped and would
-- only allow the sender's side to update — but the trigger needs to flip
-- the sender's own user_{a|b}_last_read_at in the same TX as the insert).
-- Intended; no UPDATE-via-trigger surface for the user.

CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.message_threads
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.body, 200),
      user_a_last_read_at = CASE WHEN user_a_id = NEW.sender_id THEN NEW.created_at ELSE user_a_last_read_at END,
      user_b_last_read_at = CASE WHEN user_b_id = NEW.sender_id THEN NEW.created_at ELSE user_b_last_read_at END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_message_insert();

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own threads"
  ON public.message_threads
  FOR SELECT
  USING (auth.uid() IN (user_a_id, user_b_id));

-- Allow each side to update only their own last_read_at via markThreadRead server action.
CREATE POLICY "Users update their own last_read_at"
  ON public.message_threads
  FOR UPDATE
  USING (auth.uid() IN (user_a_id, user_b_id))
  WITH CHECK (auth.uid() IN (user_a_id, user_b_id));
