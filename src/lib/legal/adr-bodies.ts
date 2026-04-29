import * as Sentry from '@sentry/nextjs';
import type { CountryCode } from '@/lib/country-utils';

/**
 * Single source of truth for the consumer ADR body shown to buyers pre-contract.
 *
 * Per PTAL 19.¹ / Noteikumu Nr.255 5.22.apakšpunkts, the seller must name a
 * specific national consumer-protection authority and link to its website
 * **before** the contract is concluded — not buried in Terms. The Terms §15
 * section also reads from this constant so the two surfaces cannot drift.
 *
 * EU ODR Platform (`ec.europa.eu/consumers/odr`) was discontinued 2025-07-20
 * under Regulation (EU) 2024/3228 — not included.
 */
export type AdrBody = {
  name: string;
  url: string;
  country: CountryCode;
};

export const ADR_BODIES: Record<CountryCode, AdrBody> = {
  LV: {
    name: 'Patērētāju tiesību aizsardzības centrs (PTAC)',
    url: 'https://www.ptac.gov.lv/lv/content/stridu-risinasanas-process',
    country: 'LV',
  },
  LT: {
    name: 'Valstybinė vartotojų teisių apsaugos tarnyba (VVTAT)',
    url: 'https://vvtat.lrv.lt',
    country: 'LT',
  },
  EE: {
    name: 'Tarbijakaitse ja Tehnilise Järelevalve Amet (TTJA)',
    url: 'https://www.ttja.ee',
    country: 'EE',
  },
};

/**
 * Returns the ADR body for the buyer's country, defaulting to LV (operator's
 * home jurisdiction) if the buyer's country is unknown. A missing or invalid
 * buyer country at checkout is a data-quality bug — this function logs to
 * Sentry when it falls back, so callers don't need to.
 */
export function getAdrBodyForBuyer(country: CountryCode | string | undefined | null): AdrBody {
  if (country === 'LV' || country === 'LT' || country === 'EE') {
    return ADR_BODIES[country];
  }
  Sentry.captureMessage('getAdrBodyForBuyer: fallback to LV — buyer country missing or invalid', {
    level: 'warning',
    extra: { receivedCountry: country ?? '(null/undefined)' },
  });
  return ADR_BODIES.LV;
}
