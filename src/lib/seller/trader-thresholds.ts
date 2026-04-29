/**
 * Trader-volume detection thresholds (PTAC §6.1, lawyer correspondence 2026-04-28).
 *
 * Architecture: counters are advisory at launch. The cron writes counters,
 * fires `seller.trader_signal_crossed` when the verification trigger is first
 * crossed, and the staff dashboard surfaces the signal — but `seller_status`
 * is **never** auto-mutated. Suspension is purely a staff decision after the
 * soft-touch verification workflow.
 *
 * To flip enforcement to automatic later (e.g. if PTAC opens an inquiry citing
 * trader-status concerns), change `enforcement` from `'advisory'` to
 * `'automatic'` and the `trader-signals` cron's unreachable branch becomes
 * the active path. The unreachable branch is unit-tested in
 * `trader-thresholds.test.ts` so the flip is a one-line constant change.
 *
 * Memo of record: docs/legal_audit/trader-detection-deferral.md
 */
export const TRADER_THRESHOLDS = {
  version: '2026-04-28-v2',

  // Advisory at launch per lawyer correspondence.
  enforcement: 'advisory' as 'advisory' | 'automatic',

  // Lawyer's number: 25 sales as verification trigger (5-sale buffer below DAC7's 30).
  // Revenue: lawyer was silent; STG decision (2026-04-28) mirrors DAC7's €2,000 minus
  // a 200 buffer = €1,800. Fires on whichever crosses first.
  verificationTrigger: { salesCount: 25, revenueCents: 180_000 },

  // No suspendThreshold by design — suspension is purely a staff decision after
  // verification, with verification_response as evidence. The constant exists
  // with explicit null so a future contributor doesn't add one without
  // re-reading the deferral memo.
  suspendThreshold: null as null | { salesCount: number; revenueCents: number },

  // Days between verification email send and unresponsive-escalation
  verificationResponseDeadlineDays: 14,
} as const;

export type TraderSignalTier = 'verify' | null;

export interface TraderCounters {
  count: number;
  revenueCents: number;
}

/**
 * Pure evaluation: given counters, returns whether the seller has crossed the
 * verification trigger and (for future-flip) what tier under automatic enforcement.
 *
 * Returns null if under threshold; 'verify' if past either component of the
 * verification trigger.
 */
export function evaluateTraderSignal(counters: TraderCounters): TraderSignalTier {
  const { salesCount, revenueCents } = TRADER_THRESHOLDS.verificationTrigger;
  if (counters.count >= salesCount || counters.revenueCents >= revenueCents) {
    return 'verify';
  }
  return null;
}

/**
 * Identify which component of the verification trigger fired (or both).
 * Useful for audit metadata when `seller.trader_signal_crossed` lands.
 */
export function triggeredBy(counters: TraderCounters): 'sales' | 'revenue' | 'both' | null {
  const { salesCount, revenueCents } = TRADER_THRESHOLDS.verificationTrigger;
  const salesPast = counters.count >= salesCount;
  const revenuePast = counters.revenueCents >= revenueCents;
  if (salesPast && revenuePast) return 'both';
  if (salesPast) return 'sales';
  if (revenuePast) return 'revenue';
  return null;
}
