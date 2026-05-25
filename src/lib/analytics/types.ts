import type { ListingCondition } from '@/lib/listings/types';
import type { FeedbackCategory } from '@/lib/feedback/types';

export interface AnalyticsEventMap {
  search_performed: { query: string; result_count: number };
  listing_viewed: {
    listing_id: string;
    bgg_game_id: number;
    price_cents: number;
    condition: ListingCondition;
    listing_type: 'fixed_price' | 'auction';
  };
  checkout_started: {
    seller_id: string;
    total_cents: number;
    item_count: number;
  };
  order_completed: {
    order_id: string;
    seller_id: string;
    total_cents: number;
  };
  listing_created: {
    listing_id: string;
    bgg_game_id: number;
    price_cents: number;
    listing_type: 'fixed_price' | 'auction';
  };
  signup_completed: { method: 'email' | 'google' | 'facebook' };
  cart_item_added: {
    listing_id: string;
    price_cents: number;
    seller_id: string;
  };
  seller_profile_viewed: {
    seller_id: string;
    listing_count: number;
  };
  auction_bid_placed: {
    listing_id: string;
    amount_cents: number;
    bid_count: number;
  };
  wanted_listing_created: {
    wanted_listing_id: string;
    bgg_game_id: number;
    has_edition_preference: boolean;
  };
  newsletter_subscribed: Record<string, never>;
  homepage_feature_tab_clicked: { tab: 'browse' | 'sell' | 'ship' | 'payments' };
  'accounting.orphan_emit_skipped': {
    orphan_type: 'completion' | 'refund';
    order_id: string;
    cart_payment_id: string | null;
    expected_antecedent_type_ids: readonly string[];
    service_file: string;
  };
  feedback_submitted: {
    category: FeedbackCategory;
    anonymous: boolean;
  };
  // Messaging — see docs/plans/2026-05-25-message-seller-design.md
  // is_first_message semantics: send_first_message RPC fires `true` on BOTH create
  // and on-conflict-existing branches (user intended a first message either way);
  // sendMessage in-thread fires `false`.
  message_thread_started: {
    thread_id: string;
    entry_point: 'listing_detail' | 'seller_profile';
    has_listing_ref: boolean;
  };
  message_sent: {
    thread_id: string;
    is_first_message: boolean;
    has_listing_ref: boolean;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;
