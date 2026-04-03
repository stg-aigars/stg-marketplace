import type { ListingCondition } from '@/lib/listings/types';

/** Data stored in localStorage per cart item */
export interface CartItem {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  priceCents: number;
  sellerCountry: string;
  sellerId: string;
  condition: ListingCondition;
  addedAt: string;
  expansionCount?: number;
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
  created_at: string;
}

/** Response from /api/cart/validate */
export interface CartValidationResult {
  available: string[];
  unavailable: string[];
}
