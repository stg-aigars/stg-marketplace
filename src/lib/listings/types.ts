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

export interface ListingExpansion {
  bgg_game_id: number;
  game_name: string;
  version_source?: VersionSource | null;
  bgg_version_id?: number | null;
  version_name?: string | null;
  publisher?: string | null;
  language?: string | null;
  edition_year?: number | null;
  version_thumbnail?: string | null;
}

/**
 * A seller-declared included extra / component upgrade. Picked from the game's
 * BGG accessory list (`bgg_accessory_id` set) or free-text (`bgg_accessory_id`
 * null). Stored as a JSONB array on `listings.component_upgrades`.
 */
export interface ComponentUpgrade {
  bgg_accessory_id: number | null;
  name: string;
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
  // Auction fields (only when listing_type = 'auction')
  listing_type?: ListingType;
  auction_duration_days?: number;
  starting_price_cents?: number;
  expansions?: ListingExpansion[];
  component_upgrades?: ComponentUpgrade[];
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
  version_thumbnail: string | null;
  condition: ListingCondition;
  price_cents: number;
  description: string | null;
  photos: string[];
  expansions?: ListingExpansion[];
  component_upgrades?: ComponentUpgrade[];
}

/** Camel-case mirror of `ListingCondition`. The DB stores snake_case (`like_new`); the UI codepath
 *  (Badge styling, condition-config maps, condition-guide rows) keys on camelCase. Use
 *  `conditionToBadgeKey` to bridge the two. */
export type ConditionBadgeKey = 'likeNew' | 'veryGood' | 'good' | 'acceptable' | 'forParts';

/** Maps condition DB values to Badge component condition keys */
export const conditionToBadgeKey: Record<ListingCondition, ConditionBadgeKey> = {
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

export function isAuctionWithBids(listingType: string, bidCount: number): boolean {
  return listingType === 'auction' && bidCount > 0;
}

export function formatExpansionCount(count: number): string {
  return `+${count} ${count === 1 ? 'expansion' : 'expansions'}`;
}

export function formatUpgradeCount(count: number): string {
  return `+${count} ${count === 1 ? 'extra' : 'extras'}`;
}

/** Max component upgrades a seller can declare on one listing. */
export const MAX_COMPONENT_UPGRADES = 20;
/** Max length of a single component-upgrade name. */
export const MAX_UPGRADE_NAME_LENGTH = 100;

export const MIN_PRICE_CENTS = 50; // €0.50
export const MAX_GAME_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_TEXT_FIELD_LENGTH = 200;
// The language field legitimately aggregates many values: a multilingual BGG
// edition stores every language its rules cover as a comma-joined string (e.g.
// "English, French, German, ..."), and browse splits on `,` to power per-language
// filters (see browse/page.tsx). So it needs far more headroom than single-value
// fields like publisher / version_name. BGG's largest multilingual editions run
// ~25 languages (~275 chars); 500 is comfortable headroom without being unbounded.
export const MAX_LANGUAGE_FIELD_LENGTH = 500;
export const MAX_PRICE_CENTS = 999999; // €9,999.99
export const MAX_PHOTOS = 8;
// 25 MB upload cap. The server downscales every upload to a 2048px WebP
// (see stripExifMetadata), so this is the request-size / DoS guard, not the
// stored size. Sized to comfortably admit large JPEG/HEIC from high-MP phones
// and Safari's auto-transcoded ProRAW→JPEG, while still rejecting raw 50–75 MB
// ProRAW DNGs (which are also unsupported by format).
export const MAX_PHOTO_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
