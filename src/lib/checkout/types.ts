/**
 * Checkout session types
 */

export interface CheckoutSession {
  id: string;
  order_number: string;
  listing_id: string;
  buyer_id: string;
  terminal_id: string;
  terminal_name: string;
  terminal_country: string;
  buyer_phone: string;
  amount_cents: number;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
}
