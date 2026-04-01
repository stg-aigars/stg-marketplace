/**
 * Checkout session types
 */

export interface CheckoutSession {
  id: string;
  order_number: string | null;
  callback_token: string | null;
  listing_id: string;
  buyer_id: string;
  terminal_id: string;
  terminal_name: string;
  terminal_address: string | null;
  terminal_city: string | null;
  terminal_postal_code: string | null;
  terminal_country: string;
  buyer_phone: string;
  amount_cents: number;
  wallet_debit_cents: number;
  everypay_payment_reference: string | null;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
}
