/** Data stored in localStorage per cart item */
export interface CartItem {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  priceCents: number;
  sellerCountry: string;
  sellerId: string;
  condition: string;
  addedAt: string;
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
  terminal_country: string;
  buyer_phone: string;
  total_amount_cents: number;
  wallet_debit_cents: number;
  wallet_allocation: Record<string, number>; // listingId → debitCents
  listing_ids: string[];
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
}

/** Response from /api/cart/validate */
export interface CartValidationResult {
  available: string[];
  unavailable: string[];
}
