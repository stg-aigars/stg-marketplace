/**
 * KYC / compliance gate (PR #2).
 *
 * Triggered for type C.4 (wallet withdrawal) only. Reads
 * counterparties.legal_compliance_status (passed in by caller — engine has
 * already loaded the row) and rejects unless 'ok' or 'dormant'.
 *
 * Status meanings (from migration 093 CHECK constraint):
 *
 *   ok               — clear to payout
 *   pending_kyc      — DAC7 collection trigger crossed, blocked until TIN provided
 *   dac7_blocked     — DAC7 hard limit (30 tx OR €2k) reached, listings + payouts blocked
 *   negative_wallet  — seller's 2352 receivable is non-zero; payouts blocked until cleared
 *   suspended        — staff manual suspension
 *   dormant          — 12mo inactivity; NOT a payout block — reactivating dormant
 *                      sellers can withdraw if KYC is otherwise clean. Documented
 *                      decision in plan-first preamble §(f).
 *
 * Accepted TOCTOU race: gate reads the snapshot loaded earlier in emit().
 * Status could flip between snapshot and RPC commit. Window is milliseconds;
 * compliance transitions originate from staff actions or daily cron (never
 * real-time fraud signals); any stale-status withdrawal is reversible via
 * manual posting with audit-trail evidence.
 *
 * The gate is a pure function — engine passes in the already-loaded row,
 * which avoids a redundant DB roundtrip and makes the function
 * unit-testable without a Supabase mock.
 */

import { PostingComplianceGateError, type PostingComplianceGateCode } from './errors';
import type { CounterpartyComplianceStatus, CounterpartyRow } from './types';

const BLOCKING_STATUSES: ReadonlyArray<CounterpartyComplianceStatus> = [
  'pending_kyc',
  'dac7_blocked',
  'negative_wallet',
  'suspended'
];

/**
 * Map blocking compliance status → error code.
 * `pending_kyc` is renamed to `kyc_gate` for ergonomic UI handling (the
 * status name is internal; UI surfaces 'kyc_gate' as a generic onboarding
 * prompt). The other three pass through 1:1.
 */
const STATUS_TO_CODE: Record<string, PostingComplianceGateCode> = {
  pending_kyc: 'kyc_gate',
  dac7_blocked: 'dac7_blocked',
  negative_wallet: 'negative_wallet',
  suspended: 'suspended'
};

export function assertPayoutAllowed(counterparty: CounterpartyRow | null): void {
  if (!counterparty) {
    throw new PostingComplianceGateError({
      code: 'counterparty_not_found',
      reason: 'C.4 wallet withdrawal requires a counterparty; received null'
    });
  }

  const status = counterparty.legal_compliance_status;
  if (status === 'ok' || status === 'dormant') {
    return; // payout allowed
  }
  if (BLOCKING_STATUSES.includes(status)) {
    throw new PostingComplianceGateError({
      code: STATUS_TO_CODE[status] ?? 'kyc_gate',
      reason: `Withdrawal blocked: legal_compliance_status='${status}'`,
      context: { counterparty_id: counterparty.id, status }
    });
  }
  // Defensive — unreachable given the CHECK constraint, but a future status
  // value added without updating this function would land here.
  throw new PostingComplianceGateError({
    code: 'kyc_gate',
    reason: `Unhandled legal_compliance_status='${status as string}'`,
    context: { counterparty_id: counterparty.id, status }
  });
}
