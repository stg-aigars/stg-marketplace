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

/** 1:1 mapping to the order_items table row */
export interface OrderItemRow {
  id: string;
  order_id: string;
  listing_id: string;
  price_cents: number;
  active: boolean;
  created_at: string;
}

/** Order item joined with listing data for display */
export interface OrderItemWithDetails extends OrderItemRow {
  listings: {
    game_name: string;
    game_year: number | null;
    condition: string;
    photos: string[];
    games: { thumbnail: string | null } | null;
  };
}

/** 1:1 mapping to the orders table row */
export interface OrderRow {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  status: OrderStatus;
  total_amount_cents: number;
  items_total_cents: number;
  shipping_cost_cents: number;
  seller_country: string;
  terminal_id: string | null;
  terminal_name: string | null;
  terminal_address: string | null;
  terminal_city: string | null;
  terminal_postal_code: string | null;
  terminal_country: string | null;
  everypay_payment_reference: string | null;
  everypay_payment_state: string | null;
  payment_method: PaymentMethod | null;
  platform_commission_cents: number | null;
  buyer_wallet_debit_cents: number;
  seller_wallet_credit_cents: number | null;
  wallet_credited_at: string | null;
  commission_net_cents: number | null;
  commission_vat_cents: number | null;
  shipping_net_cents: number | null;
  shipping_vat_cents: number | null;
  refund_status: string | null;
  refund_amount_cents: number | null;
  unisend_parcel_id: number | null;
  barcode: string | null;
  tracking_url: string | null;
  shipping_method: string | null;
  shipping_error: string | null;
  buyer_phone: string | null;
  seller_phone: string | null;
  accepted_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  disputed_at: string | null;
  refunded_at: string | null;
  cart_group_id: string | null;
  item_count: number;
  cancellation_reason: string | null;
  deadline_reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Order joined with listing + buyer/seller profile data for display */
export interface OrderWithDetails extends OrderRow {
  order_items: OrderItemWithDetails[];
  /** @deprecated Legacy join — use order_items instead. Null for new multi-item orders. */
  listings: {
    game_name: string;
    game_year: number | null;
    condition: string;
    photos: string[];
    games: { thumbnail: string | null } | null;
  } | null;
  buyer_profile: { full_name: string | null; country: string; phone: string | null; email: string | null } | null;
  seller_profile: { full_name: string | null; country: string; phone: string | null; email: string | null } | null;
  dispute?: DisputeRow | null;
}

/** Order loaded with joined listing + profile data for transition logic */
export interface OrderWithRelations extends OrderRow {
  order_items: Array<{ listing_id: string; price_cents: number; listings: { game_name: string; seller_id: string } | null }>;
  /** @deprecated Legacy join — use order_items instead. Null for new multi-item orders. */
  listings: { game_name: string; seller_id: string } | null;
  buyer_profile: { full_name: string | null; email: string | null; phone: string | null; country: string } | null;
  seller_profile: { full_name: string | null; email: string | null; phone: string | null; country: string } | null;
}

/** Dispute resolution outcome */
export type DisputeResolution = 'refunded' | 'resolved_no_refund';

/** 1:1 mapping to the disputes table row */
export interface DisputeRow {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  reason: string;
  photos: string[];
  escalated_at: string | null;
  escalated_by: string | null;
  resolution: DisputeResolution | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  refund_amount_cents: number | null;
  created_at: string;
  updated_at: string;
}

/** Input params for creating an order after payment is confirmed */
export interface CreateOrderParams {
  buyerId: string;
  sellerId: string;
  /** Items in this order (one or more listings from the same seller) */
  items: Array<{ listingId: string; priceCents: number }>;
  shippingCostCents: number;
  sellerCountry: string;
  paymentReference?: string;
  paymentState?: string;
  paymentMethod: PaymentMethod;
  walletDebitCents?: number;
  terminalId: string;
  terminalName: string;
  terminalAddress?: string;
  terminalCity?: string;
  terminalPostalCode?: string;
  terminalCountry: string;
  buyerPhone: string;
  orderNumber?: string;
  cartGroupId?: string;
}
