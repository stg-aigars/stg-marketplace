import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  getCountryFlag,
  getCountryName,
  getCountry,
  isValidCountryCode,
} from './country-utils';

describe('COUNTRIES', () => {
  it('has exactly 3 entries', () => {
    expect(COUNTRIES).toHaveLength(3);
  });

  it('contains LV, EE, and LT', () => {
    const codes = COUNTRIES.map(c => c.code);
    expect(codes).toContain('LV');
    expect(codes).toContain('EE');
    expect(codes).toContain('LT');
  });
});

describe('getCountryFlag', () => {
  it('returns fi fi-lv for LV', () => {
    expect(getCountryFlag('LV')).toBe('fi fi-lv');
  });

  it('returns fi fi-ee for EE', () => {
    expect(getCountryFlag('EE')).toBe('fi fi-ee');
  });

  it('returns fi fi-lt for LT', () => {
    expect(getCountryFlag('LT')).toBe('fi fi-lt');
  });

  it('returns empty string for null', () => {
    expect(getCountryFlag(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getCountryFlag(undefined)).toBe('');
  });

  it('returns empty string for unknown code', () => {
    expect(getCountryFlag('DE')).toBe('');
  });
});

describe('getCountryName', () => {
  it('returns Latvia for LV', () => {
    expect(getCountryName('LV')).toBe('Latvia');
  });

  it('returns Estonia for EE', () => {
    expect(getCountryName('EE')).toBe('Estonia');
  });

  it('returns Lithuania for LT', () => {
    expect(getCountryName('LT')).toBe('Lithuania');
  });

  it('returns Unknown for invalid code', () => {
    expect(getCountryName('XX')).toBe('Unknown');
  });

  it('returns Unknown for null', () => {
    expect(getCountryName(null)).toBe('Unknown');
  });

  it('returns Unknown for undefined', () => {
    expect(getCountryName(undefined)).toBe('Unknown');
  });
});

describe('getCountry', () => {
  it('returns country object for valid code', () => {
    const country = getCountry('LV');
    expect(country).toBeDefined();
    expect(country?.code).toBe('LV');
    expect(country?.name).toBe('Latvia');
    expect(country?.flagClass).toBe('fi fi-lv');
  });

  it('returns undefined for invalid code', () => {
    expect(getCountry('XX')).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(getCountry(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(getCountry(undefined)).toBeUndefined();
  });
});

describe('isValidCountryCode', () => {
  it('returns true for LV', () => {
    expect(isValidCountryCode('LV')).toBe(true);
  });

  it('returns true for EE', () => {
    expect(isValidCountryCode('EE')).toBe(true);
  });

  it('returns true for LT', () => {
    expect(isValidCountryCode('LT')).toBe(true);
  });

  it('returns false for lowercase', () => {
    expect(isValidCountryCode('lv')).toBe(false);
  });

  it('returns false for unknown code', () => {
    expect(isValidCountryCode('DE')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidCountryCode('')).toBe(false);
  });
});
