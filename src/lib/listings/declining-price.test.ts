import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeDecliningPrice } from './declining-price';

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
