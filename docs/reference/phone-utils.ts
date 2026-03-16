/**
 * Phone number utilities for marketplace
 * Extends country-utils with phone-specific prefix detection, composition, and validation
 */

import { type CountryCode } from '@/lib/country-utils';
import { PHONE_FORMATS, type TerminalCountry } from '@/lib/unisend/types';

/** Extended country code for phone input — includes 'OTHER' for non-Baltic numbers */
export type PhoneCountryCode = CountryCode | 'OTHER';

/** Phone prefix and local number config per Baltic country */
export interface PhoneCountryConfig {
  code: CountryCode;
  prefix: string;
  localPlaceholder: string;
}

export const PHONE_COUNTRY_CONFIGS: PhoneCountryConfig[] = [
  { code: 'LV', prefix: '+371', localPlaceholder: '20012345' },
  { code: 'EE', prefix: '+372', localPlaceholder: '5012345' },
  { code: 'LT', prefix: '+370', localPlaceholder: '60012345' },
];

const BALTIC_PREFIXES: Record<string, CountryCode> = {
  '+371': 'LV',
  '+372': 'EE',
  '+370': 'LT',
};

/**
 * Get phone prefix for a country code.
 * Returns empty string for 'OTHER'.
 */
export function getPhonePrefix(country: PhoneCountryCode): string {
  const config = PHONE_COUNTRY_CONFIGS.find(c => c.code === country);
  return config?.prefix || '';
}

/**
 * Detect phone country from a full international number.
 * Returns the country code, prefix, and local part.
 */
export function detectPhoneCountry(phone: string): {
  country: PhoneCountryCode;
  prefix: string;
  localNumber: string;
} {
  if (!phone || !phone.startsWith('+')) {
    return { country: 'LV', prefix: '+371', localNumber: phone || '' };
  }

  // Check Baltic prefixes (all are 4 chars: +3XX)
  for (const [prefix, country] of Object.entries(BALTIC_PREFIXES)) {
    if (phone.startsWith(prefix)) {
      return { country, prefix, localNumber: phone.slice(prefix.length) };
    }
  }

  // Non-Baltic: try to split prefix (1-4 digit country codes after +)
  const match = phone.match(/^(\+\d{1,4})(.*)/);
  if (match) {
    return { country: 'OTHER', prefix: match[1], localNumber: match[2] };
  }

  return { country: 'OTHER', prefix: phone, localNumber: '' };
}

/**
 * Compose full international number from parts.
 */
export function composePhoneNumber(
  country: PhoneCountryCode,
  localNumber: string,
  customPrefix?: string
): string {
  if (country === 'OTHER') {
    return (customPrefix || '') + localNumber;
  }
  const prefix = getPhonePrefix(country);
  return prefix + localNumber;
}

/**
 * Validate any international phone number.
 * Baltic numbers use strict regex from PHONE_FORMATS.
 * Other numbers: must start with + and have 7-15 total digits.
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || !phone.startsWith('+')) return false;

  // Check if it matches any Baltic format
  for (const format of Object.values(PHONE_FORMATS)) {
    if (format.regex.test(phone)) return true;
  }

  // Generic international: + followed by at least 7 and at most 15 digits total
  const digitsOnly = phone.replace(/[^\d]/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

/**
 * Validate phone for a specific Baltic country (backward compat).
 */
export function validatePhone(phone: string, country: TerminalCountry): boolean {
  const format = PHONE_FORMATS[country];
  return format.regex.test(phone);
}
