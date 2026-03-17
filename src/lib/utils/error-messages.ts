/**
 * User-facing error message sanitizer.
 * Maps raw technical error strings to user-friendly messages.
 * Used across order actions, checkout, and future wallet/dispute flows.
 */

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Known patterns from order transitions and internal errors.
 * First match wins — order matters.
 */
const ERROR_PATTERNS: [RegExp, string][] = [
  [/cannot transition/i, 'This action is no longer available. The order may have been updated.'],
  [/only the (seller|buyer)/i, 'You don\'t have permission for this action.'],
  [/order not found/i, 'This order could not be found.'],
  [/order status has changed/i, 'This order was updated by someone else. Please refresh the page.'],
  [/not authenticated/i, 'Please sign in to continue.'],
  [/listing is no longer available/i, 'This listing is no longer available.'],
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
  'Please set your country in your profile first',
  'Shipping is not available for this route',
  'Please select a pickup terminal',
  'Please enter a valid phone number',
  'Listing not found',
  'Failed to start checkout. Please try again.',
  'Failed to initiate payment. Please try again.',
]);

export function sanitizeApiError(raw: string | undefined | null): string {
  if (!raw) return DEFAULT_MESSAGE;
  if (KNOWN_USER_MESSAGES.has(raw)) return raw;
  return DEFAULT_MESSAGE;
}
