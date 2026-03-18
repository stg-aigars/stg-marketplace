/**
 * Review types
 * Maps to the reviews table in supabase/migrations/016_reviews.sql
 */

/** 1:1 mapping to the reviews table row */
export interface ReviewRow {
  id: string;
  order_id: string;
  reviewer_id: string;
  seller_id: string;
  is_positive: boolean;
  comment: string | null;
  created_at: string;
}

/** Review with joined reviewer profile for display */
export interface ReviewWithReviewer extends ReviewRow {
  reviewer_profile: {
    full_name: string | null;
  } | null;
}

/** Aggregated seller rating */
export interface SellerRating {
  ratingCount: number;
  positiveCount: number;
  positivePct: number;
}
