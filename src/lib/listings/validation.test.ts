import { describe, it, expect } from 'vitest';
import {
  validateListingFields,
  sanitizeComponentUpgrades,
  type ListingFieldsToValidate,
} from './validation';
import {
  MAX_TEXT_FIELD_LENGTH,
  MAX_LANGUAGE_FIELD_LENGTH,
  MAX_COMPONENT_UPGRADES,
  MAX_UPGRADE_NAME_LENGTH,
} from './types';

const PHOTO_PREFIX = 'https://cdn.example.com/listings/';

/** A baseline that passes validation: `like_new` needs no photos or description. */
function validFields(overrides: Partial<ListingFieldsToValidate> = {}): ListingFieldsToValidate {
  return {
    condition: 'like_new',
    price_cents: 1299,
    photos: [],
    description: null,
    publisher: null,
    language: null,
    version_name: null,
    bgg_version_id: null,
    ...overrides,
  };
}

describe('validateListingFields', () => {
  it('accepts a minimal valid listing', () => {
    expect(validateListingFields(validFields(), PHOTO_PREFIX)).toBeNull();
  });

  describe('language field length', () => {
    it('accepts a long multilingual list well over the single-value field cap', () => {
      // Mirrors a multilingual BGG edition: many comma-joined languages.
      const language = Array(25).fill('English').join(', '); // ~200 chars, > MAX_TEXT_FIELD_LENGTH
      expect(language.length).toBeGreaterThan(MAX_TEXT_FIELD_LENGTH);
      expect(validateListingFields(validFields({ language }), PHOTO_PREFIX)).toBeNull();
    });

    it('accepts language exactly at the language cap', () => {
      const language = 'x'.repeat(MAX_LANGUAGE_FIELD_LENGTH);
      expect(validateListingFields(validFields({ language }), PHOTO_PREFIX)).toBeNull();
    });

    it('rejects language beyond the language cap', () => {
      const language = 'x'.repeat(MAX_LANGUAGE_FIELD_LENGTH + 1);
      expect(validateListingFields(validFields({ language }), PHOTO_PREFIX)).toBe(
        `Language must be ${MAX_LANGUAGE_FIELD_LENGTH} characters or fewer`
      );
    });
  });

  describe('single-value text fields keep the tighter cap', () => {
    it('rejects publisher beyond the text-field cap', () => {
      const publisher = 'x'.repeat(MAX_TEXT_FIELD_LENGTH + 1);
      expect(validateListingFields(validFields({ publisher }), PHOTO_PREFIX)).toBe(
        `Publisher must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`
      );
    });

    it('rejects version_name beyond the text-field cap', () => {
      const version_name = 'x'.repeat(MAX_TEXT_FIELD_LENGTH + 1);
      expect(validateListingFields(validFields({ version_name }), PHOTO_PREFIX)).toBe(
        `Version name must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`
      );
    });

    it('rejects a publisher at the language cap length (proving the caps are independent)', () => {
      const publisher = 'x'.repeat(MAX_LANGUAGE_FIELD_LENGTH);
      expect(validateListingFields(validFields({ publisher }), PHOTO_PREFIX)).toBe(
        `Publisher must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`
      );
    });
  });

  describe('component upgrades', () => {
    it('accepts a listing with a reasonable upgrade list', () => {
      const component_upgrades = [
        { bgg_accessory_id: 100, name: 'Metal Coins' },
        { bgg_accessory_id: null, name: 'Sleeved cards' },
      ];
      expect(validateListingFields(validFields({ component_upgrades }), PHOTO_PREFIX)).toBeNull();
    });

    it('rejects more than the maximum number of upgrades', () => {
      const component_upgrades = Array.from({ length: MAX_COMPONENT_UPGRADES + 1 }, (_, i) => ({
        bgg_accessory_id: i + 1,
        name: `Upgrade ${i}`,
      }));
      expect(validateListingFields(validFields({ component_upgrades }), PHOTO_PREFIX)).toBe(
        `You can list up to ${MAX_COMPONENT_UPGRADES} component upgrades`
      );
    });

    it('rejects an empty upgrade name', () => {
      const component_upgrades = [{ bgg_accessory_id: null, name: '   ' }];
      expect(validateListingFields(validFields({ component_upgrades }), PHOTO_PREFIX)).toBe(
        'Component upgrade names cannot be empty'
      );
    });

    it('rejects an upgrade name over the length cap', () => {
      const component_upgrades = [{ bgg_accessory_id: null, name: 'x'.repeat(MAX_UPGRADE_NAME_LENGTH + 1) }];
      expect(validateListingFields(validFields({ component_upgrades }), PHOTO_PREFIX)).toBe(
        `Component upgrade names must be ${MAX_UPGRADE_NAME_LENGTH} characters or fewer`
      );
    });
  });
});

describe('sanitizeComponentUpgrades', () => {
  it('returns an empty array for non-array input', () => {
    expect(sanitizeComponentUpgrades(null)).toEqual([]);
    expect(sanitizeComponentUpgrades(undefined)).toEqual([]);
    expect(sanitizeComponentUpgrades('nope')).toEqual([]);
  });

  it('trims names and drops empty entries', () => {
    const result = sanitizeComponentUpgrades([
      { bgg_accessory_id: 1, name: '  Metal Coins  ' },
      { bgg_accessory_id: null, name: '   ' },
      { bgg_accessory_id: null, name: 'Insert' },
    ]);
    expect(result).toEqual([
      { bgg_accessory_id: 1, name: 'Metal Coins' },
      { bgg_accessory_id: null, name: 'Insert' },
    ]);
  });

  it('coerces invalid bgg ids to null', () => {
    const result = sanitizeComponentUpgrades([
      { bgg_accessory_id: 0, name: 'Zero' },
      { bgg_accessory_id: -5, name: 'Negative' },
      { bgg_accessory_id: 1.5, name: 'Float' },
    ]);
    expect(result.every((u) => u.bgg_accessory_id === null)).toBe(true);
  });

  it('dedupes by bgg id and by case-insensitive name', () => {
    const result = sanitizeComponentUpgrades([
      { bgg_accessory_id: 1, name: 'Metal Coins' },
      { bgg_accessory_id: 1, name: 'Metal Coins (dup id)' },
      { bgg_accessory_id: null, name: 'Insert' },
      { bgg_accessory_id: null, name: 'INSERT' },
    ]);
    expect(result).toEqual([
      { bgg_accessory_id: 1, name: 'Metal Coins' },
      { bgg_accessory_id: null, name: 'Insert' },
    ]);
  });

  it('dedupes a BGG-picked item against a same-name free-text item (cross-source)', () => {
    const result = sanitizeComponentUpgrades([
      { bgg_accessory_id: 5, name: 'Metal Coins' },
      { bgg_accessory_id: null, name: 'metal coins' },
    ]);
    expect(result).toEqual([{ bgg_accessory_id: 5, name: 'Metal Coins' }]);
  });

  it('skips malformed entries', () => {
    const result = sanitizeComponentUpgrades([null, 42, { name: 123 }, { bgg_accessory_id: 1, name: 'Good' }]);
    expect(result).toEqual([{ bgg_accessory_id: 1, name: 'Good' }]);
  });
});
