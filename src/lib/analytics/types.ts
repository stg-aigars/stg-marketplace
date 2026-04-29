import type { ListingCondition } from '@/lib/listings/types';

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
}

export type AnalyticsEventName = keyof AnalyticsEventMap;
