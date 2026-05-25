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
