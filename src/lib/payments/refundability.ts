/**
 * Which payments can be reversed through the EveryPay refund API, and which
 * need a human to move the money.
 *
 * Card payments are pull transactions and reverse on the card rail. Bank-link
 * (open banking) payments are SEPA credit transfers pushed from the buyer's
 * bank — there is no rail to reverse, and EveryPay answers a refund attempt
 * with error code 4037. Those refunds are settled by manual bank transfer.
 *
 * Pure module: no I/O, no Sentry, no side effects. Callers that need to warn
 * on an unrecognised method do so at the boundary (see refund-gateway.ts).
 */

/**
 * EveryPay error code for "Open banking payments cannot be refunded".
 * Matched on the code rather than the message — the message is localisable,
 * the code is stable.
 */
export const EVERYPAY_NON_REFUNDABLE_ERROR_CODE = 4037;

/** Written to orders.refund_blocked_reason. */
export type RefundBlockedReason =
  /** Open-banking rail is irreversible — settle by manual bank transfer. */
  | 'open_banking_not_refundable'
  /** payment_method absent or unrecognised. Routed to manual review by design. */
  | 'unknown_payment_method';

export type RefundabilityVerdict =
  | { refundable: true }
  | { refundable: false; reason: RefundBlockedReason };

/**
 * Payment methods the EveryPay refund API can reverse.
 *
 * `wallet` is listed for completeness — a wallet-funded order has no card leg,
 * so it never reaches the gateway — but classifying it as refundable keeps the
 * predicate honest about what "the API can handle this" means.
 */
const API_REFUNDABLE_METHODS: ReadonlySet<string> = new Set(['card', 'wallet']);

/** Payment methods known to be irreversible through the gateway. */
const NON_REFUNDABLE_METHODS: ReadonlySet<string> = new Set(['bank_link']);

/**
 * Classify a payment method for gateway refundability.
 *
 * Unknown and missing values resolve to `unknown_payment_method`, NOT to
 * refundable. An unknown method routed to manual review costs a staff glance;
 * one assumed refundable is a silent no-op that leaves a buyer without their
 * money — which is exactly the failure this module exists to stop. EveryPay
 * keeps adding methods (Apple Pay, Google Pay, BNPL) and each arrives here
 * before anyone has decided how it refunds.
 */
export function classifyRefundability(
  paymentMethod: string | null | undefined
): RefundabilityVerdict {
  if (paymentMethod && API_REFUNDABLE_METHODS.has(paymentMethod)) {
    return { refundable: true };
  }
  if (paymentMethod && NON_REFUNDABLE_METHODS.has(paymentMethod)) {
    return { refundable: false, reason: 'open_banking_not_refundable' };
  }
  return { refundable: false, reason: 'unknown_payment_method' };
}

/** Convenience boolean form of {@link classifyRefundability}. */
export function isApiRefundable(paymentMethod: string | null | undefined): boolean {
  return classifyRefundability(paymentMethod).refundable;
}

/**
 * Map an EveryPay refund error code to a blocked reason.
 *
 * Defensive counterpart to the preemptive {@link classifyRefundability} check:
 * EveryPay may extend the non-refundable set to methods we still classify as
 * refundable, and that must land in the staff queue rather than as a bare
 * failure. Returns null for codes that are ordinary failures (retryable, or a
 * genuine error) rather than a permanently irreversible rail.
 */
export function blockedReasonForEveryPayCode(
  code: number | null | undefined
): RefundBlockedReason | null {
  return code === EVERYPAY_NON_REFUNDABLE_ERROR_CODE
    ? 'open_banking_not_refundable'
    : null;
}

/** Human-readable label for a blocked reason — used in staff UI and emails. */
export const REFUND_BLOCKED_REASON_LABELS: Record<RefundBlockedReason, string> = {
  open_banking_not_refundable:
    'Bank-link payment — the open banking rail cannot be reversed by the gateway',
  unknown_payment_method:
    'Unrecognised payment method — routed to manual review rather than assumed refundable',
};
