import { MIN_PRICE_CENTS } from './types';

/** Bounds for declining-price schedule inputs, enforced at create time. */
export const MIN_DROP_INTERVAL_DAYS = 1;
export const MAX_DROP_INTERVAL_DAYS = 90;
export const DEFAULT_DROP_INTERVAL_DAYS = 7;

export const DROP_INTERVAL_OPTIONS = [
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
];

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

export interface DecliningPriceScheduleStep {
  priceCents: number;
  /** Null for the starting step ("today") — every later step has a drop date. */
  dropAt: Date | null;
  isFloor: boolean;
}

export interface DecliningPriceSchedulePreview {
  steps: DecliningPriceScheduleStep[];
  /** True when intermediate steps were collapsed — render an ellipsis between the second and last step. */
  truncated: boolean;
}

/**
 * Builds a compact preview of the price schedule for the sell-flow UI: the
 * starting price, the first scheduled drop, and the floor. Intermediate
 * steps are collapsed behind `truncated` rather than materialized — a tiny
 * decrement against a wide starting-to-floor range can imply hundreds of
 * thousands of steps, which is fine for the cron's elapsed-time math but not
 * for building an array to render.
 */
export function buildDecliningPriceSchedulePreview({
  startingPriceCents,
  floorPriceCents,
  decrementCents,
  dropIntervalDays,
  scheduleStartAt,
}: Pick<
  DecliningPriceInput,
  'startingPriceCents' | 'floorPriceCents' | 'decrementCents' | 'dropIntervalDays' | 'scheduleStartAt'
>): DecliningPriceSchedulePreview {
  const startStep: DecliningPriceScheduleStep = { priceCents: startingPriceCents, dropAt: null, isFloor: false };

  if (decrementCents <= 0 || floorPriceCents >= startingPriceCents) {
    return { steps: [startStep], truncated: false };
  }

  const totalSteps = Math.ceil((startingPriceCents - floorPriceCents) / decrementCents);
  const intervalMs = dropIntervalDays * 24 * 60 * 60 * 1000;

  const stepAt = (step: number): DecliningPriceScheduleStep => ({
    priceCents: step >= totalSteps ? floorPriceCents : startingPriceCents - step * decrementCents,
    dropAt: new Date(scheduleStartAt.getTime() + step * intervalMs),
    isFloor: step >= totalSteps,
  });

  if (totalSteps <= 3) {
    return { steps: [startStep, ...Array.from({ length: totalSteps }, (_, i) => stepAt(i + 1))], truncated: false };
  }

  return { steps: [startStep, stepAt(1), stepAt(totalSteps)], truncated: true };
}

export interface DecliningScheduleValidation {
  valid: boolean;
  error: string | null;
}

/**
 * Client-side mirror of the validation block in `createListing`
 * (src/lib/listings/actions.ts). Tolerant of partially-filled state — only
 * reports an error once fields hold values that genuinely contradict each
 * other, so the form doesn't flash errors before the seller has finished
 * typing. `valid` is the authoritative "ready to submit" signal; the server
 * action re-validates and remains the source of truth.
 */
export function validateDecliningSchedule({
  startingPriceCents,
  floorPriceCents,
  decrementCents,
  dropIntervalDays,
}: {
  startingPriceCents: number;
  floorPriceCents: number;
  decrementCents: number;
  dropIntervalDays: number;
}): DecliningScheduleValidation {
  if (floorPriceCents > 0 && floorPriceCents < MIN_PRICE_CENTS) {
    return { valid: false, error: 'Floor price is below the minimum allowed price' };
  }
  if (floorPriceCents > 0 && startingPriceCents > 0 && floorPriceCents >= startingPriceCents) {
    return { valid: false, error: 'Floor price must be lower than the starting price' };
  }
  if (decrementCents > 0 && !Number.isInteger(decrementCents)) {
    return { valid: false, error: 'Price drop must be a positive amount' };
  }
  if (
    dropIntervalDays > 0 &&
    (dropIntervalDays < MIN_DROP_INTERVAL_DAYS || dropIntervalDays > MAX_DROP_INTERVAL_DAYS)
  ) {
    return { valid: false, error: `Drop interval must be between ${MIN_DROP_INTERVAL_DAYS} and ${MAX_DROP_INTERVAL_DAYS} days` };
  }

  const complete =
    startingPriceCents >= MIN_PRICE_CENTS &&
    floorPriceCents >= MIN_PRICE_CENTS &&
    floorPriceCents < startingPriceCents &&
    Number.isInteger(decrementCents) &&
    decrementCents > 0 &&
    Number.isInteger(dropIntervalDays) &&
    dropIntervalDays >= MIN_DROP_INTERVAL_DAYS &&
    dropIntervalDays <= MAX_DROP_INTERVAL_DAYS;

  return { valid: complete, error: null };
}
