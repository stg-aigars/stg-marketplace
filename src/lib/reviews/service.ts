/**
 * Review service
 * Handles review submission, retrieval, and seller rating aggregation.
 */

import { createClient } from '@/lib/supabase/server';
import { REVIEW_MAX_COMMENT_LENGTH } from './constants';
import type { ReviewRow, ReviewWithReviewer, SellerRating } from './types';

/**
 * Submit a review for an order.
 * Uses authenticated client — RLS enforces buyer ownership, order status, and 30-day window.
 */
export async function submitReview(
  orderId: string,
  sellerId: string,
  isPositive: boolean,
  comment: string | null
): Promise<ReviewRow> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Trim and validate comment
  const trimmedComment = comment?.trim() || null;
  if (trimmedComment && trimmedComment.length > REVIEW_MAX_COMMENT_LENGTH) {
    throw new Error(`Comment must be ${REVIEW_MAX_COMMENT_LENGTH} characters or less`);
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      order_id: orderId,
      reviewer_id: user.id,
      seller_id: sellerId,
      is_positive: isPositive,
      comment: trimmedComment,
    })
    .select()
    .single<ReviewRow>();

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already reviewed this order');
    }
    throw error;
  }

  if (!data) {
    throw new Error('Failed to create review');
  }

  return data;
}

/**
 * Get the review for a specific order, if one exists.
 */
export async function getReviewForOrder(orderId: string): Promise<ReviewRow | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .single<ReviewRow>();

  return data ?? null;
}

/**
 * Get recent reviews for a seller, with reviewer profile info.
 */
export async function getSellerReviews(
  sellerId: string,
  limit = 10
): Promise<ReviewWithReviewer[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer_profile:user_profiles!reviews_reviewer_id_fkey(full_name)
    `)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data as ReviewWithReviewer[]) ?? [];
}

/**
 * Get aggregated seller rating computed from reviews.
 */
export async function getSellerRating(sellerId: string): Promise<SellerRating> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('reviews')
    .select('is_positive')
    .eq('seller_id', sellerId);

  if (!data || data.length === 0) {
    return { ratingCount: 0, positiveCount: 0, positivePct: 0 };
  }

  const ratingCount = data.length;
  const positiveCount = data.filter(r => r.is_positive).length;
  const positivePct = Math.round((positiveCount / ratingCount) * 100);

  return { ratingCount, positiveCount, positivePct };
}
