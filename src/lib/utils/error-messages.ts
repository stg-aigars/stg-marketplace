/**
 * User-facing error message sanitizer.
 * Maps raw technical error strings to user-friendly messages.
 * Used across order actions, checkout, and future wallet/dispute flows.
 */

const DEFAULT_MESSAGE = 'That didn\'t go through — mind trying again?';

/**
 * Known patterns from order transitions and internal errors.
 * First match wins — order matters.
 */
const ERROR_PATTERNS: [RegExp, string][] = [
  [/cannot transition/i, 'This order has moved on. Refresh to see where it\'s at.'],
  [/only the (seller|buyer)/i, 'That\'s not something you can do on this order.'],
  [/order not found/i, 'We couldn\'t find that order.'],
  [/order status has changed/i, 'Someone else updated this order — refresh to catch up.'],
  [/not authenticated/i, 'Sign in to continue.'],
  [/listing is no longer available/i, 'That listing\'s no longer available.'],
];

/**
 * Sanitize an error message for display to users.
 * Matches against known patterns; returns a safe fallback for anything unknown.
 */
export function sanitizeErrorMessage(raw: string | undefined | null): string {
  if (!raw) return DEFAULT_MESSAGE;

  for (const [pattern, message] of ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }

  return DEFAULT_MESSAGE;
}

/**
 * Whitelist-based sanitizer for API responses.
 * Only passes through messages that are known to be user-facing.
 * Everything else gets replaced with the default message.
 */
const KNOWN_USER_MESSAGES = new Set([
  'This listing is no longer available',
  'You cannot buy your own listing',
  'Add your country to your profile first — we need it for shipping.',
  'Shipping is not available for this route',
  'Pick a parcel locker to ship to.',
  'Please enter a valid phone number',
  'Listing not found',
  'Checkout didn\'t start — mind trying again?',
  'Payment couldn\'t start — mind trying again?',
  'Wallet covers the full amount. Use wallet payment instead.',
  'Insufficient wallet balance for full wallet payment',
  'Insufficient wallet balance',
  'Please enter a valid withdrawal amount',
  'Please enter the bank account holder name',
  'Please enter a valid Baltic IBAN (LV, LT, or EE)',
  'Order didn\'t go through — mind trying again?',
  'Withdrawal status has already changed',
  'Verification failed. Please try again.',
  'Verification service unavailable. Please try again.',
]);

export function sanitizeApiError(raw: string | undefined | null): string {
  if (!raw) return DEFAULT_MESSAGE;
  if (KNOWN_USER_MESSAGES.has(raw)) return raw;
  return DEFAULT_MESSAGE;
}
