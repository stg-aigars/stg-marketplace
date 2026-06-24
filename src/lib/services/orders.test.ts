import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOrderNumber } from './orders';
import type { CreateOrderParams } from '@/lib/orders/types';

describe('generateOrderNumber', () => {
  it('matches format STG-YYYYMMDD-XXXX', () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(/^STG-\d{8}-[A-Z2-9]{4}$/);
  });

  it('uses current date', () => {
    const orderNumber = generateOrderNumber();
    const now = new Date();
    const expectedDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    expect(orderNumber).toContain(expectedDate);
  });

  it('does not contain ambiguous characters (I, O, 0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const orderNumber = generateOrderNumber();
      const randomPart = orderNumber.split('-')[2];
      expect(randomPart).not.toMatch(/[IO01]/);
    }
  });
});

// ---------------------------------------------------------------------------
// createOrder rollback error visibility
// ---------------------------------------------------------------------------
//
// Covers the production incident where createOrder()'s internal rollback
// deletes (order_items then orders, on listings-mismatch; orders-only, on
// order_items insert failure) had their `{ error }` results silently
// discarded. A RESTRICT FK from order_items.order_id meant a failed
// order_items delete could silently block the orders delete that follows it,
// leaving a fully-formed order+order_items pair invisible to the caller.
// This is observability-only: the thrown error messages must stay
// byte-identical to before (a later task's catch-block logic depends on
// them), and no caller-side compensation is added here.

const mockCaptureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

const mockTrackServer = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/analytics/track-server', () => ({
  trackServer: (...args: unknown[]) => mockTrackServer(...args),
}));

/** Resolves a chain with a fixed `{ data, error }` result, regardless of further chaining. */
function makeResolved(data: unknown, error: unknown) {
  const node: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'neq', 'lt', 'gt', 'in', 'not', 'limit', 'returns', 'is', 'or', 'single'];
  for (const m of chainMethods) {
    node[m] = vi.fn(() => node);
  }
  node.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return node;
}

const BASE_ORDER_ROW = {
  id: 'order-uuid-1',
  order_number: 'STG-20260624-AB23',
  buyer_id: 'buyer-uuid-1',
  seller_id: 'seller-uuid-1',
};

interface MakeClientOpts {
  /** Error returned by the order_items INSERT. Null = success. */
  itemsInsertError?: { message: string } | null;
  /** Listings returned by the listings UPDATE .select('id') — drives the mismatch branch. */
  updatedListings?: Array<{ id: string }> | null;
  /** Error returned by the order_items DELETE (rollback branch). */
  itemsDeleteError?: { message: string } | null;
  /** Error returned by the orders DELETE (rollback branch). */
  orderDeleteError?: { message: string } | null;
}

const mockOrderItemsDelete = vi.fn();
const mockOrdersDelete = vi.fn();

function makeClient(opts: MakeClientOpts) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          // INSERT orders -> .select().single() -> { data: order, error: null }
          insert: vi.fn(() => makeResolved(BASE_ORDER_ROW, null)),
          // DELETE orders -> .eq(id) -> { data: null, error }
          delete: (...args: unknown[]) => {
            mockOrdersDelete(...args);
            return makeResolved(null, opts.orderDeleteError ?? null);
          },
        };
      }
      if (table === 'order_items') {
        return {
          // INSERT order_items -> { data: null, error }
          insert: vi.fn(() => makeResolved(null, opts.itemsInsertError ?? null)),
          // DELETE order_items -> .eq(order_id) -> { data: null, error }
          delete: (...args: unknown[]) => {
            mockOrderItemsDelete(...args);
            return makeResolved(null, opts.itemsDeleteError ?? null);
          },
        };
      }
      if (table === 'listings') {
        return {
          // UPDATE listings -> .in().or().select('id') -> { data: updatedListings, error: null }
          update: vi.fn(() => makeResolved(opts.updatedListings ?? [{ id: 'listing-1' }], null)),
        };
      }
      return makeResolved(null, null);
    }),
  };
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockCreateServiceClientImpl(),
}));

let mockCreateServiceClientImpl: () => ReturnType<typeof makeClient> = () => makeClient({});

function baseParams(overrides: Partial<CreateOrderParams> = {}): CreateOrderParams {
  return {
    buyerId: 'buyer-uuid-1',
    sellerId: 'seller-uuid-1',
    items: [{ listingId: 'listing-1', priceCents: 5000 }],
    shippingCostCents: 500,
    sellerCountry: 'LV',
    paymentReference: 'ep-ref-1',
    paymentState: 'settled',
    paymentMethod: 'card',
    terminalId: 'lv-omniva-001',
    terminalName: 'Test terminal',
    terminalCountry: 'LV',
    buyerPhone: '+37120000000',
    orderNumber: 'STG-20260624-AB23',
    ...overrides,
  };
}

describe('createOrder rollback error visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures Sentry with phase create_order_rollback_items_delete_failed when the order_items delete errors on the listings-mismatch branch, and still throws the original message', async () => {
    const { createOrder } = await import('./orders');

    mockCreateServiceClientImpl = () =>
      makeClient({
        // Listings update only covers 0 of the 1 requested listing — mismatch branch.
        updatedListings: [],
        itemsDeleteError: { message: 'restrict violation or other failure' },
        orderDeleteError: null,
      });

    await expect(createOrder(baseParams())).rejects.toThrow('One or more listings are no longer available');

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, context] = mockCaptureException.mock.calls[0]!;
    expect(error).toEqual({ message: 'restrict violation or other failure' });
    expect(context).toMatchObject({
      tags: { orderId: 'order-uuid-1', phase: 'create_order_rollback_items_delete_failed' },
    });
  });

  it('does not call Sentry.captureException when both rollback deletes succeed (clean path)', async () => {
    const { createOrder } = await import('./orders');

    mockCreateServiceClientImpl = () =>
      makeClient({
        updatedListings: [],
        itemsDeleteError: null,
        orderDeleteError: null,
      });

    await expect(createOrder(baseParams())).rejects.toThrow('One or more listings are no longer available');

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('captures Sentry with phase create_order_rollback_order_delete_failed when the orders delete errors after an order_items insert failure', async () => {
    const { createOrder } = await import('./orders');

    mockCreateServiceClientImpl = () =>
      makeClient({
        itemsInsertError: { message: 'insert failed' },
        orderDeleteError: { message: 'restrict violation blocked order delete' },
      });

    await expect(createOrder(baseParams())).rejects.toThrow('Failed to create order items: insert failed');

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, context] = mockCaptureException.mock.calls[0]!;
    expect(error).toEqual({ message: 'restrict violation blocked order delete' });
    expect(context).toMatchObject({
      tags: { orderId: 'order-uuid-1', phase: 'create_order_rollback_order_delete_failed' },
    });
  });
});
