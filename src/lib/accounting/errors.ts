/**
 * Posting engine typed errors (PR #2).
 *
 * Three error families:
 *
 *   PostingValidationError       — caller's PostingEvent is malformed (missing
 *                                  required keys, wrong shape, no matching
 *                                  type, vat_rate not found for posting_date,
 *                                  etc.). 4xx-equivalent for callers.
 *
 *   PostingComplianceGateError   — type C.4 payout blocked by counterparty's
 *                                  legal_compliance_status. Surfaced to UI as
 *                                  user-friendly error per status code.
 *
 *   PostingIdempotencyConflict   — defensive escape hatch. Should never throw
 *                                  in normal operation. If it does, the DB
 *                                  UNIQUE violation fired but the engine's
 *                                  recovery SELECT couldn't find the winner's
 *                                  committed row. Indicates a data-integrity
 *                                  bug (e.g. concurrent index rebuild). Alert
 *                                  via Sentry critical and surface as 5xx.
 */

interface PostingErrorOptions<TCode extends string = string> {
  code: TCode;
  reason: string;
  context?: Record<string, unknown>;
}

abstract class PostingErrorBase<TCode extends string = string> extends Error {
  readonly code: TCode;
  readonly reason: string;
  readonly context: Record<string, unknown>;

  constructor(name: string, opts: PostingErrorOptions<TCode>) {
    super(`${name}[${opts.code}]: ${opts.reason}`);
    this.name = name;
    this.code = opts.code;
    this.reason = opts.reason;
    this.context = opts.context ?? {};
  }
}

export type PostingValidationCode =
  | 'missing_required_key'
  | 'invalid_event_shape'
  | 'no_matching_type'
  | 'vat_rate_not_found'
  | 'invalid_payload_value'
  | 'counterparty_not_found'
  | 'unbalanced_lines'
  /**
   * Reserved for engine-internal invariant violations (compute() called
   * without vat_rate, counterparty unexpectedly null after dispatch, etc.).
   * Distinguishable from caller-input failures so on-call paging / metrics
   * can route differently.
   */
  | 'engine_invariant';

export class PostingValidationError extends PostingErrorBase<PostingValidationCode> {
  constructor(opts: PostingErrorOptions<PostingValidationCode>) {
    super('PostingValidationError', opts);
  }
}

/**
 * KYC/compliance-gate codes — match the legal_compliance_status values that
 * block payouts. `dormant` is a marketplace-state signal, NOT a payout block;
 * it is intentionally absent from this list per the architecture decision in
 * PR #2's plan-first preamble.
 */
export type PostingComplianceGateCode =
  | 'kyc_gate'           // legal_compliance_status='pending_kyc'
  | 'dac7_blocked'       // legal_compliance_status='dac7_blocked'
  | 'negative_wallet'    // legal_compliance_status='negative_wallet'
  | 'suspended'          // legal_compliance_status='suspended'
  | 'counterparty_not_found';

export class PostingComplianceGateError extends PostingErrorBase<PostingComplianceGateCode> {
  constructor(opts: PostingErrorOptions<PostingComplianceGateCode>) {
    super('PostingComplianceGateError', opts);
  }
}

export type PostingIdempotencyConflictCode = 'unrecoverable_unique_violation';

export class PostingIdempotencyConflict extends PostingErrorBase<PostingIdempotencyConflictCode> {
  constructor(opts: PostingErrorOptions<PostingIdempotencyConflictCode>) {
    super('PostingIdempotencyConflict', opts);
  }
}
