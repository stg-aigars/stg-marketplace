import { describe, it, expect } from 'vitest';
import { isValidBalticTIN, cleanTIN, isValidIBAN, cleanIBAN } from './validation';

describe('isValidBalticTIN', () => {
  it('accepts valid Latvian personal codes (11 digits)', () => {
    expect(isValidBalticTIN('01019012345', 'LV')).toBe(true);
    expect(isValidBalticTIN('32109012345', 'LV')).toBe(true); // new format
  });

  it('accepts Latvian codes with dashes/spaces', () => {
    expect(isValidBalticTIN('010190-12345', 'LV')).toBe(true);
    expect(isValidBalticTIN('010190 12345', 'LV')).toBe(true);
  });

  it('rejects Latvian codes with wrong length', () => {
    expect(isValidBalticTIN('1234567890', 'LV')).toBe(false);  // 10 digits
    expect(isValidBalticTIN('123456789012', 'LV')).toBe(false); // 12 digits
  });

  it('rejects Latvian codes with letters', () => {
    expect(isValidBalticTIN('0101901234A', 'LV')).toBe(false);
  });

  it('accepts valid Lithuanian personal codes', () => {
    expect(isValidBalticTIN('39001010000', 'LT')).toBe(true);
  });

  it('accepts valid Estonian personal codes', () => {
    expect(isValidBalticTIN('37605030299', 'EE')).toBe(true);
  });

  it('uses generic fallback for other EU countries', () => {
    expect(isValidBalticTIN('12345', 'DE')).toBe(true);       // 5 chars min
    expect(isValidBalticTIN('12345678901234567890', 'DE')).toBe(true); // 20 chars max
    expect(isValidBalticTIN('1234', 'DE')).toBe(false);        // too short
    expect(isValidBalticTIN('123456789012345678901', 'DE')).toBe(false); // too long
  });
});

describe('cleanTIN', () => {
  it('strips dashes and spaces', () => {
    expect(cleanTIN('010190-12345')).toBe('01019012345');
    expect(cleanTIN('010190 12345')).toBe('01019012345');
    expect(cleanTIN('010190 - 12345')).toBe('01019012345');
  });
});

describe('isValidIBAN', () => {
  it('accepts valid Baltic IBANs', () => {
    expect(isValidIBAN('LV80BANK0000435195001')).toBe(true);
    expect(isValidIBAN('LT121000011101001000')).toBe(true);
    expect(isValidIBAN('EE382200221020145685')).toBe(true);
  });

  it('accepts IBANs with spaces', () => {
    expect(isValidIBAN('LV80 BANK 0000 4351 9500 1')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isValidIBAN('lv80bank0000435195001')).toBe(true);
  });

  it('rejects IBANs that are too short', () => {
    expect(isValidIBAN('LV80BA')).toBe(false); // only 6 chars BBAN
  });

  it('rejects IBANs missing country code', () => {
    expect(isValidIBAN('80BANK0000435195001')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidIBAN('')).toBe(false);
  });
});

describe('cleanIBAN', () => {
  it('strips spaces and uppercases', () => {
    expect(cleanIBAN('lv80 bank 0000 4351 9500 1')).toBe('LV80BANK0000435195001');
  });
});
