import { formatCentsToCurrency } from '@/lib/services/pricing';
import {
  LISTING_CONDITIONS,
  MIN_PRICE_CENTS,
  MAX_PRICE_CENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
  MAX_LANGUAGE_FIELD_LENGTH,
  MAX_COMPONENT_UPGRADES,
  MAX_UPGRADE_NAME_LENGTH,
  conditionRequiresPhotos,
  conditionRequiresDescription,
  type ListingCondition,
  type ComponentUpgrade,
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
  component_upgrades?: ComponentUpgrade[] | null;
}

/**
 * Normalize a raw component-upgrades payload into a clean array: trims names,
 * drops empty entries, coerces the BGG id to number|null, and dedupes (by
 * bgg_accessory_id for BGG-picked items, case-insensitive name for free-text).
 * Does NOT cap the count — validateListingFields rejects over-long lists so the
 * seller gets feedback rather than silent truncation. Defensive against arbitrary
 * input shapes since it runs on server-action payloads.
 */
export function sanitizeComponentUpgrades(input: unknown): ComponentUpgrade[] {
  if (!Array.isArray(input)) return [];

  const seenIds = new Set<number>();
  const seenNames = new Set<string>();
  const result: ComponentUpgrade[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const rawName = (entry as { name?: unknown }).name;
    if (typeof rawName !== 'string') continue;
    const name = rawName.trim();
    if (!name) continue;

    const rawId = (entry as { bgg_accessory_id?: unknown }).bgg_accessory_id;
    const bgg_accessory_id =
      typeof rawId === 'number' && Number.isInteger(rawId) && rawId > 0 ? rawId : null;

    if (bgg_accessory_id !== null) {
      if (seenIds.has(bgg_accessory_id)) continue;
      seenIds.add(bgg_accessory_id);
    } else {
      const key = name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
    }

    result.push({ bgg_accessory_id, name });
  }

  return result;
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

  if (data.component_upgrades && data.component_upgrades.length > 0) {
    if (data.component_upgrades.length > MAX_COMPONENT_UPGRADES) {
      return `You can list up to ${MAX_COMPONENT_UPGRADES} component upgrades`;
    }
    for (const upgrade of data.component_upgrades) {
      const name = upgrade.name?.trim() ?? '';
      if (!name) {
        return 'Component upgrade names cannot be empty';
      }
      if (name.length > MAX_UPGRADE_NAME_LENGTH) {
        return `Component upgrade names must be ${MAX_UPGRADE_NAME_LENGTH} characters or fewer`;
      }
    }
  }

  return null;
}
