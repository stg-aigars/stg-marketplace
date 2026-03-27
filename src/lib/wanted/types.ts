import type { ListingCondition } from '@/lib/listings/types';
import type { OfferStatus } from '@/lib/shelves/types';
import type { CountryCode } from '@/lib/country-utils';

// ============================================================================
// Wanted Listings
// ============================================================================

export type WantedListingStatus = 'active' | 'filled' | 'cancelled';

export interface WantedListingRow {
  id: string;
  buyer_id: string;
  bgg_game_id: number;
  game_name: string;
  game_year: number | null;
  min_condition: ListingCondition;
  max_price_cents: number | null;
  notes: string | null;
  country: CountryCode;
  status: WantedListingStatus;
  created_at: string;
  updated_at: string;
}

export interface WantedListingWithGame extends WantedListingRow {
  thumbnail: string | null;
  image: string | null;
}

export interface WantedListingWithDetails extends WantedListingWithGame {
  buyer_name: string;
  offer_count: number;
}

export const WANTED_LISTING_STATUS_LABELS: Record<WantedListingStatus, string> = {
  active: 'Active',
  filled: 'Filled',
  cancelled: 'Cancelled',
};

export const WANTED_LISTING_STATUS_BADGE_VARIANT: Record<WantedListingStatus, 'success' | 'default' | 'error'> = {
  active: 'success',
  filled: 'default',
  cancelled: 'error',
};

// ============================================================================
// Wanted Offers
// ============================================================================
// Reuses OfferStatus from shelves/types.ts — same state machine, roles swapped.
// Seller initiates → buyer counters (single round) → accepted → seller creates listing.

export type WantedOfferStatus = OfferStatus;

export interface WantedOfferRow {
  id: string;
  wanted_listing_id: string;
  seller_id: string;
  buyer_id: string;
  condition: ListingCondition;
  price_cents: number;
  note: string | null;
  counter_price_cents: number | null;
  status: WantedOfferStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface WantedOfferWithDetails extends WantedOfferRow {
  game_name: string;
  game_year: number | null;
  thumbnail: string | null;
  buyer_name: string;
  seller_name: string;
}

// Reuse shelf offer constants — same TTL and deadline rules
export {
  OFFER_TTL_DAYS,
  LISTING_DEADLINE_DAYS,
  MIN_OFFER_CENTS,
  MAX_OFFER_CENTS,
  MAX_NOTE_LENGTH,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_BADGE_VARIANT,
} from '@/lib/shelves/types';

/**
 * Condition ranking for threshold comparisons.
 * Higher index = better condition.
 * Used to validate that a seller's offer meets the buyer's minimum.
 */
export const CONDITION_RANK: Record<ListingCondition, number> = {
  for_parts: 0,
  acceptable: 1,
  good: 2,
  very_good: 3,
  like_new: 4,
};

/** Check if offered condition meets or exceeds the buyer's minimum threshold. */
export function meetsConditionThreshold(
  offered: ListingCondition,
  minimum: ListingCondition
): boolean {
  return CONDITION_RANK[offered] >= CONDITION_RANK[minimum];
}
