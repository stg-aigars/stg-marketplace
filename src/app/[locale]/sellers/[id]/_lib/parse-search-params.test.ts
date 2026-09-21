import { describe, it, expect } from 'vitest';
import { parseSellerProfileSearchParams } from './parse-search-params';

describe('parseSellerProfileSearchParams', () => {
  it('defaults to profile tab and page 1 with no params', () => {
    expect(parseSellerProfileSearchParams({})).toEqual({ activeTab: 'profile', requestedPage: 1 });
  });

  it('recognizes reviews and listings tabs', () => {
    expect(parseSellerProfileSearchParams({ tab: 'reviews' }).activeTab).toBe('reviews');
    expect(parseSellerProfileSearchParams({ tab: 'listings' }).activeTab).toBe('listings');
  });

  it('falls back to profile for unknown or malformed tab values', () => {
    expect(parseSellerProfileSearchParams({ tab: 'bogus' }).activeTab).toBe('profile');
    expect(parseSellerProfileSearchParams({ tab: ['reviews', 'listings'] }).activeTab).toBe('profile');
  });

  it('parses a valid page number', () => {
    expect(parseSellerProfileSearchParams({ page: '3' }).requestedPage).toBe(3);
  });

  it('defaults page to 1 for invalid, zero, or negative values', () => {
    expect(parseSellerProfileSearchParams({ page: 'abc' }).requestedPage).toBe(1);
    expect(parseSellerProfileSearchParams({ page: '0' }).requestedPage).toBe(1);
    expect(parseSellerProfileSearchParams({ page: '-1' }).requestedPage).toBe(1);
  });
});
