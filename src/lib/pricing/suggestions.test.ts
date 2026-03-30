import { describe, it, expect } from 'vitest';
import {
  calculateSuggestedPrice,
  computeMedian,
  CONDITION_MULTIPLIERS,
  AUCTION_BID_MULTIPLIER,
  MIN_SUGGESTED_PRICE_CENTS,
} from './suggestions';
import type { ListingCondition } from '@/lib/listings/types';

describe('calculateSuggestedPrice', () => {
  const retailCents = 3800; // €38.00

  it('applies correct multiplier for each condition', () => {
    const cases: [ListingCondition, number][] = [
      ['like_new', 0.85],
      ['very_good', 0.75],
      ['good', 0.65],
      ['acceptable', 0.50],
      ['for_parts', 0.30],
    ];

    for (const [condition, multiplier] of cases) {
      const result = calculateSuggestedPrice(retailCents, condition, false);
      expect(result).toBe(Math.round(retailCents * multiplier));
    }
  });

  it('applies auction multiplier on top of condition', () => {
    const result = calculateSuggestedPrice(retailCents, 'good', true);
    const expected = Math.round(Math.round(retailCents * 0.65) * AUCTION_BID_MULTIPLIER);
    expect(result).toBe(expected);
  });

  it('clamps to MIN_SUGGESTED_PRICE_CENTS for very cheap games', () => {
    // €1.50 game in for_parts condition = 150 * 0.30 = 45 → clamped to 100
    const result = calculateSuggestedPrice(150, 'for_parts', false);
    expect(result).toBe(MIN_SUGGESTED_PRICE_CENTS);
  });

  it('clamps auction starting bid to MIN_SUGGESTED_PRICE_CENTS', () => {
    // €2.00 game, acceptable, auction = 200 * 0.50 * 0.30 = 30 → clamped to 100
    const result = calculateSuggestedPrice(200, 'acceptable', true);
    expect(result).toBe(MIN_SUGGESTED_PRICE_CENTS);
  });

  it('returns null when retail price is null', () => {
    expect(calculateSuggestedPrice(null, 'good', false)).toBeNull();
  });

  it('returns null when retail price is 0', () => {
    expect(calculateSuggestedPrice(0, 'good', false)).toBeNull();
  });

  it('returns null for negative retail price', () => {
    expect(calculateSuggestedPrice(-500, 'good', false)).toBeNull();
  });

  it('rounds to nearest cent', () => {
    // 3333 * 0.85 = 2833.05 → 2833
    const result = calculateSuggestedPrice(3333, 'like_new', false);
    expect(result).toBe(2833);
  });

  it('matches CONDITION_MULTIPLIERS map values', () => {
    expect(CONDITION_MULTIPLIERS).toEqual({
      like_new: 0.85,
      very_good: 0.75,
      good: 0.65,
      acceptable: 0.50,
      for_parts: 0.30,
    });
  });
});

describe('computeMedian', () => {
  it('returns null for empty array', () => {
    expect(computeMedian([])).toBeNull();
  });

  it('returns the single value for array of length 1', () => {
    expect(computeMedian([500])).toBe(500);
  });

  it('returns the middle value for odd-length arrays', () => {
    expect(computeMedian([100, 300, 500])).toBe(300);
  });

  it('returns average of two middle values for even-length arrays', () => {
    expect(computeMedian([100, 200, 300, 400])).toBe(250);
  });

  it('rounds the average for even-length arrays', () => {
    // (100 + 201) / 2 = 150.5 → 151
    expect(computeMedian([100, 201])).toBe(151);
  });

  it('handles unsorted input', () => {
    expect(computeMedian([500, 100, 300])).toBe(300);
  });

  it('handles all same values', () => {
    expect(computeMedian([250, 250, 250, 250])).toBe(250);
  });

  it('does not mutate the input array', () => {
    const input = [300, 100, 200];
    computeMedian(input);
    expect(input).toEqual([300, 100, 200]);
  });
});
