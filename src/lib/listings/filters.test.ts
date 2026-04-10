import { describe, it, expect } from 'vitest';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  countActiveFilters,
  hasActiveFilters,
  DEFAULT_FILTERS,
} from './filters';

describe('parseFiltersFromParams', () => {
  it('returns defaults for empty params', () => {
    expect(parseFiltersFromParams({})).toEqual(DEFAULT_FILTERS);
  });

  it('ignores removed params (condition, price, categories, mechanics)', () => {
    const result = parseFiltersFromParams({
      condition: 'like_new',
      price_min: '500',
      categories: 'Strategy',
      mechanics: 'Trading',
    });
    expect(result).toEqual(DEFAULT_FILTERS);
  });

  it('parses single player count', () => {
    const result = parseFiltersFromParams({ players: '4' });
    expect(result.playerCounts).toEqual([4]);
  });

  it('parses multiple player counts', () => {
    const result = parseFiltersFromParams({ players: '2,4,5' });
    expect(result.playerCounts).toEqual([2, 4, 5]);
  });

  it('drops invalid player counts', () => {
    const result = parseFiltersFromParams({ players: '2,7,abc,4' });
    expect(result.playerCounts).toEqual([2, 4]);
  });

  it('ignores completely invalid player count', () => {
    const result = parseFiltersFromParams({ players: 'many' });
    expect(result.playerCounts).toEqual([]);
  });

  it('parses valid countries', () => {
    const result = parseFiltersFromParams({ country: 'LV,EE' });
    expect(result.countries).toEqual(['LV', 'EE']);
  });

  it('drops invalid country codes', () => {
    const result = parseFiltersFromParams({ country: 'LV,US,EE' });
    expect(result.countries).toEqual(['LV', 'EE']);
  });

  it('parses valid sort option', () => {
    expect(parseFiltersFromParams({ sort: 'price_asc' }).sort).toBe('price_asc');
    expect(parseFiltersFromParams({ sort: 'price_desc' }).sort).toBe('price_desc');
  });

  it('defaults invalid sort to newest', () => {
    expect(parseFiltersFromParams({ sort: 'bogus' }).sort).toBe('newest');
  });

  it('parses page', () => {
    expect(parseFiltersFromParams({ page: '3' }).page).toBe(3);
  });

  it('defaults invalid page to 1', () => {
    expect(parseFiltersFromParams({ page: '0' }).page).toBe(1);
    expect(parseFiltersFromParams({ page: '-5' }).page).toBe(1);
    expect(parseFiltersFromParams({ page: 'abc' }).page).toBe(1);
  });

  it('parses showAuctions', () => {
    expect(parseFiltersFromParams({ auctions: '1' }).showAuctions).toBe(true);
    expect(parseFiltersFromParams({}).showAuctions).toBe(false);
  });

  it('parses all params together', () => {
    const result = parseFiltersFromParams({
      players: '2,4',
      country: 'LV,LT',
      weight: 'medium',
      sort: 'price_asc',
      page: '2',
      auctions: '1',
    });
    expect(result).toEqual({
      search: '',
      playerCounts: [2, 4],
      countries: ['LV', 'LT'],
      weightLevels: ['medium'],
      showExpansions: false,
      showAuctions: true,
      sort: 'price_asc',
      page: 2,
    });
  });
});

describe('filtersToSearchParams', () => {
  it('returns empty string for default filters', () => {
    expect(filtersToSearchParams(DEFAULT_FILTERS)).toBe('');
  });

  it('includes only non-default values', () => {
    const result = filtersToSearchParams({
      ...DEFAULT_FILTERS,
      playerCounts: [3],
      sort: 'price_desc',
    });
    expect(result).toContain('players=3');
    expect(result).toContain('sort=price_desc');
    expect(result).not.toContain('page=');
    expect(result).not.toContain('country=');
  });

  it('serializes multiple player counts', () => {
    const result = filtersToSearchParams({
      ...DEFAULT_FILTERS,
      playerCounts: [2, 4],
    });
    expect(result).toContain('players=2%2C4');
  });

  it('round-trips through parse', () => {
    const original = {
      search: 'catan',
      playerCounts: [2, 4],
      countries: ['LV' as const, 'EE' as const],
      weightLevels: ['medium' as const],
      showExpansions: false,
      showAuctions: true,
      sort: 'price_asc' as const,
      page: 2,
    };
    const params = filtersToSearchParams(original);
    const parsed = parseFiltersFromParams(
      Object.fromEntries(new URLSearchParams(params.slice(1)))
    );
    expect(parsed).toEqual(original);
  });

  it('omits page 1', () => {
    expect(filtersToSearchParams({ ...DEFAULT_FILTERS, page: 1 })).toBe('');
  });

  it('omits newest sort', () => {
    expect(filtersToSearchParams({ ...DEFAULT_FILTERS, sort: 'newest' })).toBe('');
  });
});

describe('countActiveFilters', () => {
  it('returns 0 for defaults', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts playerCounts as one filter', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, playerCounts: [2, 4] })
    ).toBe(1);
  });

  it('counts showAuctions as one filter', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, showAuctions: true })
    ).toBe(1);
  });

  it('does not count sort', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, sort: 'price_asc' })
    ).toBe(0);
  });

  it('counts all filter types', () => {
    expect(
      countActiveFilters({
        ...DEFAULT_FILTERS,
        playerCounts: [4],
        countries: ['LV'],
        showAuctions: true,
        weightLevels: ['medium'],
      })
    ).toBe(4);
  });
});

describe('hasActiveFilters', () => {
  it('returns false for defaults', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('returns true when any filter is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, playerCounts: [2] })).toBe(true);
  });
});
