/**
 * Format Unisend shipping errors into user-friendly messages.
 * Extracts field-level validation details from UnisendValidationError,
 * or falls back to the raw error message.
 */

import { UnisendValidationError, getUserFriendlyFieldName } from './types';

export function formatShippingError(error: unknown): string {
  if (error instanceof UnisendValidationError) {
    const fieldErrors = error.validationErrors.map((e) => {
      const fieldName = getUserFriendlyFieldName(e.field);
      return `${fieldName}: ${e.error_description || e.error}`;
    });
    return fieldErrors.length > 0
      ? `Validation failed: ${fieldErrors.join('; ')}`
      : 'Validation failed - please check all shipping details';
  }
  return error instanceof Error ? error.message : 'Unknown error creating shipping parcel';
}
