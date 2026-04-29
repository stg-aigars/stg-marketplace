import { describe, it, expect } from 'vitest';
import {
  TRADER_THRESHOLDS,
  evaluateTraderSignal,
  triggeredBy,
} from './trader-thresholds';

describe('TRADER_THRESHOLDS shape', () => {
  it('starts in advisory enforcement mode at launch (lawyer 2026-04-28)', () => {
    expect(TRADER_THRESHOLDS.enforcement).toBe('advisory');
  });

  it('uses the lawyer-specified 25-sale verification trigger', () => {
    expect(TRADER_THRESHOLDS.verificationTrigger.salesCount).toBe(25);
  });

  it('uses €1,800 revenue trigger (DAC7 minus 200 buffer per STG decision 2026-04-28)', () => {
    expect(TRADER_THRESHOLDS.verificationTrigger.revenueCents).toBe(180_000);
  });

  it('explicitly sets suspendThreshold to null (suspension is human decision)', () => {
    expect(TRADER_THRESHOLDS.suspendThreshold).toBeNull();
  });

  it('14-day verification response deadline', () => {
    expect(TRADER_THRESHOLDS.verificationResponseDeadlineDays).toBe(14);
  });
});

describe('evaluateTraderSignal', () => {
  it('returns null when both counters are under threshold', () => {
    expect(evaluateTraderSignal({ count: 5, revenueCents: 50_000 })).toBeNull();
    expect(evaluateTraderSignal({ count: 24, revenueCents: 179_999 })).toBeNull();
  });

  it('returns "verify" when sales count crosses (revenue under)', () => {
    expect(evaluateTraderSignal({ count: 25, revenueCents: 50_000 })).toBe('verify');
    expect(evaluateTraderSignal({ count: 100, revenueCents: 0 })).toBe('verify');
  });

  it('returns "verify" when revenue crosses (count under)', () => {
    expect(evaluateTraderSignal({ count: 3, revenueCents: 180_000 })).toBe('verify');
    expect(evaluateTraderSignal({ count: 1, revenueCents: 500_000 })).toBe('verify');
  });

  it('returns "verify" when both cross', () => {
    expect(evaluateTraderSignal({ count: 30, revenueCents: 200_000 })).toBe('verify');
  });
});

describe('triggeredBy', () => {
  it('returns null below threshold', () => {
    expect(triggeredBy({ count: 5, revenueCents: 50_000 })).toBeNull();
  });

  it('attributes correctly to sales when only sales crosses', () => {
    expect(triggeredBy({ count: 25, revenueCents: 100_000 })).toBe('sales');
  });

  it('attributes correctly to revenue when only revenue crosses', () => {
    expect(triggeredBy({ count: 10, revenueCents: 180_000 })).toBe('revenue');
  });

  it('attributes "both" when both cross simultaneously', () => {
    expect(triggeredBy({ count: 30, revenueCents: 250_000 })).toBe('both');
  });
});

describe('automatic enforcement future-flip path', () => {
  // The trader-signals cron has an unreachable branch that would mutate
  // seller_status when TRADER_THRESHOLDS.enforcement === 'automatic'. Today
  // that branch can't fire (advisory at launch) but it must remain syntactically
  // healthy and conceptually correct. This test fixes the "automatic" semantics:
  // a counter past the verification trigger still produces a 'verify' signal
  // regardless of enforcement mode — the difference is what the cron does
  // *with* that signal, not what evaluateTraderSignal returns.
  it('evaluateTraderSignal does not depend on enforcement mode', () => {
    // The function is pure over counters; enforcement is read elsewhere by the cron.
    expect(evaluateTraderSignal({ count: 25, revenueCents: 0 })).toBe('verify');
    // The constant value at runtime is 'advisory' — captured for the day the flip lands.
    expect(['advisory', 'automatic']).toContain(TRADER_THRESHOLDS.enforcement);
  });
});
