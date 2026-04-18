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
}

export type AnalyticsEventName = keyof AnalyticsEventMap;
