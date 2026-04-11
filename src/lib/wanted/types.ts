import type { CountryCode } from '@/lib/country-utils';
import type { VersionSource } from '@/lib/listings/types';

// ============================================================================
// Wanted Listings
// ============================================================================

export type WantedListingStatus = 'active' | 'cancelled';

export interface WantedListingRow {
  id: string;
  buyer_id: string;
  bgg_game_id: number;
  game_name: string;
  game_year: number | null;
  // Edition preference (all nullable — null means "any edition")
  version_source: VersionSource | null;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
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

export interface WantedListingGameMetadata {
  game_display_name: string | null;
  game_year_published: number | null;
  player_count: string | null;
  min_players: number | null;
  max_players: number | null;
  min_age: number | null;
  playing_time: string | null;
  description: string | null;
  weight: number | null;
  categories: string[] | null;
  mechanics: string[] | null;
}

export interface WantedListingWithDetails extends WantedListingWithGame, WantedListingGameMetadata {
  buyer_name: string;
}

export const MAX_NOTE_LENGTH = 500;

export const WANTED_LISTING_STATUS_LABELS: Record<WantedListingStatus, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
};

export const WANTED_LISTING_STATUS_BADGE_VARIANT: Record<WantedListingStatus, 'success' | 'error'> = {
  active: 'success',
  cancelled: 'error',
};
