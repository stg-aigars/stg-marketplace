/**
 * EveryPay payment error classification.
 *
 * Classifies EveryPay payment failures into user-facing categories
 * without revealing fraud detection details.
 */

export type PaymentErrorCategory =
  | 'fraud_declined'
  | 'card_declined'
  | 'auth_failed'
  | 'technical_error'
  | 'user_cancelled'
  | 'payment_failed';

/** Error codes known to indicate 3DS/SCA failure */
const AUTH_FAILURE_CODES = new Set([4018]);

/** Error codes known to indicate technical/network issues */
const TECHNICAL_ERROR_CODES = new Set([3045]);

/** Error codes that indicate issuer-side decline */
const ISSUER_DECLINE_CODES = new Set([3057]);

/**
 * Classify an EveryPay payment failure into a user-facing category.
 *
 * Security: The "fraud_declined" category is only set when EveryPay
 * explicitly includes "fraud" in the error message. User-facing text
 * for this category must NOT reveal fraud detection details.
 */
export function classifyPaymentError(
  paymentState: string,
  error?: { code: number; message: string } | null
): PaymentErrorCategory {
  if (paymentState === 'abandoned') {
    return 'user_cancelled';
  }

  if (paymentState === 'voided') {
    return 'payment_failed';
  }

  if (!error) {
    return 'payment_failed';
  }

  const msg = error.message.toLowerCase();

  // Explicit fraud check block from EveryPay fraud rules engine
  if (msg.includes('fraud')) {
    return 'fraud_declined';
  }

  // 3DS / SCA authentication failures
  if (
    AUTH_FAILURE_CODES.has(error.code) ||
    msg.includes('3d secure') ||
    msg.includes('3ds')
  ) {
    return 'auth_failed';
  }

  // Network/timeout issues with card issuer or EveryPay
  if (
    TECHNICAL_ERROR_CODES.has(error.code) ||
    msg.includes('timed out') ||
    msg.includes('not available')
  ) {
    return 'technical_error';
  }

  // Issuer declined
  if (
    ISSUER_DECLINE_CODES.has(error.code) ||
    msg.includes('declined') ||
    msg.includes('insufficient') ||
    msg.includes('do not honour') ||
    msg.includes('do not honor')
  ) {
    return 'card_declined';
  }

  return 'payment_failed';
}
