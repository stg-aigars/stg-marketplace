import type { ListingCondition } from '@/lib/listings/types';

/** Data stored in localStorage per cart item */
export interface CartItem {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  priceCents: number;
  sellerCountry: string;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string | null;
  condition: ListingCondition;
  addedAt: string;
  expansionCount?: number;
  isAuction?: boolean;
  auctionDeadlineAt?: string | null;
}

export const MAX_CART_ITEMS = 10;
export const CART_STORAGE_KEY = 'stg_cart';

/** Row shape from cart_checkout_groups table */
export interface CartCheckoutGroup {
  id: string;
  order_number: string;
  callback_token: string;
  buyer_id: string;
  terminal_id: string;
  terminal_name: string;
  terminal_address: string | null;
  terminal_city: string | null;
  terminal_postal_code: string | null;
  terminal_country: string;
  buyer_phone: string;
  total_amount_cents: number;
  wallet_debit_cents: number;
  wallet_allocation: Record<string, number>; // listingId → debitCents
  listing_ids: string[];
  everypay_payment_reference: string | null;
  status: 'pending' | 'completed' | 'expired';
  /**
   * Stage-2 cutover gate marker (migration 110). Staff test carts set this
   * true so the wrap layer emits C.1/C.2 (+ paired C.9) while real customer
   * carts take the legacy path. Vestigial post-stage-3 cutover; kept for
   * audit + test reproducibility. See `docs/operations/lifecycle-cutover-
   * runbook.md` §1 Gate 9 + §3.
   */
  is_staff_test: boolean;
  created_at: string;
}

export interface UnavailableItem {
  id: string;
  reason: 'reserved' | 'sold' | 'cancelled';
}

/** Seller profile returned by cart validation */
export interface CartSellerProfile {
  name: string;
  avatarUrl: string | null;
  country: string | null;
}

/** A single cross-sell suggestion surfaced under a seller card */
export interface CartSuggestion {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
  expansionCount: number;
}

/** Response from /api/cart/validate */
export interface CartValidationResult {
  available: string[];
  unavailable: UnavailableItem[];
  sellers: Record<string, CartSellerProfile>;
  /** Keyed by sellerId. Sellers with no eligible other listings or beyond the fan-out cap are absent from the map. */
  suggestions: Record<string, CartSuggestion[]>;
}
