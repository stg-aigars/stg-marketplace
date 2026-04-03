/**
 * Country utilities for marketplace
 * Supporting Latvia, Estonia, and Lithuania (Baltic countries only)
 * Uses flag-icons library for proper SVG flag rendering
 */

export type CountryCode = 'LV' | 'EE' | 'LT';

export interface Country {
  code: CountryCode;
  name: string;
  flagClass: string;
}

export const COUNTRIES: Country[] = [
  { code: 'LV', name: 'Latvia', flagClass: 'fi fi-lv' },
  { code: 'EE', name: 'Estonia', flagClass: 'fi fi-ee' },
  { code: 'LT', name: 'Lithuania', flagClass: 'fi fi-lt' },
];

export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode) return '';
  return COUNTRIES.find(c => c.code === countryCode)?.flagClass || '';
}

export function getCountryName(countryCode: string | null | undefined): string {
  if (!countryCode) return 'Unknown';
  return COUNTRIES.find(c => c.code === countryCode)?.name || 'Unknown';
}

export function getCountry(countryCode: string | null | undefined): Country | undefined {
  if (!countryCode) return undefined;
  return COUNTRIES.find(c => c.code === countryCode);
}

export function isValidCountryCode(countryCode: string): countryCode is CountryCode {
  return COUNTRIES.some(c => c.code === countryCode);
}

/** Maps Baltic country codes to their primary language name (as used in BGG version data). */
export const COUNTRY_TO_LANGUAGE: Record<CountryCode, string> = {
  LV: 'Latvian',
  LT: 'Lithuanian',
  EE: 'Estonian',
};
