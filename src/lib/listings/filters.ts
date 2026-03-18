import { LISTING_CONDITIONS, type ListingCondition } from './types';
import { COUNTRIES, type CountryCode } from '@/lib/country-utils';

export type SortOption = 'newest' | 'price_asc' | 'price_desc';

const VALID_SORTS: SortOption[] = ['newest', 'price_asc', 'price_desc'];
const VALID_COUNTRY_CODES = COUNTRIES.map(c => c.code);

export interface BrowseFilters {
  conditions: ListingCondition[];
  priceMinCents: number | null;
  priceMaxCents: number | null;
  playerCount: number | null;
  countries: CountryCode[];
  sort: SortOption;
  page: number;
}

export const DEFAULT_FILTERS: BrowseFilters = {
  conditions: [],
  priceMinCents: null,
  priceMaxCents: null,
  playerCount: null,
  countries: [],
  sort: 'newest',
  page: 1,
};

/**
 * Parse and validate filter values from URL search params.
 * Invalid values are silently dropped (defaults used).
 */
export function parseFiltersFromParams(
  params: Record<string, string | string[] | undefined>
): BrowseFilters {
  const get = (key: string): string | undefined => {
    const val = params[key];
    return Array.isArray(val) ? val[0] : val;
  };

  // Conditions
  const conditionParam = get('condition');
  const conditions = conditionParam
    ? conditionParam
        .split(',')
        .filter((c): c is ListingCondition =>
          LISTING_CONDITIONS.includes(c as ListingCondition)
        )
    : [];

  // Price range (params are in cents)
  const rawMin = get('price_min');
  const rawMax = get('price_max');
  const priceMinCents = rawMin ? parsePositiveInt(rawMin) : null;
  const priceMaxCents = rawMax ? parsePositiveInt(rawMax) : null;

  // Player count — single number ("plays with N")
  const rawPlayers = get('players');
  const playerCount = rawPlayers ? parsePositiveInt(rawPlayers) : null;

  // Countries
  const countryParam = get('country');
  const countries = countryParam
    ? countryParam
        .split(',')
        .filter((c): c is CountryCode =>
          VALID_COUNTRY_CODES.includes(c as CountryCode)
        )
    : [];

  // Sort
  const rawSort = get('sort');
  const sort: SortOption =
    rawSort && VALID_SORTS.includes(rawSort as SortOption)
      ? (rawSort as SortOption)
      : 'newest';

  // Page
  const rawPage = get('page');
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1);

  return { conditions, priceMinCents, priceMaxCents, playerCount, countries, sort, page };
}

/**
 * Convert filters back to URL search params string.
 * Only includes non-default values to keep URLs clean.
 */
export function filtersToSearchParams(filters: BrowseFilters): string {
  const params = new URLSearchParams();

  if (filters.conditions.length > 0) {
    params.set('condition', filters.conditions.join(','));
  }
  if (filters.priceMinCents !== null) {
    params.set('price_min', String(filters.priceMinCents));
  }
  if (filters.priceMaxCents !== null) {
    params.set('price_max', String(filters.priceMaxCents));
  }
  if (filters.playerCount !== null) {
    params.set('players', String(filters.playerCount));
  }
  if (filters.countries.length > 0) {
    params.set('country', filters.countries.join(','));
  }
  if (filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }

  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Count the number of active filters (excluding sort and page).
 */
export function countActiveFilters(filters: BrowseFilters): number {
  let count = 0;
  if (filters.conditions.length > 0) count++;
  if (filters.priceMinCents !== null || filters.priceMaxCents !== null) count++;
  if (filters.playerCount !== null) count++;
  if (filters.countries.length > 0) count++;
  return count;
}

/**
 * Check if any filters are active (excluding sort and page).
 */
export function hasActiveFilters(filters: BrowseFilters): boolean {
  return countActiveFilters(filters) > 0;
}

function parsePositiveInt(val: string): number | null {
  const n = parseInt(val, 10);
  return !isNaN(n) && n > 0 ? n : null;
}
