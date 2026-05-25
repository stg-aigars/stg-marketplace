import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { markThreadRead } from '@/lib/messaging/actions';
import { ThreadView } from './ThreadView';

export const metadata: Metadata = {
  title: 'Message thread',
};

interface PageProps {
  params: Promise<{ threadId: string }>;
}

export default async function ThreadDetailPage({ params }: PageProps) {
  const { threadId } = await params;
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from('message_threads')
    .select(
      'id, user_a_id, user_b_id, last_message_at, last_message_preview, user_a_last_read_at, user_b_last_read_at',
    )
    .eq('id', threadId)
    .maybeSingle();

  // RLS will return null for non-participants too — same as truly missing.
  if (!thread) notFound();

  const counterpartyId = thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;
  const isGhostThread = !counterpartyId;

  const { data: messages } = await supabase
    .from('messages')
    .select('id, thread_id, sender_id, body, listing_ref_id, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  let counterparty: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    country: string | null;
  } | null = null;
  if (counterpartyId) {
    const { data } = await supabase
      .from('public_profiles')
      .select('id, full_name, avatar_url, country')
      .eq('id', counterpartyId)
      .maybeSingle();
    counterparty = data ?? null;
  }

  // Resolve listing chips referenced inline in the transcript.
  const listingIds = Array.from(
    new Set((messages ?? []).map((m) => m.listing_ref_id).filter((id): id is string => !!id)),
  );
  const listingMap = new Map<
    string,
    { id: string; game_name: string; price_cents: number; primary_photo_url: string | null }
  >();
  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, game_name, price_cents, primary_photo_url')
      .in('id', listingIds);
    (listings ?? []).forEach((l) => listingMap.set(l.id, l));
  }

  // Check whether either side has blocked the other — disables the composer.
  const blockedEitherDirection = counterpartyId
    ? await (async () => {
        const { data: blocks } = await supabase
          .from('message_blocks')
          .select('blocker_id, blocked_id')
          .or(
            `and(blocker_id.eq.${user.id},blocked_id.eq.${counterpartyId}),and(blocker_id.eq.${counterpartyId},blocked_id.eq.${user.id})`,
          );
        return (blocks ?? []).length > 0;
      })()
    : false;

  // Fire-and-forget — bump viewer's last_read_at to "now" on view.
  void markThreadRead(threadId);

  return (
    <ThreadView
      threadId={threadId}
      currentUserId={user.id}
      counterparty={counterparty}
      isGhostThread={isGhostThread}
      composerDisabled={isGhostThread || blockedEitherDirection}
      composerDisabledReason={
        isGhostThread
          ? 'You can’t reply to this conversation.'
          : blockedEitherDirection
            ? 'Messaging is paused here.'
            : null
      }
      messages={messages ?? []}
      listingMap={Object.fromEntries(listingMap)}
    />
  );
}
