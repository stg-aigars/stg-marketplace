export interface MessageThread {
  id: string;
  user_a_id: string | null;
  user_b_id: string | null;
  last_message_at: string;
  last_message_preview: string;
  user_a_last_read_at: string | null;
  user_b_last_read_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  listing_ref_id: string | null;
  created_at: string;
}

export type MessagingError =
  | 'unauthenticated'
  | 'self_target'
  | 'invalid_body'
  | 'invalid_listing_ref'
  | 'cannot_message_user'
  | 'unknown_user';

/** Raw jsonb shape returned by the send_first_message Postgres RPC.
 *  Translated to the canonical { success } / { error } server-action shape
 *  in src/lib/messaging/actions.ts. */
export type SendFirstMessageRpcResult =
  | { ok: true; thread_id: string; message_id: string }
  | { ok: false; error: MessagingError };

export type SendFirstMessageResult =
  | { success: true; thread_id: string; message_id: string }
  | { error: MessagingError };

export const MESSAGE_MAX_LENGTH = 2000;
