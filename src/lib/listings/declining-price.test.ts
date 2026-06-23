import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDecliningPriceSchedulePreview, computeDecliningPrice, validateDecliningSchedule } from './declining-price';

const SCHEDULE_START = new Date('2026-06-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function input(overrides: Partial<Parameters<typeof computeDecliningPrice>[0]> = {}) {
  return {
    startingPriceCents: 6000,
    floorPriceCents: 3000,
    decrementCents: 500,
    dropIntervalDays: 7,
    scheduleStartAt: SCHEDULE_START,
    now: SCHEDULE_START,
    ...overrides,
  };
}

describe('computeDecliningPrice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the starting price with no drops elapsed', () => {
    const result = computeDecliningPrice(input({ now: SCHEDULE_START }));
    expect(result.currentPriceCents).toBe(6000);
    expect(result.nextDropAt).toEqual(new Date(SCHEDULE_START.getTime() + 7 * DAY_MS));
  });

  it('returns the starting price just before the first interval elapses', () => {
    const now = new Date(SCHEDULE_START.getTime() + 7 * DAY_MS - 1000);
    const result = computeDecliningPrice(input({ now }));
    expect(result.currentPriceCents).toBe(6000);
  });

  it('drops by one decrement exactly at the first interval boundary', () => {
    const now = new Date(SCHEDULE_START.getTime() + 7 * DAY_MS);
    const result = computeDecliningPrice(input({ now }));
    expect(result.currentPriceCents).toBe(5500);
    expect(result.nextDropAt).toEqual(new Date(SCHEDULE_START.getTime() + 14 * DAY_MS));
  });

  it('computes the mid-schedule price after several elapsed intervals', () => {
    const now = new Date(SCHEDULE_START.getTime() + 3 * 7 * DAY_MS + DAY_MS);
    const result = computeDecliningPrice(input({ now }));
    expect(result.currentPriceCents).toBe(4500); // 6000 - 3*500
    expect(result.nextDropAt).toEqual(new Date(SCHEDULE_START.getTime() + 4 * 7 * DAY_MS));
  });

  it('clamps exactly at the floor and reports no further drop', () => {
    // (6000 - 3000) / 500 = 6 steps to reach the floor
    const now = new Date(SCHEDULE_START.getTime() + 6 * 7 * DAY_MS);
    const result = computeDecliningPrice(input({ now }));
    expect(result.currentPriceCents).toBe(3000);
    expect(result.nextDropAt).toBeNull();
  });

  it('stays clamped at the floor long past the scheduled floor date', () => {
    const now = new Date(SCHEDULE_START.getTime() + 50 * 7 * DAY_MS);
    const result = computeDecliningPrice(input({ now }));
    expect(result.currentPriceCents).toBe(3000);
    expect(result.nextDropAt).toBeNull();
  });

  it('self-heals after a large gap (missed cron runs) by computing from elapsed time, not single steps', () => {
    // 4 intervals elapsed in one jump, as if the cron didn't run for a month
    const now = new Date(SCHEDULE_START.getTime() + 4 * 7 * DAY_MS + 3 * DAY_MS);
    const result = computeDecliningPrice(input({ now }));
    expect(result.currentPriceCents).toBe(4000); // 6000 - 4*500
    expect(result.nextDropAt).toEqual(new Date(SCHEDULE_START.getTime() + 5 * 7 * DAY_MS));
  });

  it('treats a decrement that overshoots the floor in one step as landing exactly on the floor', () => {
    const result = computeDecliningPrice(
      input({
        startingPriceCents: 6000,
        floorPriceCents: 5800,
        decrementCents: 500,
        now: new Date(SCHEDULE_START.getTime() + 7 * DAY_MS),
      })
    );
    expect(result.currentPriceCents).toBe(5800);
    expect(result.nextDropAt).toBeNull();
  });
});

describe('buildDecliningPriceSchedulePreview', () => {
  it('collapses a long schedule to start, first drop, and floor with truncated=true', () => {
    const preview = buildDecliningPriceSchedulePreview(input());
    expect(preview.truncated).toBe(true);
    expect(preview.steps).toEqual([
      { priceCents: 6000, dropAt: null, isFloor: false },
      { priceCents: 5500, dropAt: new Date(SCHEDULE_START.getTime() + 7 * DAY_MS), isFloor: false },
      { priceCents: 3000, dropAt: new Date(SCHEDULE_START.getTime() + 6 * 7 * DAY_MS), isFloor: true },
    ]);
  });

  it('returns every step without truncation when 3 or fewer drops reach the floor', () => {
    const preview = buildDecliningPriceSchedulePreview(
      input({ floorPriceCents: 4500 }) // (6000 - 4500) / 500 = 3 steps
    );
    expect(preview.truncated).toBe(false);
    expect(preview.steps).toEqual([
      { priceCents: 6000, dropAt: null, isFloor: false },
      { priceCents: 5500, dropAt: new Date(SCHEDULE_START.getTime() + 7 * DAY_MS), isFloor: false },
      { priceCents: 5000, dropAt: new Date(SCHEDULE_START.getTime() + 2 * 7 * DAY_MS), isFloor: false },
      { priceCents: 4500, dropAt: new Date(SCHEDULE_START.getTime() + 3 * 7 * DAY_MS), isFloor: true },
    ]);
  });

  it('lands on the floor in a single step when the decrement overshoots it', () => {
    const preview = buildDecliningPriceSchedulePreview(input({ floorPriceCents: 5800 }));
    expect(preview.truncated).toBe(false);
    expect(preview.steps).toEqual([
      { priceCents: 6000, dropAt: null, isFloor: false },
      { priceCents: 5800, dropAt: new Date(SCHEDULE_START.getTime() + 7 * DAY_MS), isFloor: true },
    ]);
  });

  it('falls back to just the starting price when the decrement is not yet entered', () => {
    const preview = buildDecliningPriceSchedulePreview(input({ decrementCents: 0 }));
    expect(preview).toEqual({ steps: [{ priceCents: 6000, dropAt: null, isFloor: false }], truncated: false });
  });

  it('falls back to just the starting price when the floor has not been set below the start', () => {
    const preview = buildDecliningPriceSchedulePreview(input({ floorPriceCents: 6000 }));
    expect(preview).toEqual({ steps: [{ priceCents: 6000, dropAt: null, isFloor: false }], truncated: false });
  });
});

describe('validateDecliningSchedule', () => {
  const valid = {
    startingPriceCents: 6000,
    floorPriceCents: 3000,
    decrementCents: 500,
    dropIntervalDays: 7,
  };

  it('accepts a fully-specified, internally consistent schedule', () => {
    expect(validateDecliningSchedule(valid)).toEqual({ valid: true, error: null });
  });

  it('does not error on a pristine, not-yet-filled-in form', () => {
    expect(validateDecliningSchedule({ startingPriceCents: 0, floorPriceCents: 0, decrementCents: 0, dropIntervalDays: 0 })).toEqual({
      valid: false,
      error: null,
    });
  });

  it('rejects a floor price below the platform minimum once entered', () => {
    expect(validateDecliningSchedule({ ...valid, floorPriceCents: 10 })).toEqual({
      valid: false,
      error: 'Floor price is below the minimum allowed price',
    });
  });

  it('rejects a floor price at or above the starting price', () => {
    expect(validateDecliningSchedule({ ...valid, floorPriceCents: 6000 })).toEqual({
      valid: false,
      error: 'Floor price must be lower than the starting price',
    });
  });

  it('rejects a non-integer decrement', () => {
    expect(validateDecliningSchedule({ ...valid, decrementCents: 500.5 })).toEqual({
      valid: false,
      error: 'Price drop must be a positive amount',
    });
  });

  it('rejects a drop interval outside the allowed range', () => {
    expect(validateDecliningSchedule({ ...valid, dropIntervalDays: 91 })).toEqual({
      valid: false,
      error: 'Drop interval must be between 1 and 90 days',
    });
  });
});
