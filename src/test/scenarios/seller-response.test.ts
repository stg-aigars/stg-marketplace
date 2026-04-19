/**
 * B1-B3: Seller response scenarios for pending_seller orders.
 *
 * B1: Seller declines order
 * B2: 24h no response → reminder
 * B3: 48h no response → auto-decline
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// --- Mocks ---

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('@/lib/services/order-refund', () => ({
  refundOrder: vi.fn(() => Promise.resolve({ cardRefunded: 1000, walletRefunded: 0 })),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendOrderDeclinedToBuyer: vi.fn(() => Promise.resolve()),
  sendOrderAcceptedToBuyer: vi.fn(() => Promise.resolve()),
  sendSellerResponseReminder: vi.fn(() => Promise.resolve()),
  sendOrderAutoCancelledToBuyer: vi.fn(() => Promise.resolve()),
  sendOrderAutoCancelledToSeller: vi.fn(() => Promise.resolve()),
  sendShippingReminderToSeller: vi.fn(() => Promise.resolve()),
  sendDeliveryReminderToBuyer: vi.fn(() => Promise.resolve()),
  sendDisputeEscalated: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/notifications', () => ({
  notify: vi.fn(),
  notifyMany: vi.fn(),
}));
vi.mock('@/lib/services/unisend/shipping', () => ({
  createOrderShipping: vi.fn(() => Promise.resolve({ success: true, parcelId: 1, barcode: 'BC123' })),
  cancelOrderShipment: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/services/wallet', () => ({
  creditWallet: vi.fn(() => Promise.resolve()),
  refundToWallet: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/dac7/service', () => ({
  updateDac7StatsOnCompletion: vi.fn(() => Promise.resolve()),
}));

// --- Helpers ---

function makeMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'STG-20260413-001',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    listing_id: 'listing-1',
    status: 'pending_seller',
    total_amount_cents: 2000,
    items_total_cents: 1500,
    shipping_cost_cents: 500,
    buyer_wallet_debit_cents: 0,
    payment_method: 'card',
    everypay_payment_reference: 'EP-REF-1',
    refund_status: null,
    platform_commission_cents: 150,
    seller_wallet_credit_cents: 1350,
    seller_country: 'LV',
    terminal_id: 'T1',
    terminal_name: 'Terminal 1',
    terminal_address: 'Address',
    terminal_country: 'LV',
    cancellation_reason: null,
    deadline_reminder_sent_at: null,
    barcode: null,
    tracking_url: null,
    buyer_phone: '+37120000000',
    seller_phone: null,
    accepted_at: null,
    shipped_at: null,
    delivered_at: null,
    completed_at: null,
    cancelled_at: null,
    disputed_at: null,
    refunded_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_items: [
      { listing_id: 'listing-1', price_cents: 1500, listings: { game_name: 'Catan', seller_id: 'seller-1' } },
    ],
    listings: { game_name: 'Catan', seller_id: 'seller-1' },
    buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com', phone: '+37120000000', country: 'LV', avatar_url: null },
    seller_profile: { full_name: 'Seller One', email: 'seller@test.com', phone: '+37120000001', country: 'LV', avatar_url: null },
    ...overrides,
  };
}

/**
 * Build a mock Supabase-like chain that distinguishes between read (select → single)
 * and write (update → ... → single) paths, which is the key challenge when mocking
 * loadOrder + transitionOrder calls.
 */
function makeSmartBuilder(opts: {
  loadData: unknown;
  updateData: unknown;
  onUpdate?: (payload: Record<string, unknown>, table: string) => void;
  onTable?: (table: string) => void;
}) {
  return {
    from: vi.fn((table: string) => {
      opts.onTable?.(table);
      let isUpdate = false;

      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.in = vi.fn(() => builder);
      builder.is = vi.fn(() => builder);
      builder.lt = vi.fn(() => builder);
      builder.gte = vi.fn(() => builder);
      builder.limit = vi.fn(() => builder);
      builder.insert = vi.fn(() => builder);
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        isUpdate = true;
        opts.onUpdate?.(payload, table);
        return builder;
      });
      builder.single = vi.fn(() =>
        Promise.resolve({
          data: isUpdate ? opts.updateData : opts.loadData,
          error: null,
        })
      );
      builder.maybeSingle = vi.fn(() =>
        Promise.resolve({ data: null, error: null })
      );
      builder.then = (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null });

      return builder;
    }),
  };
}

describe('B1: Seller declines order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to cancelled with reason=declined and triggers refund + listing restore', async () => {
    const { declineOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');
    const { refundOrder } = await import('@/lib/services/order-refund');

    const mockOrder = makeMockOrder({ status: 'pending_seller' });
    const cancelledOrder = { ...mockOrder, status: 'cancelled', cancellation_reason: 'declined' };

    let listingsUpdated = false;
    let orderItemsDeactivated = false;

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: cancelledOrder,
      onUpdate: (payload, table) => {
        if (table === 'order_items' && payload.active === false) orderItemsDeactivated = true;
      },
      onTable: (table) => {
        if (table === 'listings') listingsUpdated = true;
      },
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await declineOrder('order-1', 'seller-1');

    expect(result.status).toBe('cancelled');
    expect(result.cancellation_reason).toBe('declined');

    expect(refundOrder).toHaveBeenCalledWith('order-1', expect.objectContaining({
      buyer_id: 'buyer-1',
      total_amount_cents: 2000,
    }));

    expect(listingsUpdated).toBe(true);
    expect(orderItemsDeactivated).toBe(true);
  });
});

describe('B2: 24h no response → reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends reminder and marks deadline_reminder_sent_at for 25h-old pending_seller order', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-13T12:00:00Z');
    vi.setSystemTime(now);

    const { enforceOrderDeadlines } = await import('@/lib/services/order-deadlines');
    const { createServiceClient } = await import('@/lib/supabase');
    const { sendSellerResponseReminder } = await import('@/lib/email');

    const orderCreatedAt = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const rawOrder = {
      id: 'order-1',
      order_number: 'STG-20260413-001',
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'pending_seller',
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'EP-REF-1',
      refund_status: null,
      created_at: orderCreatedAt,
      accepted_at: null,
      shipped_at: null,
      order_items: [
        { listing_id: 'listing-1', listings: { game_name: 'Catan' } },
      ],
      listings: { game_name: 'Catan' },
      buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com' },
      seller_profile: { full_name: 'Seller One', email: 'seller@test.com' },
    };

    let reminderUpdateCalled = false;

    // enforceOrderDeadlines makes multiple queries in sequence.
    // For pending_seller: auto-cancel (48h cutoff), then reminder (24h-48h window).
    // A 25h-old order is within reminder window but NOT past auto-cancel.
    // The query chain uses .limit() which resolves via implicit .then().
    // We need to track the query type by the status + timestamp filters.

    // Simpler approach: track if it's the auto-cancel query or reminder query
    // by looking at whether .is('deadline_reminder_sent_at', null) is called.
    const mockSupabase = {
      from: vi.fn((table: string) => {
        let hasIsNull = false;
        let hasGte = false;
        // isUpdate tracked by the update mock below

        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.lt = vi.fn(() => builder);
        builder.gte = vi.fn(() => {
          hasGte = true;
          return builder;
        });
        builder.is = vi.fn(() => {
          hasIsNull = true;
          return builder;
        });
        builder.in = vi.fn(() => builder);
        builder.limit = vi.fn(() => builder);
        builder.update = vi.fn((payload: Record<string, unknown>) => {
          if (table === 'orders' && payload.deadline_reminder_sent_at) {
            reminderUpdateCalled = true;
          }
          return builder;
        });
        builder.single = vi.fn(() =>
          Promise.resolve({ data: { id: 'order-1' }, error: null })
        );
        builder.maybeSingle = vi.fn(() =>
          Promise.resolve({ data: null, error: null })
        );

        // Reminder queries have both .is(null) and .gte() calls.
        // Auto-cancel queries do NOT have .gte() or .is().
        builder.then = (resolve: (v: unknown) => void) => {
          if (table === 'orders' && hasIsNull && hasGte) {
            // This is a reminder query - return our order
            resolve({ data: [rawOrder], error: null });
          } else {
            resolve({ data: [], error: null });
          }
        };

        return builder;
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await enforceOrderDeadlines();

    expect(result.pendingSellerReminders).toBe(1);
    expect(result.pendingSellerAutoDeclined).toBe(0);
    expect(reminderUpdateCalled).toBe(true);
    expect(sendSellerResponseReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerEmail: 'seller@test.com',
        orderNumber: 'STG-20260413-001',
      })
    );
  });
});

describe('B3: 48h no response → auto-decline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-cancels with reason=response_timeout and triggers refund', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-13T12:00:00Z');
    vi.setSystemTime(now);

    const { enforceOrderDeadlines } = await import('@/lib/services/order-deadlines');
    const { createServiceClient } = await import('@/lib/supabase');
    const { refundOrder } = await import('@/lib/services/order-refund');

    const orderCreatedAt = new Date(now.getTime() - 49 * 60 * 60 * 1000).toISOString();
    const rawOrder = {
      id: 'order-1',
      order_number: 'STG-20260413-001',
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'pending_seller',
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'EP-REF-1',
      refund_status: null,
      created_at: orderCreatedAt,
      accepted_at: null,
      shipped_at: null,
      order_items: [
        { listing_id: 'listing-1', listings: { game_name: 'Catan' } },
      ],
      listings: { game_name: 'Catan' },
      buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com' },
      seller_profile: { full_name: 'Seller One', email: 'seller@test.com' },
    };

    let cancelUpdatePayload: Record<string, unknown> | null = null;
    let listingsRestored = false;
    let orderItemsDeactivated = false;

    // Auto-cancel queries use .lt() but NO .gte() or .is().
    // We return the order for auto-cancel queries (pending_seller), empty for everything else.
    let pendingSellerAutoCancelReturned = false;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        let hasGte = false;
        let hasIsNull = false;
        let eqStatus: string | null = null;

        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn((_col: string, val: unknown) => {
          if (_col === 'status') eqStatus = val as string;
          return builder;
        });
        builder.lt = vi.fn(() => builder);
        builder.gte = vi.fn(() => {
          hasGte = true;
          return builder;
        });
        builder.is = vi.fn(() => {
          hasIsNull = true;
          return builder;
        });
        builder.in = vi.fn(() => {
          if (table === 'listings') listingsRestored = true;
          return builder;
        });
        builder.limit = vi.fn(() => builder);
        builder.update = vi.fn((payload: Record<string, unknown>) => {
          if (table === 'orders' && payload.cancellation_reason === 'response_timeout') {
            cancelUpdatePayload = payload;
          }
          if (table === 'order_items' && payload.active === false) {
            orderItemsDeactivated = true;
          }
          return builder;
        });
        builder.single = vi.fn(() =>
          Promise.resolve({ data: { id: 'order-1' }, error: null })
        );
        builder.maybeSingle = vi.fn(() =>
          Promise.resolve({ data: null, error: null })
        );

        // Auto-cancel for pending_seller: has .eq('status','pending_seller'), .lt(), NO .gte(), NO .is()
        builder.then = (resolve: (v: unknown) => void) => {
          if (
            table === 'orders' &&
            eqStatus === 'pending_seller' &&
            !hasGte &&
            !hasIsNull &&
            !pendingSellerAutoCancelReturned
          ) {
            pendingSellerAutoCancelReturned = true;
            resolve({ data: [rawOrder], error: null });
          } else {
            resolve({ data: [], error: null });
          }
        };

        return builder;
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await enforceOrderDeadlines();

    expect(result.pendingSellerAutoDeclined).toBe(1);
    expect(cancelUpdatePayload).not.toBeNull();
    expect(cancelUpdatePayload!.cancellation_reason).toBe('response_timeout');
    expect(cancelUpdatePayload!.status).toBe('cancelled');

    expect(refundOrder).toHaveBeenCalledWith('order-1', expect.objectContaining({
      buyer_id: 'buyer-1',
    }));

    expect(listingsRestored).toBe(true);
    expect(orderItemsDeactivated).toBe(true);
  });
});
