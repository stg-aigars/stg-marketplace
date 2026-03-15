/**
 * Order types
 * Maps to the orders table in supabase/migrations/001_mvp_schema.sql
 */

export type OrderStatus =
  | 'pending_seller'
  | 'accepted'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

export type PaymentMethod = 'card' | 'bank_link' | 'wallet';

/** 1:1 mapping to the orders table row */
export interface OrderRow {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  status: OrderStatus;
  total_amount_cents: number;
  items_total_cents: number;
  shipping_cost_cents: number;
  seller_country: string;
  terminal_id: string | null;
  terminal_name: string | null;
  terminal_country: string | null;
  everypay_payment_reference: string | null;
  everypay_payment_state: string | null;
  payment_method: PaymentMethod | null;
  platform_commission_cents: number | null;
  buyer_wallet_debit_cents: number;
  seller_wallet_credit_cents: number | null;
  wallet_credited_at: string | null;
  refund_status: string | null;
  refund_amount_cents: number | null;
  created_at: string;
  updated_at: string;
}

/** Order joined with listing + buyer/seller profile data for display */
export interface OrderWithDetails extends OrderRow {
  listings: {
    game_name: string;
    game_year: number | null;
    condition: string;
    photos: string[];
    games: { thumbnail: string | null } | null;
  };
  buyer_profile: { full_name: string | null; country: string } | null;
  seller_profile: { full_name: string | null; country: string } | null;
}

/** Input params for creating an order after payment is confirmed */
export interface CreateOrderParams {
  buyerId: string;
  sellerId: string;
  listingId: string;
  itemsTotalCents: number;
  shippingCostCents: number;
  sellerCountry: string;
  paymentReference: string;
  paymentState: string;
  paymentMethod: PaymentMethod;
}
