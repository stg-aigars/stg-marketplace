/**
 * The single choke point for gateway refunds.
 *
 * Every refund path in the marketplace — seller decline, deadline auto-cancel,
 * dispute resolution, cart rollback, callback mismatch — converges on
 * EveryPay's refund primitive. This module wraps it so that the two things
 * that used to be missing happen exactly once, for every path, including
 * paths that do not exist yet:
 *
 *   1. Non-refundable payments are recognised (preemptively by payment method,
 *      and defensively by EveryPay error code) and reported as needing a
 *      manual bank transfer instead of failing silently.
 *   2. An operator email goes to the ops inbox on EVERY refund, whatever the
 *      outcome — so a quiet inbox means "no refunds happened", not "the refund
 *      path stopped firing".
 *
 * Adding the email or the detection per call site is how the sixth refund path
 * ships without either. Add refund paths on top of this function.
 */

import * as Sentry from '@sentry/nextjs';
import { refundPayment } from '@/lib/services/everypay/client';
import { sendRefundOperatorAlert } from '@/lib/email';
import {
  blockedReasonForEveryPayCode,
  classifyRefundability,
  type RefundBlockedReason,
} from './refundability';

export type GatewayRefundOutcome =
  /** Money left the gateway. Nothing further to do. */
  | { status: 'refunded'; amountCents: number }
  /** The rail cannot be reversed — a human must send the transfer. */
  | {
      status: 'manual_required';
      amountCents: number;
      reason: RefundBlockedReason;
      failureCode: number | null;
      failureMessage: string | null;
    }
  /** Ordinary failure (network, gateway error). Retryable. */
  | {
      status: 'failed';
      amountCents: number;
      failureCode: number | null;
      failureMessage: string;
    };

export interface GatewayRefundRequest {
  paymentReference: string;
  amountCents: number;
  /** orders.payment_method. Null/unknown routes to manual review by design. */
  paymentMethod: string | null | undefined;
  /** Why the refund is owed, e.g. 'seller declined'. Shown in the operator email. */
  reason: string;
  /**
   * The order this refund belongs to, when there is one. Cart-level refunds
   * (order_reference mismatch, all items unavailable) fire before any order
   * exists — the operator email still goes out, keyed on the payment reference.
   */
  order?: {
    id: string;
    orderNumber: string;
    buyerName?: string | null;
  } | null;
}

/**
 * Read an EveryPay refund response that came back HTTP-200 but did not
 * actually refund. EveryPay reports some rejections in the body rather than
 * as an error status — `transaction_result: "failed"` is how 4037 arrived for
 * order STG-20260816-HGBM. Anything else is treated as success: partial
 * refunds legitimately leave payment_state at a non-'refunded' value, so
 * payment_state is deliberately not used as a success test.
 */
function readBodyLevelFailure(
  response: unknown
): { code: number | null; message: string } | null {
  if (!response || typeof response !== 'object') return null;
  const body = response as Record<string, unknown>;

  const error = body.error;
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return {
      code: typeof e.code === 'number' ? e.code : null,
      message: typeof e.message === 'string' ? e.message : 'EveryPay refund rejected',
    };
  }

  if (body.transaction_result === 'failed') {
    return {
      code: typeof body.error_code === 'number' ? body.error_code : null,
      message:
        typeof body.error_message === 'string'
          ? body.error_message
          : 'EveryPay reported transaction_result=failed',
    };
  }

  return null;
}

/**
 * Read the gateway error code off a thrown error.
 *
 * Structural rather than `instanceof EveryPayError`: the class identity is not
 * reliable across module boundaries (a duplicated module instance in a bundle,
 * or a partially-mocked client in tests, both break it), and a missed code
 * would silently demote a 4037 block to an ordinary retryable failure — the
 * exact silence this module exists to remove.
 */
function errorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

/**
 * Attempt a gateway refund, classify the outcome, and notify operations.
 *
 * Never throws: every path returns an outcome the caller can persist. The
 * operator email is fire-and-forget — a Resend outage must never reverse or
 * block a refund that already succeeded.
 */
export async function attemptGatewayRefund(
  request: GatewayRefundRequest
): Promise<GatewayRefundOutcome> {
  const { paymentReference, amountCents, paymentMethod, reason, order } = request;

  const verdict = classifyRefundability(paymentMethod);

  // Preemptive block: don't call a gateway we know will reject.
  if (!verdict.refundable) {
    if (verdict.reason === 'unknown_payment_method') {
      console.warn(
        `[Refund] Unrecognised payment method "${paymentMethod ?? 'null'}" for ${paymentReference} — routing to manual review`
      );
      Sentry.captureMessage(`Refund blocked: unrecognised payment method`, {
        level: 'warning',
        tags: { paymentReference, phase: 'refund_unknown_payment_method' },
        extra: { paymentMethod, amountCents, reason, orderNumber: order?.orderNumber },
      });
    }

    const outcome: GatewayRefundOutcome = {
      status: 'manual_required',
      amountCents,
      reason: verdict.reason,
      failureCode: null,
      failureMessage: null,
    };
    notifyOperations(request, outcome);
    return outcome;
  }

  let outcome: GatewayRefundOutcome;
  try {
    const response = await refundPayment(paymentReference, amountCents);

    const bodyFailure = readBodyLevelFailure(response);
    if (bodyFailure) {
      const blockedReason = blockedReasonForEveryPayCode(bodyFailure.code);
      outcome = blockedReason
        ? {
            status: 'manual_required',
            amountCents,
            reason: blockedReason,
            failureCode: bodyFailure.code,
            failureMessage: bodyFailure.message,
          }
        : {
            status: 'failed',
            amountCents,
            failureCode: bodyFailure.code,
            failureMessage: bodyFailure.message,
          };
    } else {
      outcome = { status: 'refunded', amountCents };
    }
  } catch (error) {
    const code = errorCode(error);
    const message = error instanceof Error ? error.message : String(error);
    const blockedReason = blockedReasonForEveryPayCode(code);

    outcome = blockedReason
      ? {
          status: 'manual_required',
          amountCents,
          reason: blockedReason,
          failureCode: code,
          failureMessage: message,
        }
      : { status: 'failed', amountCents, failureCode: code, failureMessage: message };
  }

  if (outcome.status === 'failed') {
    console.error(
      `[Refund] Gateway refund failed for ${paymentReference} (${reason}): ${outcome.failureMessage}`
    );
    Sentry.captureException(new Error(`Gateway refund failed: ${outcome.failureMessage}`), {
      tags: { paymentReference, phase: 'gateway_refund_failed' },
      extra: { amountCents, reason, orderNumber: order?.orderNumber, code: outcome.failureCode },
    });
  } else if (outcome.status === 'manual_required') {
    console.warn(
      `[Refund] MANUAL TRANSFER REQUIRED for ${paymentReference} (${reason}): ${outcome.reason}`
    );
  }

  notifyOperations(request, outcome);
  return outcome;
}

/**
 * Fire-and-forget operator email. Unconditional by design: an alert that only
 * arrives when something breaks trains you to ignore a silent inbox and gives
 * no signal when the refund path itself stops firing. At current volume
 * (3 refunds in 4 months) one email per refund is nowhere near noisy.
 */
function notifyOperations(
  request: GatewayRefundRequest,
  outcome: GatewayRefundOutcome
): void {
  void sendRefundOperatorAlert({
    outcome: outcome.status,
    amountCents: outcome.amountCents,
    paymentMethod: request.paymentMethod ?? null,
    paymentReference: request.paymentReference,
    refundReason: request.reason,
    orderId: request.order?.id ?? null,
    orderNumber: request.order?.orderNumber ?? null,
    buyerName: request.order?.buyerName ?? null,
    blockedReason: outcome.status === 'manual_required' ? outcome.reason : null,
    failureCode: outcome.status === 'refunded' ? null : outcome.failureCode,
    failureMessage: outcome.status === 'refunded' ? null : outcome.failureMessage,
  }).catch((err) => console.error('[Refund] Failed to send operator refund alert:', err));
}
