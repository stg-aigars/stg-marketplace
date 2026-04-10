import { COUNTRIES, type CountryCode } from '@/lib/country-utils';

export type SortOption = 'newest' | 'price_asc' | 'price_desc';

export type WeightLevel = 'light' | 'medium_light' | 'medium' | 'medium_heavy' | 'heavy';

export const WEIGHT_LEVELS: WeightLevel[] = ['light', 'medium_light', 'medium', 'medium_heavy', 'heavy'];

export const WEIGHT_LEVEL_LABELS: Record<WeightLevel, string> = {
  light: 'Quick & Easy',
  medium_light: 'Relaxed',
  medium: 'Engaging',
  medium_heavy: 'Challenging',
  heavy: 'Brain Burner',
};

/** Maps each weight level to its [min, max) numeric range on the BGG 1-5 scale. */
export const WEIGHT_LEVEL_RANGES: Record<WeightLevel, { min: number; max: number }> = {
  light: { min: 0, max: 1.5 },
  medium_light: { min: 1.5, max: 2.5 },
  medium: { min: 2.5, max: 3.5 },
  medium_heavy: { min: 3.5, max: 4.5 },
  heavy: { min: 4.5, max: 5.01 }, // inclusive upper bound for 5.0
};

const VALID_SORTS: SortOption[] = ['newest', 'price_asc', 'price_desc'];
const VALID_COUNTRY_CODES = COUNTRIES.map(c => c.code);
const VALID_PLAYER_COUNTS = [1, 2, 3, 4, 5, 6];

export interface BrowseFilters {
  search: string;
  playerCounts: number[];
  countries: CountryCode[];
  weightLevels: WeightLevel[];
  showExpansions: boolean;
  showAuctions: boolean;
  sort: SortOption;
  page: number;
}

export const DEFAULT_FILTERS: BrowseFilters = {
  search: '',
  playerCounts: [],
  countries: [],
  weightLevels: [],
  showExpansions: false,
  showAuctions: false,
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

  // Player counts (comma-separated, 1-5)
  const playersParam = get('players');
  const playerCounts = playersParam
    ? playersParam
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => VALID_PLAYER_COUNTS.includes(n))
    : [];

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

  // Search
  const search = (get('q') ?? '').trim().slice(0, 200);

  // Weight levels
  const weightParam = get('weight');
  const weightLevels = weightParam
    ? weightParam
        .split(',')
        .filter((w): w is WeightLevel => WEIGHT_LEVELS.includes(w as WeightLevel))
    : [];

  // Show expansion listings
  const showExpansions = get('expansions') === '1';

  // Show auctions only
  const showAuctions = get('auctions') === '1';

  // Page
  const rawPage = get('page');
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1);

  return { search, playerCounts, countries, weightLevels, showExpansions, showAuctions, sort, page };
}

/**
 * Convert filters back to URL search params string.
 * Only includes non-default values to keep URLs clean.
 */
export function filtersToSearchParams(filters: BrowseFilters): string {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set('q', filters.search);
  }
  if (filters.playerCounts.length > 0) {
    params.set('players', filters.playerCounts.join(','));
  }
  if (filters.countries.length > 0) {
    params.set('country', filters.countries.join(','));
  }
  if (filters.weightLevels.length > 0) {
    params.set('weight', filters.weightLevels.join(','));
  }
  if (filters.showExpansions) {
    params.set('expansions', '1');
  }
  if (filters.showAuctions) {
    params.set('auctions', '1');
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
  if (filters.search) count++;
  if (filters.playerCounts.length > 0) count++;
  if (filters.countries.length > 0) count++;
  if (filters.weightLevels.length > 0) count++;
  if (filters.showExpansions) count++;
  if (filters.showAuctions) count++;
  return count;
}

/**
 * Check if any filters are active (excluding sort and page).
 */
export function hasActiveFilters(filters: BrowseFilters): boolean {
  return countActiveFilters(filters) > 0;
}
