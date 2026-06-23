/** Bounds for declining-price schedule inputs, enforced at create time. */
export const MIN_DROP_INTERVAL_DAYS = 1;
export const MAX_DROP_INTERVAL_DAYS = 90;
export const DEFAULT_DROP_INTERVAL_DAYS = 7;

export interface DecliningPriceInput {
  startingPriceCents: number;
  floorPriceCents: number;
  decrementCents: number;
  dropIntervalDays: number;
  scheduleStartAt: Date;
  now: Date;
}

export interface DecliningPriceResult {
  currentPriceCents: number;
  /** Null once the floor has been reached — there is no further drop to schedule. */
  nextDropAt: Date | null;
}

/**
 * Computes the current price and next drop time from elapsed time, not from
 * a single-step decrement. This makes the cron self-healing: a missed run
 * (downtime, backlog) is corrected on the next run by recomputing the full
 * number of elapsed intervals, rather than drifting behind schedule.
 */
export function computeDecliningPrice({
  startingPriceCents,
  floorPriceCents,
  decrementCents,
  dropIntervalDays,
  scheduleStartAt,
  now,
}: DecliningPriceInput): DecliningPriceResult {
  const intervalMs = dropIntervalDays * 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - scheduleStartAt.getTime();
  const steps = Math.max(0, Math.floor(elapsedMs / intervalMs));

  const currentPriceCents = Math.max(floorPriceCents, startingPriceCents - steps * decrementCents);

  const nextDropAt =
    currentPriceCents <= floorPriceCents
      ? null
      : new Date(scheduleStartAt.getTime() + (steps + 1) * intervalMs);

  return { currentPriceCents, nextDropAt };
}
