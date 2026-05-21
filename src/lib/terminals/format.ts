/**
 * Shared terminal-address formatters.
 *
 * Buyer-facing surfaces (in-app pickup card, confirmation page, order-confirmation
 * and order-shipped emails) render the full address. Seller-facing surfaces show
 * just the name — sellers drop at any Unisend terminal, the destination address
 * is informational at most.
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
 * Buyer-facing multi-line address, one line per row:
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

/** Seller-facing single-line: just the terminal name. */
export function formatTerminalCompact(t: TerminalAddressFields): string {
  return t.name ?? '';
}
