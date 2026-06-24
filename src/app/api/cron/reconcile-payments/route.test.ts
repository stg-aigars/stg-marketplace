/**
 * Reconcile-payments cron route tests — "stuck refund_status" alert section.
 *
 * Scope: this file only covers the third section added to the route (the
 * refund_status alert sweep). It does not exercise the cart-checkout-group
 * reconciliation or wallet-debit-retry sections — those query empty result
 * sets here so they no-op and don't interfere with the assertions below.
 *
 * Covers:
 *  - A `failed`/`partial` refund_status older than REFUND_ALERT_AGE_MS (1h)
 *    triggers exactly one digest email + one Sentry capture for the batch.
 *  - `completed` refund_status orders are excluded by the query predicate
 *    (`.in('refund_status', ['failed', 'partial'])`) — never appear in the
 *    alert.
 *  - A `failed` refund_status within the 1h grace period is not yet alerted.
 *  - An empty result set sends no email and fires no Sentry capture.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateServiceClient, mockSendEmail, mockSentryCaptureException } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockSendEmail: vi.fn(),
  mockSentryCaptureException: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    cron: { secret: 'test-secret' },
    app: { adminEmail: 'staff@secondturn.games' },
    resend: { fromEmail: 'noreply@secondturn.games' },
  },
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock('@/lib/email/service', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: mockSentryCaptureException,
}));

vi.mock('@/lib/services/everypay', () => ({
  getPaymentStatus: vi.fn(),
  SUCCESSFUL_STATES: new Set(['authorised', 'settled']),
  FAILED_STATES: new Set(['failed', 'voided']),
  mapEveryPayMethod: vi.fn(() => 'card'),
}));

vi.mock('@/lib/services/wallet', () => ({
  debitWallet: vi.fn(),
}));

vi.mock('@/lib/services/payment-fulfillment', () => ({
  fulfillCartPayment: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-24T12:00:00Z');

interface StuckRefundRow {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  refund_status: string;
  refund_amount_cents: number | null;
  total_amount_cents: number;
  updated_at: string;
}

function refundRow(opts: Partial<StuckRefundRow> & { id: string }): StuckRefundRow {
  return {
    order_number: `STG-${opts.id}`,
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    refund_status: 'failed',
    refund_amount_cents: 0,
    total_amount_cents: 5000,
    updated_at: new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago by default
    ...opts,
  };
}

// ---------------------------------------------------------------------------
// Supabase chainable mock
//
// Dispatches by table. The cart_checkout_groups and orders (wallet-mismatch)
// queries used by the earlier sections always resolve empty so those
// sections no-op. The stuck-refunds query is the second `.from('orders')`
// call in the route (select → in('refund_status', ...) → lt('updated_at',
// cutoff) → limit); we distinguish it from the wallet-mismatch
// `.from('orders')` call (select → eq → neq → not → gt → lt → limit) by
// tracking whether `.in('refund_status', ...)` was invoked on this chain.
//
// Crucially, the mock applies the `.in()` and `.lt()` predicates against the
// full fixture set itself (rather than the test pre-filtering), so tests
// that pass a `completed`-status row or a recently-updated `failed` row
// genuinely exercise the route's query construction — proving the predicate
// excludes them, not just that the happy path works.
// ---------------------------------------------------------------------------

function makeSupabaseMock(allOrders: StuckRefundRow[]) {
  function chain(table: string) {
    const builder: Record<string, unknown> = {};
    let isStuckRefundsQuery = false;
    let filtered = allOrders;

    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.neq = vi.fn(() => builder);
    builder.not = vi.fn(() => builder);
    builder.gt = vi.fn(() => builder);
    builder.in = vi.fn((col: string, values: string[]) => {
      if (table === 'orders' && col === 'refund_status') {
        isStuckRefundsQuery = true;
        filtered = filtered.filter((o) => values.includes(o.refund_status));
      }
      return builder;
    });
    builder.lt = vi.fn((col: string, cutoff: string) => {
      if (table === 'orders' && isStuckRefundsQuery && col === 'updated_at') {
        filtered = filtered.filter((o) => o.updated_at < cutoff);
      }
      return builder;
    });
    builder.update = vi.fn(() => builder);
    builder.limit = vi.fn(() => {
      const result =
        table === 'orders' && isStuckRefundsQuery
          ? { data: filtered, error: null }
          // cart_checkout_groups initial select or wallet-mismatch orders query.
          : { data: [], error: null };
      return {
        ...Promise.resolve(result),
        then: (resolve: (v: typeof result) => void) => resolve(result),
        returns: vi.fn(() => Promise.resolve(result)),
      };
    });

    return builder;
  }

  return {
    from: vi.fn((table: string) => chain(table)),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
}

function makeRequest(secret = 'test-secret'): Request {
  return new Request('http://localhost:3000/api/cron/reconcile-payments', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/cron/reconcile-payments — stuck refund_status alert', () => {
  it('returns 401 without the cron secret', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('alerts on a failed refund_status stuck past the 1h window', async () => {
    const stuck = [refundRow({ id: 'order-1', refund_status: 'failed' })];
    mockCreateServiceClient.mockReturnValue(makeSupabaseMock(stuck));
    mockSendEmail.mockResolvedValue({ id: 'resend-id' });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.stuckRefunds).toBe(1);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendEmail.mock.calls[0][0];
    expect(sendArgs.to).toBe('staff@secondturn.games');
    expect(JSON.stringify(sendArgs.react)).toContain('order-1');

    expect(mockSentryCaptureException).toHaveBeenCalledTimes(1);
    const [, sentryOpts] = mockSentryCaptureException.mock.calls[0];
    expect(sentryOpts.tags.phase).toBe('reconcile_stuck_refund_status');
    expect(sentryOpts.extra.orderIds).toEqual(['order-1']);
  });

  it('email body includes the exact EveryPay-verification triage sentence', async () => {
    const stuck = [refundRow({ id: 'order-1' })];
    mockCreateServiceClient.mockReturnValue(makeSupabaseMock(stuck));
    mockSendEmail.mockResolvedValue({ id: 'resend-id' });

    const { POST } = await import('./route');
    await POST(makeRequest());

    const sendArgs = mockSendEmail.mock.calls[0][0];
    const rendered = JSON.stringify(sendArgs.react);
    expect(rendered).toContain('refund_status may be stale — verify against EveryPay before re-issuing a refund.');
  });

  it('includes order_number, id, refund_status, refund_amount_cents, total_amount_cents, buyer_id, seller_id, and updated_at per row', async () => {
    const stuck = [
      refundRow({
        id: 'order-1',
        order_number: 'STG-0001',
        buyer_id: 'buyer-stuck-1',
        seller_id: 'seller-stuck-1',
        refund_status: 'partial',
        refund_amount_cents: 1200,
        total_amount_cents: 5000,
        updated_at: '2026-06-24T09:00:00.000Z',
      }),
    ];
    mockCreateServiceClient.mockReturnValue(makeSupabaseMock(stuck));
    mockSendEmail.mockResolvedValue({ id: 'resend-id' });

    const { POST } = await import('./route');
    await POST(makeRequest());

    const rendered = JSON.stringify(mockSendEmail.mock.calls[0][0].react);
    expect(rendered).toContain('STG-0001');
    expect(rendered).toContain('order-1');
    expect(rendered).toContain('partial');
    expect(rendered).toContain('1200');
    expect(rendered).toContain('5000');
    expect(rendered).toContain('buyer-stuck-1');
    expect(rendered).toContain('seller-stuck-1');
    expect(rendered).toContain('2026-06-24T09:00:00.000Z');
  });

  it('does not alert on a completed refund_status (excluded by the query predicate)', async () => {
    // A real completed-status row, sitting in the fixture set alongside a
    // genuinely stuck failed row. The mock applies the route's actual
    // .in('refund_status', ['failed', 'partial']) filter against this set —
    // proving the predicate itself excludes 'completed', not just that an
    // empty result produces no alert.
    const rows = [
      refundRow({ id: 'order-completed', refund_status: 'completed' }),
    ];
    mockCreateServiceClient.mockReturnValue(makeSupabaseMock(rows));

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json.stuckRefunds).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it('does not alert on a failed refund_status still within the 1h grace period', async () => {
    // A real failed-status row updated 10 minutes ago. The mock applies the
    // route's actual .lt('updated_at', cutoff) filter against this set —
    // proving the grace-period predicate itself excludes recently-updated
    // rows, not just that an empty result produces no alert.
    const rows = [
      refundRow({
        id: 'order-recent',
        refund_status: 'failed',
        updated_at: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
      }),
    ];
    mockCreateServiceClient.mockReturnValue(makeSupabaseMock(rows));

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json.stuckRefunds).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it('alerts only on the stuck row when both a completed row and a recent-failed row are also present', async () => {
    // Mixed fixture: one genuinely stuck row, plus a completed row and a
    // recently-updated failed row that must both be filtered out. Proves the
    // two predicates compose correctly rather than passing in isolation only.
    const rows = [
      refundRow({ id: 'order-stuck', refund_status: 'failed' }),
      refundRow({ id: 'order-completed', refund_status: 'completed' }),
      refundRow({
        id: 'order-recent',
        refund_status: 'partial',
        updated_at: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
      }),
    ];
    mockCreateServiceClient.mockReturnValue(makeSupabaseMock(rows));
    mockSendEmail.mockResolvedValue({ id: 'resend-id' });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json.stuckRefunds).toBe(1);
    const [, sentryOpts] = mockSentryCaptureException.mock.calls[0];
    expect(sentryOpts.extra.orderIds).toEqual(['order-stuck']);
    const rendered = JSON.stringify(mockSendEmail.mock.calls[0][0].react);
    expect(rendered).toContain('order-stuck');
    expect(rendered).not.toContain('order-completed');
    expect(rendered).not.toContain('order-recent');
  });

  it('sends no email and fires no Sentry capture when there are no stuck refunds', async () => {
    mockCreateServiceClient.mockReturnValue(makeSupabaseMock([]));

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.stuckRefunds).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });
});
