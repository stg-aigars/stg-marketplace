import { describe, it, expect } from 'vitest';
import { parseSellerProfileSearchParams } from './parse-search-params';

describe('parseSellerProfileSearchParams', () => {
  it('defaults to listings tab and page 1 with no params', () => {
    expect(parseSellerProfileSearchParams({})).toEqual({ activeTab: 'listings', requestedPage: 1 });
  });

  it('recognizes profile and reviews tabs', () => {
    expect(parseSellerProfileSearchParams({ tab: 'profile' }).activeTab).toBe('profile');
    expect(parseSellerProfileSearchParams({ tab: 'reviews' }).activeTab).toBe('reviews');
  });

  it('falls back to listings for unknown or malformed tab values', () => {
    expect(parseSellerProfileSearchParams({ tab: 'bogus' }).activeTab).toBe('listings');
    expect(parseSellerProfileSearchParams({ tab: ['profile', 'reviews'] }).activeTab).toBe('listings');
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
