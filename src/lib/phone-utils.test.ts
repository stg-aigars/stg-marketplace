import { describe, it, expect } from 'vitest';
import {
  isBalticPhoneNumber,
  isValidPhoneNumber,
  detectPhoneCountry,
  composePhoneNumber,
  getPhonePrefix,
  PHONE_COUNTRY_CONFIGS,
} from './phone-utils';

describe('PHONE_COUNTRY_CONFIGS', () => {
  it('has exactly 3 entries', () => {
    expect(PHONE_COUNTRY_CONFIGS).toHaveLength(3);
  });

  it('covers LV, EE, and LT', () => {
    const codes = PHONE_COUNTRY_CONFIGS.map(c => c.code);
    expect(codes).toContain('LV');
    expect(codes).toContain('EE');
    expect(codes).toContain('LT');
  });
});

describe('getPhonePrefix', () => {
  it('returns +371 for LV', () => {
    expect(getPhonePrefix('LV')).toBe('+371');
  });

  it('returns +372 for EE', () => {
    expect(getPhonePrefix('EE')).toBe('+372');
  });

  it('returns +370 for LT', () => {
    expect(getPhonePrefix('LT')).toBe('+370');
  });

  it('returns empty string for OTHER', () => {
    expect(getPhonePrefix('OTHER')).toBe('');
  });
});

describe('detectPhoneCountry', () => {
  it('detects Latvian number', () => {
    const result = detectPhoneCountry('+37120012345');
    expect(result.country).toBe('LV');
    expect(result.prefix).toBe('+371');
    expect(result.localNumber).toBe('20012345');
  });

  it('detects Estonian number', () => {
    const result = detectPhoneCountry('+3725012345');
    expect(result.country).toBe('EE');
    expect(result.prefix).toBe('+372');
    expect(result.localNumber).toBe('5012345');
  });

  it('detects Lithuanian number', () => {
    const result = detectPhoneCountry('+37061234567');
    expect(result.country).toBe('LT');
    expect(result.prefix).toBe('+370');
    expect(result.localNumber).toBe('61234567');
  });

  it('returns OTHER for non-Baltic number', () => {
    const result = detectPhoneCountry('+4915112345678');
    expect(result.country).toBe('OTHER');
  });

  it('defaults to LV for empty string', () => {
    const result = detectPhoneCountry('');
    expect(result.country).toBe('LV');
    expect(result.localNumber).toBe('');
  });

  it('defaults to LV for string without +', () => {
    const result = detectPhoneCountry('37120012345');
    expect(result.country).toBe('LV');
    expect(result.localNumber).toBe('37120012345');
  });
});

describe('composePhoneNumber', () => {
  it('composes Latvian number', () => {
    expect(composePhoneNumber('LV', '20012345')).toBe('+37120012345');
  });

  it('composes Estonian number', () => {
    expect(composePhoneNumber('EE', '5012345')).toBe('+3725012345');
  });

  it('composes Lithuanian number', () => {
    expect(composePhoneNumber('LT', '61234567')).toBe('+37061234567');
  });

  it('composes with empty local number (just prefix)', () => {
    expect(composePhoneNumber('LV', '')).toBe('+371');
  });

  it('uses custom prefix for OTHER', () => {
    expect(composePhoneNumber('OTHER', '15112345678', '+49')).toBe('+4915112345678');
  });

  it('round-trips with detectPhoneCountry', () => {
    const original = '+37120012345';
    const { country, localNumber } = detectPhoneCountry(original);
    expect(composePhoneNumber(country, localNumber)).toBe(original);
  });
});

describe('isBalticPhoneNumber', () => {
  it('accepts valid Latvian mobile', () => {
    expect(isBalticPhoneNumber('+37120012345')).toBe(true);
  });

  it('accepts valid Estonian mobile', () => {
    expect(isBalticPhoneNumber('+3725012345')).toBe(true);
  });

  it('accepts valid Estonian mobile (8 digits)', () => {
    expect(isBalticPhoneNumber('+37250123456')).toBe(true);
  });

  it('accepts valid Lithuanian mobile', () => {
    expect(isBalticPhoneNumber('+37061234567')).toBe(true);
  });

  it('rejects non-Baltic number', () => {
    expect(isBalticPhoneNumber('+4915112345678')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isBalticPhoneNumber('')).toBe(false);
  });

  it('rejects number without + prefix', () => {
    expect(isBalticPhoneNumber('37120012345')).toBe(false);
  });

  it('rejects too-short Latvian number', () => {
    expect(isBalticPhoneNumber('+3712001234')).toBe(false);
  });

  it('rejects too-long Latvian number', () => {
    expect(isBalticPhoneNumber('+371200123456')).toBe(false);
  });
});

describe('isValidPhoneNumber', () => {
  it('accepts Baltic numbers', () => {
    expect(isValidPhoneNumber('+37120012345')).toBe(true);
    expect(isValidPhoneNumber('+3725012345')).toBe(true);
    expect(isValidPhoneNumber('+37061234567')).toBe(true);
  });

  it('accepts generic international number', () => {
    expect(isValidPhoneNumber('+4915112345678')).toBe(true);
  });

  it('rejects number without + prefix', () => {
    expect(isValidPhoneNumber('37120012345')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPhoneNumber('')).toBe(false);
  });

  it('rejects too-short number', () => {
    expect(isValidPhoneNumber('+12345')).toBe(false);
  });
});
