/**
 * Refund scenario tests (J1-J6).
 *
 * Tests the refundOrder function from order-refund.ts:
 * card-only, wallet-only, split, partial failure, and idempotency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockRefundPayment = vi.fn();
const mockRefundToWallet = vi.fn();
const mockLogAuditEvent = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('@/lib/services/everypay/client', () => ({
  refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
}));
vi.mock('@/lib/services/wallet', () => ({
  refundToWallet: (...args: unknown[]) => mockRefundToWallet(...args),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryBuilder() {
  const builder: Record<string, unknown> = {};
  const chainMethods = ['update', 'eq', 'select', 'single'];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: null, error: null });
  return builder;
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    buyer_id: 'buyer-1',
    total_amount_cents: 3000,
    buyer_wallet_debit_cents: 0,
    payment_method: 'card' as const,
    everypay_payment_reference: 'ep-ref-1',
    order_number: 'STG-20260413-001',
    refund_status: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('refundOrder', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up the mock supabase client for order updates
    const { createServiceClient } = await import('@/lib/supabase');
    const mockSupabase = {
      from: vi.fn(() => makeQueryBuilder()),
    };
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
  });

  it('J1: card-only refund -> refundPayment called with full amount', async () => {
    const { refundOrder } = await import('./../../lib/services/order-refund');

    const order = makeOrder({
      total_amount_cents: 3000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'ep-ref-1',
    });

    mockRefundPayment.mockResolvedValue(undefined);

    const result = await refundOrder('order-1', order);

    expect(result.cardRefunded).toBe(3000);
    expect(result.walletRefunded).toBe(0);
    expect(mockRefundPayment).toHaveBeenCalledWith('ep-ref-1', 3000);
    expect(mockRefundToWallet).not.toHaveBeenCalled();
  });

  it('J2: wallet-only refund -> refundToWallet called with full amount', async () => {
    const { refundOrder } = await import('./../../lib/services/order-refund');

    const order = makeOrder({
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 2000,
      payment_method: 'wallet',
      everypay_payment_reference: null, // no card payment
    });

    mockRefundToWallet.mockResolvedValue(undefined);

    const result = await refundOrder('order-2', order);

    expect(result.cardRefunded).toBe(0);
    expect(result.walletRefunded).toBe(2000);
    expect(mockRefundPayment).not.toHaveBeenCalled();
    expect(mockRefundToWallet).toHaveBeenCalledWith(
      'buyer-1',
      2000,
      'order-2',
      'Refund: STG-20260413-001'
    );
  });

  it('J3: split refund -> both card and wallet legs processed with correct amounts', async () => {
    const { refundOrder } = await import('./../../lib/services/order-refund');

    // Total = 5000, wallet = 1500, card = 3500
    const order = makeOrder({
      total_amount_cents: 5000,
      buyer_wallet_debit_cents: 1500,
      payment_method: 'card',
      everypay_payment_reference: 'ep-ref-3',
    });

    mockRefundPayment.mockResolvedValue(undefined);
    mockRefundToWallet.mockResolvedValue(undefined);

    const result = await refundOrder('order-3', order);

    expect(result.cardRefunded).toBe(3500); // total - walletDebit
    expect(result.walletRefunded).toBe(1500);
    expect(mockRefundPayment).toHaveBeenCalledWith('ep-ref-3', 3500);
    expect(mockRefundToWallet).toHaveBeenCalledWith(
      'buyer-1',
      1500,
      'order-3',
      'Refund: STG-20260413-001'
    );
  });

  it('J4: partial failure -> card refund fails, wallet succeeds -> PARTIAL status', async () => {
    const { refundOrder, REFUND_STATUS } = await import('./../../lib/services/order-refund');

    const order = makeOrder({
      total_amount_cents: 5000,
      buyer_wallet_debit_cents: 1500,
      payment_method: 'card',
      everypay_payment_reference: 'ep-ref-4',
    });

    // Card refund fails
    mockRefundPayment.mockRejectedValue(new Error('EveryPay timeout'));
    // Wallet refund succeeds
    mockRefundToWallet.mockResolvedValue(undefined);

    // Track what gets written to the orders table
    const updateData: Record<string, unknown>[] = [];
    const { createServiceClient } = await import('@/lib/supabase');
    const mockBuilder = makeQueryBuilder();
    mockBuilder.update = vi.fn((data: Record<string, unknown>) => {
      updateData.push(data);
      return mockBuilder;
    });
    const mockSupabase = { from: vi.fn(() => mockBuilder) };
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await refundOrder('order-4', order);

    // Card leg failed, wallet succeeded
    expect(result.cardRefunded).toBe(0);
    expect(result.walletRefunded).toBe(1500);

    // Order updated with partial status
    const refundUpdate = updateData.find((d) => d.refund_status);
    expect(refundUpdate).toBeDefined();
    expect(refundUpdate!.refund_status).toBe(REFUND_STATUS.PARTIAL);
    expect(refundUpdate!.refund_amount_cents).toBe(1500); // only wallet portion
  });

  it('J4b: both legs fail -> no refund_status written (allows retry)', async () => {
    const { refundOrder } = await import('./../../lib/services/order-refund');

    const order = makeOrder({
      total_amount_cents: 5000,
      buyer_wallet_debit_cents: 1500,
      payment_method: 'card',
      everypay_payment_reference: 'ep-ref-4b',
    });

    mockRefundPayment.mockRejectedValue(new Error('EveryPay timeout'));
    mockRefundToWallet.mockRejectedValue(new Error('Wallet service down'));

    const updateData: Record<string, unknown>[] = [];
    const { createServiceClient } = await import('@/lib/supabase');
    const mockBuilder = makeQueryBuilder();
    mockBuilder.update = vi.fn((data: Record<string, unknown>) => {
      updateData.push(data);
      return mockBuilder;
    });
    const mockSupabase = { from: vi.fn(() => mockBuilder) };
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await refundOrder('order-4b', order);

    expect(result.cardRefunded).toBe(0);
    expect(result.walletRefunded).toBe(0);
    // No refund_status written — allows cron retry
    expect(updateData).toHaveLength(0);
  });

  it('J6: double refund idempotency -> already completed returns {0,0} immediately', async () => {
    const { refundOrder } = await import('./../../lib/services/order-refund');

    const order = makeOrder({
      total_amount_cents: 3000,
      buyer_wallet_debit_cents: 0,
      refund_status: 'completed', // already refunded
    });

    const result = await refundOrder('order-6', order);

    expect(result.cardRefunded).toBe(0);
    expect(result.walletRefunded).toBe(0);
    // Neither refund method should be called
    expect(mockRefundPayment).not.toHaveBeenCalled();
    expect(mockRefundToWallet).not.toHaveBeenCalled();
  });
});
