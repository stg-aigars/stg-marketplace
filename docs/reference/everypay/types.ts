/**
 * EveryPay API v4 Types
 *
 * Based on the official EveryPay APIv4 integration documentation.
 * API reference: https://support.every-pay.com/api-documentation/
 */

// ---------------------------------------------------------------------------
// Payment States
// ---------------------------------------------------------------------------

/** All possible payment states returned by EveryPay */
export type EveryPayPaymentState =
  | 'initial'
  | 'authorised'
  | 'settled'
  | 'failed'
  | 'sent_for_processing'
  | 'waiting_for_3ds_response'
  | 'waiting_for_sca'
  | 'confirmed_3ds'
  | 'abandoned'
  | 'voided'
  | 'refunded'
  | 'chargebacked';

/** States that indicate a successful payment (funds secured) */
export const SUCCESSFUL_STATES: ReadonlySet<EveryPayPaymentState> = new Set([
  'authorised',
  'settled',
]);

/** States that indicate a failed/abandoned payment */
export const FAILED_STATES: ReadonlySet<EveryPayPaymentState> = new Set([
  'failed',
  'abandoned',
  'voided',
]);

/** States that indicate payment is still in progress */
export const PENDING_STATES: ReadonlySet<EveryPayPaymentState> = new Set([
  'initial',
  'sent_for_processing',
  'waiting_for_3ds_response',
  'waiting_for_sca',
  'confirmed_3ds',
]);

// ---------------------------------------------------------------------------
// One-off Payment Request
// ---------------------------------------------------------------------------

export interface CreatePaymentRequest {
  /** Processing account name (determines available methods and currency) */
  account_name: string;
  /** Amount as a string with two decimal places, e.g. "12.50" */
  amount: string;
  /** Merchant's unique order reference (our order_id or basket_id) */
  order_reference: string;
  /** URL to redirect the customer to after payment */
  customer_url: string;
  /** API username of the merchant sending the request */
  api_username: string;
  /** Unique nonce to prevent replay attacks */
  nonce: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Locale for the payment page (en, lv, lt, et) */
  locale?: string;
  /** Customer email (for fraud detection) */
  email?: string;
  /** Customer IP address (for fraud detection) */
  customer_ip?: string;
  /** Enable mobile wallet methods (Apple Pay, Google Pay) on hosted page */
  mobile_payment?: boolean;
}

// ---------------------------------------------------------------------------
// Payment Response (from POST /payments/oneoff and GET /payments/{ref})
// ---------------------------------------------------------------------------

export interface EveryPayPaymentResponse {
  /** EveryPay's reference to this payment (e.g. "fd0de14c07...") */
  payment_reference: string;
  /** Merchant's order reference (what we sent as order_reference) */
  order_reference: string;
  /** Current payment state */
  payment_state: EveryPayPaymentState;
  /** URL to redirect the customer for payment completion */
  payment_link?: string;
  /** Amount as string, e.g. "12.50" */
  amount?: string;
  /** Currency code, e.g. "EUR" */
  currency?: string;
  /** Transaction timestamp */
  transaction_time?: string;
  /** Processing account name */
  account_name?: string;
  /** Card details (if card payment) */
  cc_details?: {
    token?: string;
    type?: string;
    last_four_digits?: string;
    month?: number;
    year?: number;
  };
  /** Error details (if any) */
  error?: {
    code: number;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Refund Request
// ---------------------------------------------------------------------------

export interface RefundPaymentRequest {
  /** API username */
  api_username: string;
  /** Amount to refund as string, e.g. "12.50" */
  amount: string;
  /** EveryPay payment reference of the original payment */
  payment_reference: string;
  /** Unique nonce */
  nonce: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Refund Response
// ---------------------------------------------------------------------------

export interface EveryPayRefundResponse {
  /** Payment reference */
  payment_reference: string;
  /** Should be 'refunded' on success */
  payment_state: EveryPayPaymentState;
  /** Original payment amount */
  initial_amount?: string;
  /** Amount remaining after refund */
  standing_amount?: string;
  /** Error details */
  error?: {
    code: number;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Capture Request (for pre-authorised payments)
// ---------------------------------------------------------------------------

export interface CapturePaymentRequest {
  /** API username */
  api_username: string;
  /** Amount to capture as string, e.g. "12.50" (can be ≤ authorised amount) */
  amount: string;
  /** EveryPay payment reference of the authorised payment */
  payment_reference: string;
  /** Unique nonce */
  nonce: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Void Request (cancel a pre-authorised payment without capturing)
// ---------------------------------------------------------------------------

export interface VoidPaymentRequest {
  /** API username */
  api_username: string;
  /** EveryPay payment reference of the authorised payment */
  payment_reference: string;
  /** Unique nonce */
  nonce: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Callback (webhook) payload
// ---------------------------------------------------------------------------

/**
 * EveryPay sends a POST callback to our webhook URL with these query params
 * appended when redirecting the customer back, and also as a server-to-server
 * callback notification.
 */
export interface EveryPayCallbackParams {
  /** EveryPay payment reference */
  payment_reference: string;
  /** Our order reference */
  order_reference: string;
}

// ---------------------------------------------------------------------------
// Payment Methods (from GET /processing_accounts/:account_name)
// ---------------------------------------------------------------------------

/** A single payment method returned by EveryPay */
export interface EveryPayPaymentMethod {
  /** Method identifier, e.g. "card", "ob_swedbank_lv", "ob_seb_lt" */
  source: string;
  /** Human-readable name, e.g. "Swedbank" */
  display_name: string;
  /** Country code, e.g. "LV", "LT", "EE". Null for card methods. */
  country_code: string | null;
  /** URL to the method's logo image */
  logo_url: string;
}

/** Response from GET /processing_accounts/:account_name */
export interface EveryPayProcessingAccountResponse {
  account_name: string;
  payment_methods: EveryPayPaymentMethod[];
}
