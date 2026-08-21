import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRefundPayment = vi.fn();
const mockSendOperatorAlert = vi.fn();

vi.mock('@/lib/services/everypay/client', async () => {
  class EveryPayError extends Error {
    constructor(
      message: string,
      public readonly code?: number,
      public readonly response?: unknown
    ) {
      super(message);
      this.name = 'EveryPayError';
    }
  }
  return {
    EveryPayError,
    refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
  };
});

vi.mock('@/lib/email', () => ({
  sendRefundOperatorAlert: (...args: unknown[]) => mockSendOperatorAlert(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import { attemptGatewayRefund } from './refund-gateway';
import { EveryPayError } from '@/lib/services/everypay/client';

const BASE = {
  paymentReference: 'ep_ref_1',
  amountCents: 2970,
  reason: 'seller declined',
  order: { id: 'order-1', orderNumber: 'STG-20260816-HGBM' },
};

/**
 * The operator email is fired with `void`, so it settles a microtask after the
 * call resolves. Wait for the expected count rather than guessing at ticks.
 */
const flushAlerts = (count: number) =>
  vi.waitFor(() => expect(mockSendOperatorAlert).toHaveBeenCalledTimes(count));

beforeEach(() => {
  vi.clearAllMocks();
  mockSendOperatorAlert.mockResolvedValue(undefined);
});

describe('attemptGatewayRefund — bank-link (preemptive block)', () => {
  it('does not call EveryPay at all', async () => {
    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'bank_link' });

    expect(mockRefundPayment).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: 'manual_required',
      amountCents: 2970,
      reason: 'open_banking_not_refundable',
      failureCode: null,
      failureMessage: null,
    });
  });

  it('sends the ACTION REQUIRED operator alert', async () => {
    await attemptGatewayRefund({ ...BASE, paymentMethod: 'bank_link' });
    await flushAlerts(1);

    expect(mockSendOperatorAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'manual_required',
        amountCents: 2970,
        paymentMethod: 'bank_link',
        paymentReference: 'ep_ref_1',
        orderNumber: 'STG-20260816-HGBM',
        blockedReason: 'open_banking_not_refundable',
      })
    );
  });
});

describe('attemptGatewayRefund — unknown payment method', () => {
  it('routes to manual review rather than attempting the refund', async () => {
    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: null });

    expect(mockRefundPayment).not.toHaveBeenCalled();
    expect(outcome.status).toBe('manual_required');
    if (outcome.status === 'manual_required') {
      expect(outcome.reason).toBe('unknown_payment_method');
    }
  });
});

describe('attemptGatewayRefund — card (regression guard)', () => {
  it('calls EveryPay with the payment reference and amount, and reports success', async () => {
    mockRefundPayment.mockResolvedValue({
      payment_reference: 'ep_ref_1',
      payment_state: 'refunded',
    });

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
    expect(mockRefundPayment).toHaveBeenCalledWith('ep_ref_1', 2970);
    expect(outcome).toEqual({ status: 'refunded', amountCents: 2970 });
  });

  it('sends the Completed operator alert on success', async () => {
    mockRefundPayment.mockResolvedValue({ payment_state: 'refunded' });

    await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });
    await flushAlerts(1);

    expect(mockSendOperatorAlert).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'refunded', blockedReason: null, failureCode: null })
    );
  });

  it('does not treat a non-refunded payment_state as failure (partial refunds)', async () => {
    mockRefundPayment.mockResolvedValue({ payment_state: 'settled', standing_amount: '5.00' });

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(outcome.status).toBe('refunded');
  });
});

describe('attemptGatewayRefund — 4037 arriving from the gateway', () => {
  it('maps a thrown EveryPayError with code 4037 to manual_required', async () => {
    mockRefundPayment.mockRejectedValue(
      new EveryPayError('Open banking payments cannot be refunded', 4037)
    );

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(outcome.status).toBe('manual_required');
    if (outcome.status === 'manual_required') {
      expect(outcome.reason).toBe('open_banking_not_refundable');
      expect(outcome.failureCode).toBe(4037);
      expect(outcome.failureMessage).toContain('cannot be refunded');
    }
  });

  it('maps a body-level {error:{code:4037}} to manual_required', async () => {
    mockRefundPayment.mockResolvedValue({
      payment_reference: 'ep_ref_1',
      error: { code: 4037, message: 'Open banking payments cannot be refunded' },
    });

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(outcome.status).toBe('manual_required');
    if (outcome.status === 'manual_required') {
      expect(outcome.failureCode).toBe(4037);
    }
  });

  it('maps a body-level transaction_result=failed with code 4037 to manual_required', async () => {
    mockRefundPayment.mockResolvedValue({
      payment_reference: 'ep_ref_1',
      transaction_result: 'failed',
      error_code: 4037,
      error_message: 'Open banking payments cannot be refunded',
    });

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(outcome.status).toBe('manual_required');
  });

  it('never throws — the caller always gets an outcome to persist', async () => {
    mockRefundPayment.mockRejectedValue(new EveryPayError('boom', 4037));
    await expect(
      attemptGatewayRefund({ ...BASE, paymentMethod: 'card' })
    ).resolves.toBeDefined();
  });
});

describe('attemptGatewayRefund — ordinary failures', () => {
  it('reports a non-4037 gateway error as failed, not manual_required', async () => {
    mockRefundPayment.mockRejectedValue(new EveryPayError('Gateway unreachable', 503));

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') {
      expect(outcome.failureCode).toBe(503);
    }
  });

  it('reports a body-level failure without a code as failed', async () => {
    mockRefundPayment.mockResolvedValue({ transaction_result: 'failed' });

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(outcome.status).toBe('failed');
  });

  it('handles a non-EveryPayError rejection', async () => {
    mockRefundPayment.mockRejectedValue(new Error('socket hang up'));

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') {
      expect(outcome.failureCode).toBeNull();
      expect(outcome.failureMessage).toBe('socket hang up');
    }
  });

  it('sends the Failed operator alert', async () => {
    mockRefundPayment.mockRejectedValue(new EveryPayError('Gateway unreachable', 503));

    await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });
    await flushAlerts(1);

    expect(mockSendOperatorAlert).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failed', failureCode: 503 })
    );
  });
});

describe('attemptGatewayRefund — operator email is unconditional and non-blocking', () => {
  it('fires on every outcome', async () => {
    mockRefundPayment.mockResolvedValue({ payment_state: 'refunded' });
    await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    mockRefundPayment.mockRejectedValue(new EveryPayError('nope', 500));
    await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });

    await attemptGatewayRefund({ ...BASE, paymentMethod: 'bank_link' });
    await flushAlerts(3);

    expect(mockSendOperatorAlert.mock.calls.map((c) => c[0].outcome)).toEqual([
      'refunded',
      'failed',
      'manual_required',
    ]);
  });

  it('does not reverse or block a successful refund when the email fails', async () => {
    mockRefundPayment.mockResolvedValue({ payment_state: 'refunded' });
    mockSendOperatorAlert.mockRejectedValue(new Error('Resend is down'));

    const outcome = await attemptGatewayRefund({ ...BASE, paymentMethod: 'card' });
    await flushAlerts(1);

    expect(outcome).toEqual({ status: 'refunded', amountCents: 2970 });
  });

  it('works without an order — cart-level refunds fire before any order exists', async () => {
    await attemptGatewayRefund({
      paymentReference: 'ep_ref_2',
      amountCents: 500,
      paymentMethod: 'bank_link',
      reason: 'cart amount mismatch',
    });
    await flushAlerts(1);

    expect(mockSendOperatorAlert).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: null, orderNumber: null, buyerName: null })
    );
  });
});
