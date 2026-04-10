import { COUNTRIES, type CountryCode } from '@/lib/country-utils';

export type WantedSortOption = 'newest';

const VALID_COUNTRY_CODES = COUNTRIES.map(c => c.code);

export interface WantedBrowseFilters {
  search: string;
  countries: CountryCode[];
  sort: WantedSortOption;
  page: number;
}

export const DEFAULT_WANTED_FILTERS: WantedBrowseFilters = {
  search: '',
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

  const countryParam = get('country');
  const countries = countryParam
    ? countryParam
        .split(',')
        .filter((c): c is CountryCode =>
          VALID_COUNTRY_CODES.includes(c as CountryCode)
        )
    : [];

  const search = (get('q') ?? '').trim().slice(0, 200);

  const rawPage = get('page');
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1);

  return { search, countries, sort: 'newest', page };
}

export function wantedFiltersToSearchParams(filters: WantedBrowseFilters): string {
  const params = new URLSearchParams();

  if (filters.search) params.set('q', filters.search);
  if (filters.countries.length > 0) params.set('country', filters.countries.join(','));
  if (filters.page > 1) params.set('page', String(filters.page));

  const str = params.toString();
  return str ? `?${str}` : '';
}

export function hasActiveWantedFilters(filters: WantedBrowseFilters): boolean {
  return (
    filters.search !== '' ||
    filters.countries.length > 0
  );
}
