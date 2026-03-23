import { describe, it, expect } from 'vitest';
import { calculateTrustTier } from './sellers';

describe('calculateTrustTier', () => {
  it('returns "new" for 0 completed sales', () => {
    expect(calculateTrustTier(0, 0, 0)).toBe('new');
    expect(calculateTrustTier(0, 100, 5)).toBe('new');
  });

  it('returns "new" for sales but no reviews', () => {
    expect(calculateTrustTier(3, 0, 0)).toBe('new');
    expect(calculateTrustTier(10, 0, 0)).toBe('new');
  });

  it('returns "bronze" for 1-4 sales with at least one review', () => {
    expect(calculateTrustTier(1, 100, 1)).toBe('bronze');
    expect(calculateTrustTier(4, 50, 2)).toBe('bronze');
  });

  it('returns "bronze" for 5+ sales with rating below 80%', () => {
    expect(calculateTrustTier(5, 79, 5)).toBe('bronze');
    expect(calculateTrustTier(10, 70, 10)).toBe('bronze');
  });

  it('returns "gold" for 5-19 sales with 80%+ rating', () => {
    expect(calculateTrustTier(5, 80, 5)).toBe('gold');
    expect(calculateTrustTier(19, 95, 10)).toBe('gold');
  });

  it('returns "gold" for 20+ sales with rating below 90%', () => {
    expect(calculateTrustTier(20, 89, 20)).toBe('gold');
    expect(calculateTrustTier(50, 85, 30)).toBe('gold');
  });

  it('returns "trusted" for 20+ sales with 90%+ rating', () => {
    expect(calculateTrustTier(20, 90, 20)).toBe('trusted');
    expect(calculateTrustTier(100, 95, 50)).toBe('trusted');
  });
});
