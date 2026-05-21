/**
 * Shared terminal-address formatter.
 */

import { getCountryName } from '@/lib/country-utils';

export interface TerminalAddressFields {
  name: string | null | undefined;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/**
 * Email/wrapper-layer fields for buyer's pickup terminal. Disambiguating
 * `terminal*` prefix matches existing wrapper params (buyerName, sellerName, …).
 */
export interface TerminalEmailFields {
  terminalAddress?: string | null;
  terminalCity?: string | null;
  terminalPostalCode?: string | null;
  terminalCountry?: string | null;
}

/**
 * Multi-line address, one line per row:
 *   {name}
 *   {address}
 *   {city}, {postalCode}
 *   {countryName}
 * Missing fields collapse silently.
 */
export function formatTerminalLines(t: TerminalAddressFields): string[] {
  if (!t.name) return [];
  const lines = [t.name];
  if (t.address) lines.push(t.address);
  const cityPostal = [t.city, t.postalCode].filter(Boolean).join(', ');
  if (cityPostal) lines.push(cityPostal);
  if (t.country) lines.push(getCountryName(t.country));
  return lines;
}
