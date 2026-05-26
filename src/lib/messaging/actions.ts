'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/helpers';
import { notify } from '@/lib/notifications';
import { trackServer } from '@/lib/analytics/track-server';
import type { MessagingEntryPoint, SendFirstMessageResult, SendFirstMessageRpcResult } from './types';

type SendMessageResult = { success: true } | { error: string };

export async function findExistingThread(otherUserId: string): Promise<{ threadId: string | null }> {
  const { user } = await requireServerAuth();
  const supabase = await createClient();
  const [a, b] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

  const { data } = await supabase
    .from('message_threads')
    .select('id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle();

  return { threadId: data?.id ?? null };
}

export async function sendFirstMessage(args: {
  otherUserId: string;
  body: string;
  listingRefId?: string;
  entryPoint: MessagingEntryPoint;
}): Promise<SendFirstMessageResult> {
  const { user, profile } = await requireServerAuth();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('send_first_message', {
    p_other_user_id: args.otherUserId,
    p_body: args.body,
    p_listing_ref_id: args.listingRefId ?? null,
  });

  if (error) {
    console.error('send_first_message RPC error', error);
    return { error: 'cannot_message_user' };
  }

  const rpc = data as SendFirstMessageRpcResult;
  if (!rpc.ok) return { error: rpc.error };

  // Resolve gameName for the recipient notification (notify() doesn't auto-enrich;
  // template falls back gracefully if we omit, but we have the listing id in hand).
  let gameName: string | undefined;
  if (args.listingRefId) {
    const { data: listing } = await supabase
      .from('listings')
      .select('game_name')
      .eq('id', args.listingRefId)
      .maybeSingle();
    gameName = listing?.game_name ?? undefined;
  }

  // Side effects (fire-and-forget per CLAUDE.md pattern)
  void notify(args.otherUserId, 'message.received', {
    threadId: rpc.thread_id,
    listingId: args.listingRefId,
    senderName: profile?.full_name ?? undefined,
    gameName,
  });
  void trackServer('message_thread_started', user.id, {
    thread_id: rpc.thread_id,
    entry_point: args.entryPoint,
    has_listing_ref: !!args.listingRefId,
  });
  void trackServer('message_sent', user.id, {
    thread_id: rpc.thread_id,
    is_first_message: true,
    has_listing_ref: !!args.listingRefId,
  });

  return { success: true, thread_id: rpc.thread_id, message_id: rpc.message_id };
}

export async function sendMessage(args: {
  threadId: string;
  body: string;
  listingRefId?: string;
}): Promise<SendMessageResult> {
  const { user, profile } = await requireServerAuth();
  const supabase = await createClient();

  if (args.body.length < 1 || args.body.length > 2000) {
    return { error: 'invalid_body' };
  }

  const { data: thread } = await supabase
    .from('message_threads')
    .select('id, user_a_id, user_b_id')
    .eq('id', args.threadId)
    .maybeSingle();

  if (!thread) return { error: 'thread_not_found' };
  const recipientId = thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;
  if (!recipientId) return { error: 'ghost_thread' };

  const { error } = await supabase.from('messages').insert({
    thread_id: args.threadId,
    sender_id: user.id,
    body: args.body,
    listing_ref_id: args.listingRefId ?? null,
  });

  if (error) return { error: 'send_failed' };

  // Resolve gameName for the recipient notification (notify() doesn't auto-enrich).
  let gameName: string | undefined;
  if (args.listingRefId) {
    const { data: listing } = await supabase
      .from('listings')
      .select('game_name')
      .eq('id', args.listingRefId)
      .maybeSingle();
    gameName = listing?.game_name ?? undefined;
  }

  void notify(recipientId, 'message.received', {
    threadId: args.threadId,
    listingId: args.listingRefId,
    senderName: profile?.full_name ?? undefined,
    gameName,
  });
  void trackServer('message_sent', user.id, {
    thread_id: args.threadId,
    is_first_message: false,
    has_listing_ref: !!args.listingRefId,
  });

  return { success: true };
}

export async function markThreadRead(threadId: string) {
  const { user } = await requireServerAuth();
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from('message_threads')
    .select('user_a_id, user_b_id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread) return;
  const column = thread.user_a_id === user.id ? 'user_a_last_read_at' : 'user_b_last_read_at';
  const now = new Date().toISOString();
  await supabase
    .from('message_threads')
    .update({ [column]: now })
    .eq('id', threadId);

  // Also mark any unread 'message.received' notifications for this thread as
  // read — clears the bell badge + the "Messages" dropdown unread dot when
  // the user opens the thread directly (without going through the bell).
  await supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', user.id)
    .eq('type', 'message.received')
    .is('read_at', null)
    .eq('metadata->>threadId', threadId);
}

export async function toggleMessagingEnabled(newValue: boolean) {
  const { user } = await requireServerAuth();
  const supabase = await createClient();
  await supabase.from('user_profiles').update({ messaging_enabled: newValue }).eq('id', user.id);
}

export async function blockUser(targetId: string) {
  const { user } = await requireServerAuth();
  const supabase = await createClient();
  await supabase.from('message_blocks').upsert({ blocker_id: user.id, blocked_id: targetId });
}

export async function unblockUser(targetId: string) {
  const { user } = await requireServerAuth();
  const supabase = await createClient();
  await supabase
    .from('message_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', targetId);
}
