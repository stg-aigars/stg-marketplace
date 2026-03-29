import { describe, it, expect } from 'vitest';
import { orderGameSummary, getOrderGameSummary, getOrderListingIds } from './utils';

describe('orderGameSummary', () => {
  it('returns "Game" for empty array', () => {
    expect(orderGameSummary([])).toBe('Game');
  });

  it('returns the game name for a single item', () => {
    expect(orderGameSummary([{ gameName: 'Catan' }])).toBe('Catan');
  });

  it('returns summary for two items', () => {
    expect(orderGameSummary([{ gameName: 'Catan' }, { gameName: 'Azul' }])).toBe('Catan + 1 more');
  });

  it('returns summary for three items', () => {
    expect(orderGameSummary([
      { gameName: 'Catan' },
      { gameName: 'Azul' },
      { gameName: 'Wingspan' },
    ])).toBe('Catan + 2 more');
  });
});

describe('getOrderGameSummary', () => {
  it('uses order_items when available', () => {
    const items = [
      { listing_id: 'a', listings: { game_name: 'Catan' } },
      { listing_id: 'b', listings: { game_name: 'Azul' } },
    ];
    expect(getOrderGameSummary(items, null)).toBe('Catan + 1 more');
  });

  it('falls back to legacy listings when order_items is undefined', () => {
    expect(getOrderGameSummary(undefined, { game_name: 'Catan' })).toBe('Catan');
  });

  it('falls back to legacy listings when order_items is empty', () => {
    expect(getOrderGameSummary([], { game_name: 'Catan' })).toBe('Catan');
  });

  it('returns "Game" when both are missing', () => {
    expect(getOrderGameSummary(undefined, null)).toBe('Game');
  });

  it('handles null listings in order_items', () => {
    const items = [{ listing_id: 'a', listings: null }];
    expect(getOrderGameSummary(items, null)).toBe('Game');
  });
});

describe('getOrderListingIds', () => {
  it('extracts listing IDs from order_items', () => {
    const items = [
      { listing_id: 'a', listings: null },
      { listing_id: 'b', listings: null },
    ];
    expect(getOrderListingIds(items, null)).toEqual(['a', 'b']);
  });

  it('falls back to legacy listing_id', () => {
    expect(getOrderListingIds(undefined, 'legacy-id')).toEqual(['legacy-id']);
  });

  it('falls back to legacy listing_id when order_items is empty', () => {
    expect(getOrderListingIds([], 'legacy-id')).toEqual(['legacy-id']);
  });

  it('returns empty array when both are missing', () => {
    expect(getOrderListingIds(undefined, null)).toEqual([]);
  });
});
