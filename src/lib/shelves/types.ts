// ============================================================================
// Shelf Items
// ============================================================================

export type ShelfVisibility = 'not_for_sale' | 'open_to_offers' | 'listed';

export const SHELF_VISIBILITIES: ShelfVisibility[] = [
  'not_for_sale',
  'open_to_offers',
  'listed',
];

export const SHELF_VISIBILITY_LABELS: Record<ShelfVisibility, string> = {
  not_for_sale: 'Not for sale',
  open_to_offers: 'Open to offers',
  listed: 'Listed',
};

export const SHELF_VISIBILITY_BADGE_VARIANT: Record<ShelfVisibility, 'default' | 'success' | 'trust'> = {
  not_for_sale: 'default',
  open_to_offers: 'success',
  listed: 'trust',
};

/** Visibility options for Select dropdowns (excludes 'listed' — set automatically) */
export const SHELF_VISIBILITY_OPTIONS = [
  { value: 'not_for_sale' as const, label: 'Not for sale' },
  { value: 'open_to_offers' as const, label: 'Open to offers' },
];

export interface ShelfItemRow {
  id: string;
  seller_id: string;
  bgg_game_id: number;
  game_name: string;
  game_year: number | null;
  visibility: ShelfVisibility;
  notes: string | null;
  listing_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShelfItemWithGame extends ShelfItemRow {
  thumbnail: string | null;
  image: string | null;
}

export const MAX_NOTE_LENGTH = 500;

// ============================================================================
// Offers
// ============================================================================

export type OfferStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'completed';

export const ACTIVE_OFFER_STATUSES: OfferStatus[] = ['pending', 'countered'];

export interface OfferRow {
  id: string;
  shelf_item_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  counter_amount_cents: number | null;
  note: string | null;
  status: OfferStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface OfferWithDetails extends OfferRow {
  game_name: string;
  game_year: number | null;
  thumbnail: string | null;
  buyer_name: string;
  seller_name: string;
}

export const OFFER_TTL_DAYS = 7;
export const LISTING_DEADLINE_DAYS = 3;
export const MIN_OFFER_CENTS = 50;       // €0.50
export const MAX_OFFER_CENTS = 9999999;  // €99,999.99

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'Pending',
  countered: 'Countered',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const OFFER_STATUS_BADGE_VARIANT: Record<OfferStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  countered: 'warning',
  accepted: 'success',
  declined: 'error',
  expired: 'default',
  cancelled: 'default',
  completed: 'success',
};
