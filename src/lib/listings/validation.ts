import { formatCentsToCurrency } from '@/lib/services/pricing';
import {
  LISTING_CONDITIONS,
  MIN_PRICE_CENTS,
  MAX_PRICE_CENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
  MAX_LANGUAGE_FIELD_LENGTH,
  conditionRequiresPhotos,
  conditionRequiresDescription,
  type ListingCondition,
} from './types';

export interface ListingFieldsToValidate {
  condition: ListingCondition;
  price_cents: number;
  photos: string[];
  description: string | null;
  publisher: string | null;
  language: string | null;
  version_name: string | null;
  bgg_version_id: number | null;
}

/** Shared validation for listing fields common to create and update. */
export function validateListingFields(
  data: ListingFieldsToValidate,
  photoUrlPrefix: string
): string | null {
  if (!LISTING_CONDITIONS.includes(data.condition)) {
    return 'Invalid condition selected';
  }

  if (
    !data.price_cents ||
    !Number.isFinite(data.price_cents) ||
    !Number.isInteger(data.price_cents) ||
    data.price_cents < MIN_PRICE_CENTS ||
    data.price_cents > MAX_PRICE_CENTS
  ) {
    return `Price must be between ${formatCentsToCurrency(MIN_PRICE_CENTS)} and ${formatCentsToCurrency(MAX_PRICE_CENTS)}`;
  }

  if (!data.photos) {
    data.photos = [];
  }

  for (const photo of data.photos) {
    if (!photo.startsWith(photoUrlPrefix)) {
      return 'Invalid photo URL detected';
    }
  }

  if (conditionRequiresPhotos(data.condition) && data.photos.length === 0) {
    return 'At least one photo is required for this condition';
  }

  if (conditionRequiresDescription(data.condition) && (!data.description || !data.description.trim())) {
    return 'A description is required for this condition';
  }

  if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`;
  }

  if (data.publisher && data.publisher.length > MAX_TEXT_FIELD_LENGTH) {
    return `Publisher must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`;
  }

  // Language carries multilingual editions (comma-joined list) — it has its own,
  // larger cap than the single-value text fields above.
  if (data.language && data.language.length > MAX_LANGUAGE_FIELD_LENGTH) {
    return `Language must be ${MAX_LANGUAGE_FIELD_LENGTH} characters or fewer`;
  }

  if (data.version_name && data.version_name.length > MAX_TEXT_FIELD_LENGTH) {
    return `Version name must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`;
  }

  if (data.bgg_version_id != null && (!Number.isInteger(data.bgg_version_id) || data.bgg_version_id <= 0)) {
    return 'Invalid BGG version selected';
  }

  return null;
}
