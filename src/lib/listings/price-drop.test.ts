import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRICE_DROP_WINDOW_DAYS, isPriceDropActive } from './price-drop';

const NOW = new Date('2026-05-26T12:00:00.000Z');

function listing(overrides: {
  listing_type?: 'fixed_price' | 'auction' | 'declining';
  price_cents?: number;
  previous_price_cents?: number | null;
  price_changed_at?: string | null;
}) {
  return {
    listing_type: 'fixed_price' as const,
    price_cents: 3000,
    previous_price_cents: 4000,
    price_changed_at: NOW.toISOString(),
    ...overrides,
  };
}

describe('isPriceDropActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a just-now drop on a fixed_price listing', () => {
    expect(isPriceDropActive(listing({}))).toBe(true);
  });

  it('returns true at 13 days, 59 minutes after the drop (inside the window)', () => {
    const changedAt = new Date(NOW.getTime() - (13 * 24 * 60 + 23 * 60 + 59) * 60 * 1000);
    expect(isPriceDropActive(listing({ price_changed_at: changedAt.toISOString() }))).toBe(true);
  });

  it('returns false at 14 days, 1 minute after the drop (window expired)', () => {
    const changedAt = new Date(NOW.getTime() - (PRICE_DROP_WINDOW_DAYS * 24 * 60 + 1) * 60 * 1000);
    expect(isPriceDropActive(listing({ price_changed_at: changedAt.toISOString() }))).toBe(false);
  });

  it('returns false when price_changed_at is in the future (clock-skew defense)', () => {
    const changedAt = new Date(NOW.getTime() + 60 * 1000);
    expect(isPriceDropActive(listing({ price_changed_at: changedAt.toISOString() }))).toBe(false);
  });

  it('returns false for auction listings even if the data looks like a drop', () => {
    expect(isPriceDropActive(listing({ listing_type: 'auction' }))).toBe(false);
  });

  it('returns true for a declining listing that has actually dropped', () => {
    expect(isPriceDropActive(listing({ listing_type: 'declining' }))).toBe(true);
  });

  it('returns false for a declining listing that has not dropped yet (previous_price_cents null)', () => {
    expect(
      isPriceDropActive(listing({ listing_type: 'declining', previous_price_cents: null }))
    ).toBe(false);
  });

  it('returns false for a declining listing whose drop is past the 14d window', () => {
    const changedAt = new Date(NOW.getTime() - (PRICE_DROP_WINDOW_DAYS * 24 * 60 + 1) * 60 * 1000);
    expect(
      isPriceDropActive(listing({ listing_type: 'declining', price_changed_at: changedAt.toISOString() }))
    ).toBe(false);
  });

  it('returns false when previous_price_cents is null', () => {
    expect(isPriceDropActive(listing({ previous_price_cents: null }))).toBe(false);
  });

  it('returns false when price_changed_at is null', () => {
    expect(isPriceDropActive(listing({ price_changed_at: null }))).toBe(false);
  });

  it('returns false when current price equals previous price (no decrease)', () => {
    expect(isPriceDropActive(listing({ price_cents: 4000, previous_price_cents: 4000 }))).toBe(false);
  });

  it('returns false when current price is higher than previous price (increase, not drop)', () => {
    expect(isPriceDropActive(listing({ price_cents: 5000, previous_price_cents: 4000 }))).toBe(false);
  });
});
