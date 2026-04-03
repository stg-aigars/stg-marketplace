export type ListingCondition = 'like_new' | 'very_good' | 'good' | 'acceptable' | 'for_parts';

export type ListingType = 'fixed_price' | 'auction';

export type ListingStatus = 'active' | 'sold' | 'cancelled' | 'reserved' | 'auction_ended';

export type VersionSource = 'bgg' | 'manual';

export interface VersionData {
  version_source: VersionSource;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
}

export interface CreateListingData {
  bgg_game_id: number;
  game_name: string;
  game_year: number | null;
  version_source: VersionSource;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
  condition: ListingCondition;
  price_cents: number;
  description: string | null;
  photos: string[];
  offer_id?: string;
  wanted_offer_id?: string;
  // Auction fields (only when listing_type = 'auction')
  listing_type?: ListingType;
  auction_duration_days?: number;
  starting_price_cents?: number;
}

export interface UpdateListingData {
  id: string;
  game_name: string;
  version_source: VersionSource;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  description: string | null;
  photos: string[];
}

/** Maps condition DB values to Badge component condition keys */
export const conditionToBadgeKey: Record<ListingCondition, 'likeNew' | 'veryGood' | 'good' | 'acceptable' | 'forParts'> = {
  like_new: 'likeNew',
  very_good: 'veryGood',
  good: 'good',
  acceptable: 'acceptable',
  for_parts: 'forParts',
};

export const LISTING_CONDITIONS: ListingCondition[] = [
  'like_new',
  'very_good',
  'good',
  'acceptable',
  'for_parts',
];

const PHOTO_REQUIRED_CONDITIONS: readonly ListingCondition[] = ['acceptable', 'for_parts'];

export function conditionRequiresPhotos(condition: string): boolean {
  return PHOTO_REQUIRED_CONDITIONS.includes(condition as ListingCondition);
}

export function conditionRequiresDescription(condition: string): boolean {
  return PHOTO_REQUIRED_CONDITIONS.includes(condition as ListingCondition);
}

export const MIN_PRICE_CENTS = 50; // €0.50
export const MAX_GAME_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_TEXT_FIELD_LENGTH = 200;
export const MAX_PRICE_CENTS = 999999; // €9,999.99
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
