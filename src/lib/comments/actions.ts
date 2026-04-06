'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';
import { commentLimiter } from '@/lib/rate-limit';
import { notify, notifyMany } from '@/lib/notifications';
import { logAuditEvent } from '@/lib/services/audit';
import { MAX_COMMENT_LENGTH, type ListingComment } from './types';

const COMMENTABLE_STATUSES = ['active', 'reserved', 'auction_ended'];

/**
 * Post a public comment on a listing.
 */
export async function postComment(
  listingId: string,
  content: string,
  turnstileToken?: string
): Promise<{ success: true } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, await getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    return { error: `Comment must be between 1 and ${MAX_COMMENT_LENGTH} characters` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const limitResult = commentLimiter.check(user.id);
  if (!limitResult.success) return { error: 'Too many comments. Please wait a moment.' };

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

    if (!isSeller) {
      void notify(listing.seller_id, 'comment.received', notificationContext);
    } else {
      // Seller replied — notify previous commenters, but only those who commented
      // after their last notification for this listing (dedup consecutive seller replies)
      const serviceClient = createServiceClient();
      const [{ data: previousComments }, { data: existingNotifications }] = await Promise.all([
        serviceClient
          .from('listing_comments')
          .select('user_id, created_at')
          .eq('listing_id', listingId)
          .not('user_id', 'is', null)
          .neq('user_id', user.id)
          .order('created_at', { ascending: false }),
        serviceClient
          .from('notifications')
          .select('user_id, created_at')
          .eq('type', 'comment.received')
          .eq('metadata->>listingId', listingId)
          .order('created_at', { ascending: false }),
      ]);

      if (previousComments && previousComments.length > 0) {
        // Build map of each user's latest comment on this listing
        const lastCommentByUser = new Map<string, string>();
        for (const c of previousComments) {
          const uid = c.user_id as string;
          if (!lastCommentByUser.has(uid)) lastCommentByUser.set(uid, c.created_at);
        }

        // Build map of each user's latest notification for this listing
        const lastNotifByUser = new Map<string, string>();
        if (existingNotifications) {
          for (const n of existingNotifications) {
            const uid = n.user_id as string;
            if (!lastNotifByUser.has(uid)) lastNotifByUser.set(uid, n.created_at);
          }
        }

        // Only notify users whose last comment is after their last notification
        const toNotify = [...lastCommentByUser.entries()]
          .filter(([uid, lastComment]) => {
            const lastNotif = lastNotifByUser.get(uid);
            return !lastNotif || lastComment > lastNotif;
          })
          .map(([uid]) => uid);

        if (toNotify.length > 0) {
          void notifyMany(
            toNotify.map((userId) => ({
              userId,
              type: 'comment.received' as const,
              context: notificationContext,
            }))
          );
        }
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

  // Batch-fetch author names from public_profiles
  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))] as string[];

  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from('public_profiles')
        .select('id, full_name')
        .in('id', userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return comments.map((c) => ({
    id: c.id,
    listing_id: c.listing_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author_name: c.user_id ? (profileMap.get(c.user_id) ?? null) : null,
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
  const { error: updateError } = await serviceClient
    .from('listing_comments')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', commentId)
    .is('deleted_at', null);

  if (updateError) {
    console.error('[Comments] Delete failed:', updateError.message);
    return { error: 'Failed to delete comment' };
  }

  void logAuditEvent({
    actorId: user.id,
    actorType: 'user',
    action: 'comment.deleted',
    resourceType: 'listing_comment',
    resourceId: commentId,
  });

  revalidatePath(`/listings/${listingId}`);
  return { success: true };
}
