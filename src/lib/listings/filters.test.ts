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

  it('parses valid conditions', () => {
    const result = parseFiltersFromParams({ condition: 'like_new,good' });
    expect(result.conditions).toEqual(['like_new', 'good']);
  });

  it('drops invalid conditions', () => {
    const result = parseFiltersFromParams({ condition: 'like_new,bogus,good' });
    expect(result.conditions).toEqual(['like_new', 'good']);
  });

  it('parses price range in cents', () => {
    const result = parseFiltersFromParams({ price_min: '500', price_max: '5000' });
    expect(result.priceMinCents).toBe(500);
    expect(result.priceMaxCents).toBe(5000);
  });

  it('ignores invalid price values', () => {
    const result = parseFiltersFromParams({ price_min: 'abc', price_max: '-10' });
    expect(result.priceMinCents).toBeNull();
    expect(result.priceMaxCents).toBeNull();
  });

  it('ignores zero price', () => {
    const result = parseFiltersFromParams({ price_min: '0' });
    expect(result.priceMinCents).toBeNull();
  });

  it('parses player count as single number', () => {
    const result = parseFiltersFromParams({ players: '4' });
    expect(result.playerCount).toBe(4);
  });

  it('ignores invalid player count', () => {
    const result = parseFiltersFromParams({ players: 'many' });
    expect(result.playerCount).toBeNull();
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

  it('parses all params together', () => {
    const result = parseFiltersFromParams({
      condition: 'like_new,very_good',
      price_min: '1000',
      price_max: '5000',
      players: '2',
      country: 'LV,LT',
      sort: 'price_asc',
      page: '2',
    });
    expect(result).toEqual({
      search: '',
      conditions: ['like_new', 'very_good'],
      priceMinCents: 1000,
      priceMaxCents: 5000,
      playerCount: 2,
      countries: ['LV', 'LT'],
      categories: [],
      mechanics: [],
      weightLevels: [],
      showExpansions: false,
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
      conditions: ['good'],
      sort: 'price_desc',
    });
    expect(result).toContain('condition=good');
    expect(result).toContain('sort=price_desc');
    expect(result).not.toContain('page=');
    expect(result).not.toContain('players=');
  });

  it('round-trips through parse', () => {
    const original = {
      search: 'catan',
      conditions: ['like_new' as const, 'very_good' as const],
      priceMinCents: 500,
      priceMaxCents: 5000,
      playerCount: 3,
      countries: ['LV' as const, 'EE' as const],
      categories: ['Economic'],
      mechanics: ['Trading'],
      weightLevels: ['medium' as const],
      showExpansions: false,
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

  it('counts condition as one filter', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, conditions: ['like_new', 'good'] })
    ).toBe(1);
  });

  it('counts price range as one filter', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, priceMinCents: 100, priceMaxCents: 5000 })
    ).toBe(1);
  });

  it('counts only price_min as one filter', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, priceMinCents: 100 })
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
        conditions: ['good'],
        priceMinCents: 100,
        playerCount: 4,
        countries: ['LV'],
      })
    ).toBe(4);
  });
});

describe('hasActiveFilters', () => {
  it('returns false for defaults', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('returns true when any filter is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, playerCount: 2 })).toBe(true);
  });
});
