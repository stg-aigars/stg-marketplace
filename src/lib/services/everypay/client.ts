/**
 * EveryPay API v4 Client
 *
 * Thin HTTP wrapper for the EveryPay payment gateway.
 * Uses HTTP Basic Auth with api_username:api_secret.
 *
 * Endpoints:
 *   POST /payments/oneoff  — Create a one-off payment (returns payment_link for redirect)
 *   GET  /payments/{ref}    — Check payment status
 *   POST /payments/refund   — Refund a payment (full or partial)
 *
 * @see https://support.every-pay.com/api-documentation/
 */

import { env } from '@/lib/env';
import type {
  CapturePaymentRequest,
  CreatePaymentRequest,
  EveryPayPaymentMethod,
  EveryPayPaymentResponse,
  EveryPayProcessingAccountResponse,
  EveryPayRefundResponse,
  RefundPaymentRequest,
  VoidPaymentRequest,
} from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface EveryPayConfig {
  apiUrl: string;
  apiUsername: string;
  apiSecret: string;
  accountName: string;
}

function getConfig(): EveryPayConfig {
  const { apiUrl, apiUsername, apiSecret, accountName } = env.everypay;

  if (!apiUrl || !apiUsername || !apiSecret || !accountName) {
    throw new Error(
      'Missing EveryPay environment variables. Required: EVERYPAY_API_URL, EVERYPAY_API_USERNAME, EVERYPAY_API_SECRET, EVERYPAY_ACCOUNT_NAME'
    );
  }

  return { apiUrl, apiUsername, apiSecret, accountName };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function authHeader(username: string, secret: string): string {
  return 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64');
}

function nonce(): string {
  return crypto.randomUUID();
}

function timestamp(): string {
  return new Date().toISOString();
}

export class EveryPayError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'EveryPayError';
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  url: string,
  config: EveryPayConfig,
  body?: object
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: authHeader(config.apiUsername, config.apiSecret),
  };

  const init: RequestInit = { method, headers };

  if (body) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (fetchErr) {
    // Node.js native fetch wraps the real error in .cause
    const cause = fetchErr instanceof Error && 'cause' in fetchErr
      ? (fetchErr.cause as Error)?.message || String(fetchErr.cause)
      : 'unknown';
    throw new EveryPayError(
      `EveryPay API unreachable (${method} ${url.replace(/\?.*$/, '')}): ${cause}`
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new EveryPayError(
      `EveryPay API returned non-JSON response (${res.status})`,
      res.status
    );
  }

  if (data?.error) {
    throw new EveryPayError(
      data.error.message || 'EveryPay API error',
      data.error.code,
      data
    );
  }

  if (!res.ok) {
    throw new EveryPayError(
      `EveryPay API returned ${res.status}`,
      res.status,
      data
    );
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a one-off payment session.
 * Returns a payment_link URL to redirect the buyer to.
 *
 * @param amountCents  Total to charge in cents (e.g. 1250 = €12.50)
 * @param orderReference  Unique reference for this payment (e.g. basket ID or order ID)
 * @param customerUrl  URL to redirect buyer to after payment
 * @param options  Optional: locale, email, customerIp
 */
export async function createPayment(
  amountCents: number,
  orderReference: string,
  customerUrl: string,
  options?: { locale?: string; email?: string; customerIp?: string }
): Promise<EveryPayPaymentResponse> {
  const config = getConfig();

  const body: CreatePaymentRequest = {
    api_username: config.apiUsername,
    account_name: config.accountName,
    amount: (amountCents / 100).toFixed(2),
    order_reference: orderReference,
    customer_url: customerUrl,
    nonce: nonce(),
    timestamp: timestamp(),
    ...(options?.locale && { locale: options.locale }),
    ...(options?.email && { email: options.email }),
    ...(options?.customerIp && { customer_ip: options.customerIp }),
    mobile_payment: true,
  };

  const response = await request<EveryPayPaymentResponse>(
    'POST',
    `${config.apiUrl}/payments/oneoff`,
    config,
    body
  );

  if (response.payment_state !== 'initial') {
    throw new EveryPayError(
      `Unexpected payment state after creation: ${response.payment_state}`,
      undefined,
      response
    );
  }

  return response;
}

/**
 * Get the current status of a payment.
 *
 * @param paymentReference  The payment_reference returned by createPayment
 */
export async function getPaymentStatus(
  paymentReference: string
): Promise<EveryPayPaymentResponse> {
  const config = getConfig();

  return request<EveryPayPaymentResponse>(
    'GET',
    `${config.apiUrl}/payments/${encodeURIComponent(paymentReference)}?api_username=${encodeURIComponent(config.apiUsername)}`,
    config
  );
}

/**
 * Refund a payment (full or partial).
 *
 * @param paymentReference  The payment_reference of the original payment
 * @param amountCents  Amount to refund in cents
 */
export async function refundPayment(
  paymentReference: string,
  amountCents: number
): Promise<EveryPayRefundResponse> {
  // Staging-only test hook: allows forcing a refund failure to exercise the
  // "EveryPay rejected the refund" branch in dispute resolution and cron flows
  // without having to corrupt real payment references. Set STG_FORCE_REFUND_FAILURE
  // to a payment reference (or "*" for any) to make this call throw. Guarded to
  // non-production so it can't accidentally brick a live refund.
  if (process.env.NODE_ENV !== 'production' && process.env.STG_FORCE_REFUND_FAILURE) {
    const match = process.env.STG_FORCE_REFUND_FAILURE;
    if (match === '*' || match === paymentReference) {
      throw new EveryPayError(
        `[STG_FORCE_REFUND_FAILURE] Simulated refund failure for ${paymentReference}`
      );
    }
  }

  const config = getConfig();

  const body: RefundPaymentRequest = {
    api_username: config.apiUsername,
    payment_reference: paymentReference,
    amount: (amountCents / 100).toFixed(2),
    nonce: nonce(),
    timestamp: timestamp(),
  };

  return request<EveryPayRefundResponse>(
    'POST',
    `${config.apiUrl}/payments/refund`,
    config,
    body
  );
}

/**
 * Capture a pre-authorised payment (full or partial).
 * Must be called within the capture window (typically 7 days).
 */
export async function capturePayment(
  paymentReference: string,
  amountCents: number
): Promise<EveryPayPaymentResponse> {
  const config = getConfig();

  const body: CapturePaymentRequest = {
    api_username: config.apiUsername,
    payment_reference: paymentReference,
    amount: (amountCents / 100).toFixed(2),
    nonce: nonce(),
    timestamp: timestamp(),
  };

  return request<EveryPayPaymentResponse>(
    'POST',
    `${config.apiUrl}/payments/capture`,
    config,
    body
  );
}

/**
 * Void a pre-authorised payment (cancel without capturing).
 * Releases the hold on the customer's funds immediately.
 */
export async function voidPayment(
  paymentReference: string
): Promise<EveryPayPaymentResponse> {
  const config = getConfig();

  const body: VoidPaymentRequest = {
    api_username: config.apiUsername,
    payment_reference: paymentReference,
    nonce: nonce(),
    timestamp: timestamp(),
  };

  return request<EveryPayPaymentResponse>(
    'POST',
    `${config.apiUrl}/payments/void`,
    config,
    body
  );
}

// ---------------------------------------------------------------------------
// Payment Methods
// ---------------------------------------------------------------------------

let cachedMethods: EveryPayPaymentMethod[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Fetch available payment methods from EveryPay.
 * Results are cached in-memory for 4 hours.
 */
export async function getPaymentMethods(): Promise<EveryPayPaymentMethod[]> {
  if (cachedMethods && Date.now() < cacheExpiry) {
    return cachedMethods;
  }

  const config = getConfig();

  const data = await request<EveryPayProcessingAccountResponse>(
    'GET',
    `${config.apiUrl}/processing_accounts/${encodeURIComponent(config.accountName)}?api_username=${encodeURIComponent(config.apiUsername)}`,
    config
  );

  cachedMethods = data.payment_methods;
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return cachedMethods;
}
