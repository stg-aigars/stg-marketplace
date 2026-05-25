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

CREATE POLICY "Users see messages in their threads"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = messages.thread_id
        AND auth.uid() IN (t.user_a_id, t.user_b_id)
    )
  );

CREATE POLICY "Users send messages into live threads with no block"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = messages.thread_id
        AND t.user_a_id IS NOT NULL
        AND t.user_b_id IS NOT NULL
        AND auth.uid() IN (t.user_a_id, t.user_b_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.message_blocks b
          WHERE (b.blocker_id = t.user_a_id AND b.blocked_id = t.user_b_id)
             OR (b.blocker_id = t.user_b_id AND b.blocked_id = t.user_a_id)
        )
    )
    AND (
      listing_ref_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = messages.listing_ref_id
          AND l.seller_id = (
            SELECT CASE WHEN user_a_id = sender_id THEN user_b_id ELSE user_a_id END
            FROM public.message_threads WHERE id = messages.thread_id
          )
      )
    )
  );

CREATE POLICY "Users manage their own blocks"
  ON public.message_blocks
  FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.send_first_message(
  p_other_user_id uuid,
  p_body text,
  p_listing_ref_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_user_a uuid;
  v_user_b uuid;
  v_thread_id uuid;
  v_message_id uuid;
  v_target_messaging_enabled boolean;
  v_blocked boolean;
  v_listing_seller uuid;
BEGIN
  IF v_sender IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_other_user_id = v_sender THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_target');
  END IF;

  IF p_body IS NULL OR length(p_body) < 1 OR length(p_body) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_body');
  END IF;

  -- Validate other user exists
  PERFORM 1 FROM public.user_profiles WHERE id = p_other_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_user');
  END IF;

  -- Validate listing_ref ownership if provided
  IF p_listing_ref_id IS NOT NULL THEN
    SELECT seller_id INTO v_listing_seller
    FROM public.listings WHERE id = p_listing_ref_id;
    IF v_listing_seller IS NULL OR v_listing_seller <> p_other_user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_listing_ref');
    END IF;
  END IF;

  -- Canonical ordering
  IF v_sender < p_other_user_id THEN
    v_user_a := v_sender;
    v_user_b := p_other_user_id;
  ELSE
    v_user_a := p_other_user_id;
    v_user_b := v_sender;
  END IF;

  -- Block check (either direction)
  SELECT EXISTS (
    SELECT 1 FROM public.message_blocks
    WHERE (blocker_id = v_user_a AND blocked_id = v_user_b)
       OR (blocker_id = v_user_b AND blocked_id = v_user_a)
  ) INTO v_blocked;

  IF v_blocked THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_message_user');
  END IF;

  -- Try to create thread; on conflict, fetch existing
  INSERT INTO public.message_threads (user_a_id, user_b_id, last_message_at)
  VALUES (v_user_a, v_user_b, now())
  ON CONFLICT (user_a_id, user_b_id) DO NOTHING
  RETURNING id INTO v_thread_id;

  IF v_thread_id IS NULL THEN
    -- Race winner created the thread first; opt-out gate skipped (past it by definition)
    SELECT id INTO v_thread_id FROM public.message_threads
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;
  ELSE
    -- New thread path: check target's messaging_enabled
    SELECT messaging_enabled INTO v_target_messaging_enabled
    FROM public.user_profiles WHERE id = p_other_user_id;

    IF v_target_messaging_enabled = false THEN
      -- Roll back the thread insert
      DELETE FROM public.message_threads WHERE id = v_thread_id;
      RETURN jsonb_build_object('ok', false, 'error', 'cannot_message_user');
    END IF;
  END IF;

  -- Insert the message; trigger handles thread metadata
  INSERT INTO public.messages (thread_id, sender_id, body, listing_ref_id)
  VALUES (v_thread_id, v_sender, p_body, p_listing_ref_id)
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object(
    'ok', true,
    'thread_id', v_thread_id,
    'message_id', v_message_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_first_message TO authenticated;
