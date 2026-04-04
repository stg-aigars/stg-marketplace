'use server';

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

  // Fetch listing for seller_id, game_name, and status check
  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, game_name, status')
    .eq('id', listingId)
    .single<{ id: string; seller_id: string; game_name: string; status: string }>();

  if (!listing) return { error: 'Listing not found' };
  if (!COMMENTABLE_STATUSES.includes(listing.status)) {
    return { error: 'This listing is no longer accepting comments' };
  }

  // Insert comment (RLS: auth.uid() = user_id)
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

  // Fire-and-forget notifications
  const isSeller = user.id === listing.seller_id;

  // Get commenter's display name
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
    // Notify the seller
    void notify(listing.seller_id, 'comment.received', notificationContext);
  } else {
    // Seller replied — notify all distinct previous commenters (excluding seller)
    // TODO: dedup guard — skip notifying commenters who were already notified
    // since their last comment (prevents noise from consecutive seller replies)
    const serviceClient = createServiceClient();
    const { data: previousCommenters } = await serviceClient
      .from('listing_comments')
      .select('user_id')
      .eq('listing_id', listingId)
      .not('user_id', 'is', null)
      .neq('user_id', user.id);

    if (previousCommenters && previousCommenters.length > 0) {
      const uniqueUserIds = [...new Set(previousCommenters.map((c) => c.user_id as string))];
      void notifyMany(
        uniqueUserIds.map((userId) => ({
          userId,
          type: 'comment.received' as const,
          context: notificationContext,
        }))
      );
    }
  }

  return { success: true };
}

/**
 * Get all comments for a listing, oldest first.
 */
export async function getComments(listingId: string): Promise<ListingComment[]> {
  const supabase = await createClient();

  // Get listing seller_id to flag seller comments
  const { data: listing } = await supabase
    .from('listings')
    .select('seller_id')
    .eq('id', listingId)
    .single<{ seller_id: string }>();

  if (!listing) return [];

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
    author_is_seller: c.user_id === listing.seller_id,
  }));
}

/**
 * Soft-delete a comment (staff only). Uses service role client.
 */
export async function deleteComment(
  commentId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify staff status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_staff')
    .eq('id', user.id)
    .single<{ is_staff: boolean }>();

  if (!profile?.is_staff) return { error: 'Not authorized' };

  // Soft-delete via service role (no UPDATE RLS policy on listing_comments)
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

  return { success: true };
}
