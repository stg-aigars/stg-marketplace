import { describe, it, expect } from 'vitest';
import { validateListingFields, type ListingFieldsToValidate } from './validation';
import { MAX_TEXT_FIELD_LENGTH, MAX_LANGUAGE_FIELD_LENGTH } from './types';

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
});
