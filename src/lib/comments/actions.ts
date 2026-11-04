'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { commentLimiter, checkUserRateLimit } from '@/lib/rate-limit';
import { notify, notifyMany } from '@/lib/notifications';
import { logAuditEvent } from '@/lib/services/audit';
import { fetchPublicProfiles } from '@/lib/supabase/helpers';
import { sendCommentReceivedToSeller, sendCommentReplyToCommenter } from '@/lib/email';
import { MAX_COMMENT_LENGTH, type ListingComment } from './types';
import { selectReplyRecipients } from './recipients';

const COMMENTABLE_STATUSES = ['active', 'reserved', 'auction_ended'];

/**
 * Email each recipient sequentially (typically 1–3 people, keeps us under
 * Resend's rate limit). Recipient emails live on user_profiles, which RLS
 * hides from peers, so this needs the service-role client. A failure for one
 * recipient is logged and doesn't stop the rest.
 */
async function emailCommentRecipients(
  serviceClient: ReturnType<typeof createServiceClient>,
  userIds: string[],
  send: (recipient: { recipientName: string; recipientEmail: string }) => Promise<void>,
): Promise<void> {
  const { data: profiles, error } = await serviceClient
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  if (error) {
    console.error('[Comments] Recipient lookup for email failed:', error.message);
    return;
  }

  for (const profile of profiles ?? []) {
    if (!profile.email) continue;
    try {
      await send({ recipientName: profile.full_name ?? 'there', recipientEmail: profile.email });
    } catch (err) {
      console.error(`[Comments] Email to ${profile.id} failed:`, err);
    }
  }
}

/**
 * Post a public comment on a listing.
 */
export async function postComment(
  listingId: string,
  content: string
): Promise<{ success: true } | { error: string }> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    return { error: `Comment must be between 1 and ${MAX_COMMENT_LENGTH} characters` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const limited = checkUserRateLimit(commentLimiter, user.id, 'comment_post', 'Too many comments. Please wait a moment.');
  if (limited) return limited;

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, game_name, status')
    .eq('id', listingId)
    .single<{ id: string; seller_id: string; game_name: string; status: string }>();

  if (!listing) return { error: 'Listing not found' };
  if (!COMMENTABLE_STATUSES.includes(listing.status)) {
    return { error: 'This listing is no longer accepting comments' };
  }

  const { error: insertError } = await supabase
    .from('listing_comments')
    .insert({
      listing_id: listingId,
      user_id: user.id,
      content: trimmed,
    });

  if (insertError) {
    console.error('[Comments] Insert failed:', insertError.message);
    return { error: 'Failed to post comment. Please try again.' };
  }

  // Fire-and-forget: notification dispatch doesn't block the response
  void (async () => {
    const isSeller = user.id === listing.seller_id;

    const { data: commenterProfile } = await supabase
      .from('public_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single<{ full_name: string | null }>();

    const commenterName = commenterProfile?.full_name ?? 'Someone';
    const notificationContext = {
      gameName: listing.game_name,
      listingId: listing.id,
      commenterName,
    };

    const serviceClient = createServiceClient();

    if (!isSeller) {
      void notify(listing.seller_id, 'comment.received', notificationContext);
      await emailCommentRecipients(serviceClient, [listing.seller_id], (recipient) =>
        sendCommentReceivedToSeller({
          ...recipient,
          authorName: commenterName,
          gameName: listing.game_name,
          listingId: listing.id,
          commentBody: trimmed,
        }),
      );
    } else {
      // Seller replied — notify previous commenters, but only those who commented
      // after their last notification for this listing (dedup consecutive seller replies)
      const [{ data: previousComments }, { data: existingNotifications }] = await Promise.all([
        serviceClient
          .from('listing_comments')
          .select('user_id, created_at')
          .eq('listing_id', listingId)
          .is('deleted_at', null)
          .not('user_id', 'is', null)
          .neq('user_id', user.id),
        serviceClient
          .from('notifications')
          .select('user_id, created_at')
          .eq('type', 'comment.received')
          .eq('metadata->>listingId', listingId),
      ]);

      const toNotify = selectReplyRecipients(previousComments ?? [], existingNotifications ?? []);

      if (toNotify.length > 0) {
        void notifyMany(
          toNotify.map((userId) => ({
            userId,
            type: 'comment.received' as const,
            context: notificationContext,
          }))
        );
        await emailCommentRecipients(serviceClient, toNotify, (recipient) =>
          sendCommentReplyToCommenter({
            ...recipient,
            authorName: commenterName,
            gameName: listing.game_name,
            listingId: listing.id,
            commentBody: trimmed,
          }),
        );
      }
    }
  })().catch((err) => console.error('[Comments] Notification dispatch failed:', err));

  revalidatePath(`/listings/${listingId}`);
  return { success: true };
}

/**
 * Get all comments for a listing, oldest first.
 * Accepts sellerId to avoid an extra DB round-trip (caller already has it).
 */
export async function getComments(listingId: string, sellerId: string): Promise<ListingComment[]> {
  const supabase = await createClient();

  const { data: comments } = await supabase
    .from('listing_comments')
    .select('id, listing_id, user_id, content, created_at')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });

  if (!comments || comments.length === 0) return [];

  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))] as string[];
  const profileMap = await fetchPublicProfiles(supabase, userIds);

  return comments.map((c) => ({
    id: c.id,
    listing_id: c.listing_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author_name: c.user_id ? (profileMap.get(c.user_id)?.full_name ?? null) : null,
    author_avatar_url: c.user_id ? (profileMap.get(c.user_id)?.avatar_url ?? null) : null,
    author_is_seller: c.user_id === sellerId,
  }));
}

/**
 * Soft-delete a comment (staff only). Uses service role client.
 */
export async function deleteComment(
  commentId: string,
  listingId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_staff')
    .eq('id', user.id)
    .single<{ is_staff: boolean }>();

  if (!profile?.is_staff) return { error: 'Not authorized' };

  const serviceClient = createServiceClient();
  const { data: claimed, error: updateError } = await serviceClient
    .from('listing_comments')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', commentId)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (updateError) {
    if (updateError.code === 'PGRST116') {
      return { error: 'Comment already deleted' };
    }
    console.error('[Comments] Delete failed:', updateError.message);
    return { error: 'Failed to delete comment' };
  }
  if (!claimed) {
    return { error: 'Comment already deleted' };
  }

  void logAuditEvent(serviceClient, {
    actorId: user.id,
    actorType: 'user',
    action: 'comment.deleted',
    resourceType: 'listing_comment',
    resourceId: commentId,
    retentionClass: 'operational',
  });

  revalidatePath(`/listings/${listingId}`);
  return { success: true };
}
