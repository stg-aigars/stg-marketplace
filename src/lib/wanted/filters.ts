import { LISTING_CONDITIONS, type ListingCondition } from '@/lib/listings/types';
import { COUNTRIES, type CountryCode } from '@/lib/country-utils';

export type WantedSortOption = 'newest' | 'budget_asc' | 'budget_desc';

const VALID_SORTS: WantedSortOption[] = ['newest', 'budget_asc', 'budget_desc'];
const VALID_COUNTRY_CODES = COUNTRIES.map(c => c.code);

export interface WantedBrowseFilters {
  search: string;
  minConditions: ListingCondition[];
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  countries: CountryCode[];
  sort: WantedSortOption;
  page: number;
}

export const DEFAULT_WANTED_FILTERS: WantedBrowseFilters = {
  search: '',
  minConditions: [],
  budgetMinCents: null,
  budgetMaxCents: null,
  countries: [],
  sort: 'newest',
  page: 1,
};

export function parseWantedFiltersFromParams(
  params: Record<string, string | string[] | undefined>
): WantedBrowseFilters {
  const get = (key: string): string | undefined => {
    const val = params[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const conditionParam = get('condition');
  const minConditions = conditionParam
    ? conditionParam
        .split(',')
        .filter((c): c is ListingCondition =>
          LISTING_CONDITIONS.includes(c as ListingCondition)
        )
    : [];

  const rawMin = get('budget_min');
  const rawMax = get('budget_max');
  const budgetMinCents = rawMin ? parsePositiveInt(rawMin) : null;
  const budgetMaxCents = rawMax ? parsePositiveInt(rawMax) : null;

  const countryParam = get('country');
  const countries = countryParam
    ? countryParam
        .split(',')
        .filter((c): c is CountryCode =>
          VALID_COUNTRY_CODES.includes(c as CountryCode)
        )
    : [];

  const rawSort = get('sort');
  const sort: WantedSortOption =
    rawSort && VALID_SORTS.includes(rawSort as WantedSortOption)
      ? (rawSort as WantedSortOption)
      : 'newest';

  const search = (get('q') ?? '').trim().slice(0, 200);

  const rawPage = get('page');
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1);

  return { search, minConditions, budgetMinCents, budgetMaxCents, countries, sort, page };
}

export function wantedFiltersToSearchParams(filters: WantedBrowseFilters): string {
  const params = new URLSearchParams();

  if (filters.search) params.set('q', filters.search);
  if (filters.minConditions.length > 0) params.set('condition', filters.minConditions.join(','));
  if (filters.budgetMinCents !== null) params.set('budget_min', String(filters.budgetMinCents));
  if (filters.budgetMaxCents !== null) params.set('budget_max', String(filters.budgetMaxCents));
  if (filters.countries.length > 0) params.set('country', filters.countries.join(','));
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));

  const str = params.toString();
  return str ? `?${str}` : '';
}

export function hasActiveWantedFilters(filters: WantedBrowseFilters): boolean {
  return (
    filters.search !== '' ||
    filters.minConditions.length > 0 ||
    filters.budgetMinCents !== null ||
    filters.budgetMaxCents !== null ||
    filters.countries.length > 0
  );
}

function parsePositiveInt(val: string): number | null {
  const n = parseInt(val, 10);
  return !isNaN(n) && n > 0 ? n : null;
}
