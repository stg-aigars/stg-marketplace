-- 117_message_seller_schema.sql
-- Private 1:1 messaging: tables, columns, indexes.
-- RLS, RPC, and trigger ship in 118.
-- Design: docs/plans/2026-05-25-message-seller-design.md

CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_b_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL,
  last_message_preview varchar(200) NOT NULL DEFAULT '',
  user_a_last_read_at timestamptz,
  user_b_last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_threads_canonical_order
    CHECK (user_a_id IS NULL OR user_b_id IS NULL OR user_a_id < user_b_id),
  CONSTRAINT message_threads_pair_unique
    UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_message_threads_user_a ON public.message_threads (user_a_id, last_message_at DESC);
CREATE INDEX idx_message_threads_user_b ON public.message_threads (user_b_id, last_message_at DESC);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  listing_ref_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  email_send_attempts int NOT NULL DEFAULT 0,
  CONSTRAINT messages_body_length CHECK (length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_messages_thread ON public.messages (thread_id, created_at);
CREATE INDEX idx_messages_undelivered
  ON public.messages (created_at)
  WHERE email_sent_at IS NULL;

CREATE TABLE public.message_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_blocks_unique UNIQUE (blocker_id, blocked_id),
  CONSTRAINT message_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_message_blocks_blocker ON public.message_blocks (blocker_id);
CREATE INDEX idx_message_blocks_blocked ON public.message_blocks (blocked_id);
