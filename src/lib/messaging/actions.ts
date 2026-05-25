'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/helpers';
import { notify } from '@/lib/notifications';
import { trackServer } from '@/lib/analytics/track-server';
import type { SendFirstMessageResult } from './types';

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
  entryPoint: 'listing_detail' | 'seller_profile';
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
    return { ok: false, error: 'cannot_message_user' };
  }

  const result = data as SendFirstMessageResult;
  if (!result.ok) return result;

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
    threadId: result.thread_id,
    listingId: args.listingRefId,
    senderName: profile?.full_name ?? undefined,
    gameName,
  });
  void trackServer('message_thread_started', user.id, {
    thread_id: result.thread_id,
    entry_point: args.entryPoint,
    has_listing_ref: !!args.listingRefId,
  });
  void trackServer('message_sent', user.id, {
    thread_id: result.thread_id,
    is_first_message: true,
    has_listing_ref: !!args.listingRefId,
  });

  return result;
}
