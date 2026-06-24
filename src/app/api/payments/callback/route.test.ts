/**
 * Cart checkout group idempotency tests for the EveryPay callback route.
 *
 * `handleCartCallback` already short-circuits on `group.status === 'completed'`
 * without re-verifying payment or re-running fulfillment. It had no equivalent
 * guard for `group.status === 'expired'` — a status now also reachable from a
 * mid-loop checkout failure (cancel-first rollback). Without the guard, a
 * repeated callback hit (browser back-button resubmission, flaky retry) after
 * the group was marked 'expired' would fall through to EveryPay verification
 * and could re-enter `fulfillCartPayment`, risking a second refund for a
 * checkout that already failed and was already refunded once.
 *
 * Scope here: the early-return branches for 'completed' and 'expired' fire
 * before any external call (`getPaymentStatus`) or mutating call
 * (`fulfillCartPayment`), and redirect to the expected URLs. Full
 * verification/fulfillment behavior is covered elsewhere (payment-
 * fulfillment.test.ts, integration/payment-fulfillment.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateServiceClient,
  mockGetPaymentStatus,
  mockFulfillCartPayment,
  mockAttemptAutoRefund,
} = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockGetPaymentStatus: vi.fn(),
  mockFulfillCartPayment: vi.fn(),
  mockAttemptAutoRefund: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { app: { url: 'http://localhost:3000' } },
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock('@/lib/services/everypay', () => ({
  getPaymentStatus: mockGetPaymentStatus,
  SUCCESSFUL_STATES: new Set(['authorised', 'settled']),
  mapEveryPayMethod: vi.fn(() => 'card'),
}));

vi.mock('@/lib/services/payment-fulfillment', () => ({
  fulfillCartPayment: mockFulfillCartPayment,
  attemptAutoRefund: mockAttemptAutoRefund,
}));

vi.mock('@/lib/rate-limit', () => ({
  paymentCallbackLimiter: { check: vi.fn(() => ({ success: true, remaining: 19, resetTime: 0 })) },
  getClientIP: vi.fn(() => '127.0.0.1'),
}));

// Helper — GET request carrying the query params the route expects.
function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/payments/callback');
  const defaults = {
    payment_reference: 'pay-ref-1',
    order_reference: 'order-num-1',
    token: 'callback-token-1',
  };
  for (const [key, value] of Object.entries({ ...defaults, ...params })) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: 'GET' });
}

interface CartGroupOverrides {
  status?: 'pending' | 'completed' | 'expired';
}

function cartGroup(overrides: CartGroupOverrides = {}) {
  return {
    id: 'group-1',
    order_number: 'order-num-1',
    callback_token: 'callback-token-1',
    buyer_id: 'buyer-1',
    terminal_id: 'terminal-1',
    terminal_name: 'Terminal 1',
    terminal_address: null,
    terminal_city: null,
    terminal_postal_code: null,
    terminal_country: 'LV',
    buyer_phone: '+37100000000',
    total_amount_cents: 5000,
    wallet_debit_cents: 0,
    wallet_allocation: {},
    listing_ids: ['listing-1'],
    everypay_payment_reference: null,
    status: 'pending',
    is_staff_test: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build a Supabase mock for the GET handler's two lookups plus
 * handleCartCallback's existing-orders idempotency check:
 *   1. from('orders').select(...).eq('everypay_payment_reference', ...).single()
 *      → existingOrder lookup. Default: not found.
 *   2. from('cart_checkout_groups').select('*').eq('order_number', ...).single()
 *      → cartGroup lookup.
 *   3. from('orders').select('id').eq('cart_group_id', ...)
 *      → existingOrders idempotency check. Default: empty (no rows).
 */
function makeSupabaseMock(opts: {
  cartGroupResult: { data: ReturnType<typeof cartGroup> | null; error: unknown };
  existingOrderResult?: { data: { id: string; cart_group_id: string | null } | null; error: unknown };
  existingOrdersListResult?: { data: { id: string }[] | null; error: unknown };
}) {
  const existingOrderResult = opts.existingOrderResult ?? { data: null, error: null };
  const existingOrdersListResult = opts.existingOrdersListResult ?? { data: [], error: null };

  return {
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      const chainable = () => builder;
      builder.select = vi.fn(chainable);
      builder.eq = vi.fn(chainable);
      builder.update = vi.fn(chainable);

      if (table === 'orders') {
        // Two different .select() shapes hit 'orders': the top-level
        // existingOrder-by-payment-reference check (.single()) and
        // handleCartCallback's existingOrders-by-group-id check (no .single()
        // — it's awaited directly as a list). Discriminate via .single()
        // presence: only the first call site invokes it.
        builder.single = vi.fn(() => Promise.resolve(existingOrderResult));
        // Make the builder itself awaitable (thenable) for the list-query
        // call site, which does `const { data } = await serviceClient.from(...).select(...).eq(...)`.
        (builder as unknown as { then: unknown }).then = (
          resolve: (value: typeof existingOrdersListResult) => void
        ) => resolve(existingOrdersListResult);
        return builder;
      }

      if (table === 'cart_checkout_groups') {
        builder.single = vi.fn(() => Promise.resolve(opts.cartGroupResult));
        return builder;
      }

      throw new Error(`Unexpected table in test mock: ${table}`);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/payments/callback — cart checkout group idempotency', () => {
  describe("group.status === 'expired'", () => {
    beforeEach(() => {
      mockCreateServiceClient.mockReturnValue(
        makeSupabaseMock({
          cartGroupResult: { data: cartGroup({ status: 'expired' }), error: null },
        })
      );
    });

    it('redirects to /account/orders with error=partial_creation', async () => {
      const { GET } = await import('./route');
      const res = await GET(makeRequest());

      expect(res.status).toBe(307); // NextResponse.redirect default
      const location = res.headers.get('location');
      expect(location).toBe(
        'http://localhost:3000/account/orders?from=cart&group=group-1&error=partial_creation'
      );
    });

    it('does NOT call getPaymentStatus or fulfillCartPayment', async () => {
      const { GET } = await import('./route');
      await GET(makeRequest());

      expect(mockGetPaymentStatus).not.toHaveBeenCalled();
      expect(mockFulfillCartPayment).not.toHaveBeenCalled();
      expect(mockAttemptAutoRefund).not.toHaveBeenCalled();
    });
  });

  describe("group.status === 'completed' (existing guard, contrast case)", () => {
    beforeEach(() => {
      mockCreateServiceClient.mockReturnValue(
        makeSupabaseMock({
          cartGroupResult: { data: cartGroup({ status: 'completed' }), error: null },
        })
      );
    });

    it('redirects to /account/orders with no error param', async () => {
      const { GET } = await import('./route');
      const res = await GET(makeRequest());

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toBe('http://localhost:3000/account/orders?from=cart&group=group-1');
    });

    it('does NOT call getPaymentStatus or fulfillCartPayment', async () => {
      const { GET } = await import('./route');
      await GET(makeRequest());

      expect(mockGetPaymentStatus).not.toHaveBeenCalled();
      expect(mockFulfillCartPayment).not.toHaveBeenCalled();
      expect(mockAttemptAutoRefund).not.toHaveBeenCalled();
    });
  });

  describe("group.status === 'pending' (sanity check — verification path still runs)", () => {
    beforeEach(() => {
      mockCreateServiceClient.mockReturnValue(
        makeSupabaseMock({
          cartGroupResult: { data: cartGroup({ status: 'pending' }), error: null },
        })
      );
      mockGetPaymentStatus.mockResolvedValue({
        order_reference: 'order-num-1',
        payment_state: 'authorised',
        amount: '50.00',
        payment_method: 'card',
      });
      mockFulfillCartPayment.mockResolvedValue({ outcome: 'created', orderIds: ['order-1'] });
    });

    it('calls getPaymentStatus and fulfillCartPayment when group is still pending', async () => {
      const { GET } = await import('./route');
      const res = await GET(makeRequest());

      expect(mockGetPaymentStatus).toHaveBeenCalledTimes(1);
      expect(mockFulfillCartPayment).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/account/orders?from=cart&group=group-1'
      );
    });
  });
});
