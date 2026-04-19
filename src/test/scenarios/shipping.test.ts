/**
 * C3-C5: Shipping scenarios for accepted orders.
 *
 * C3: Seller ships (accepted → shipped)
 * C4: Day 3 shipping reminder
 * C5: Day 5 auto-cancel (shipping_timeout)
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
  sendOrderShippedToBuyer: vi.fn(() => Promise.resolve()),
  sendShippingReminderToSeller: vi.fn(() => Promise.resolve()),
  sendOrderAutoCancelledToBuyer: vi.fn(() => Promise.resolve()),
  sendOrderAutoCancelledToSeller: vi.fn(() => Promise.resolve()),
  sendSellerResponseReminder: vi.fn(() => Promise.resolve()),
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
    status: 'accepted',
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
    barcode: 'BC-123',
    tracking_url: 'https://track.example.com/123',
    buyer_phone: '+37120000000',
    seller_phone: '+37120000001',
    accepted_at: new Date().toISOString(),
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
 * Smart mock builder that distinguishes between read (.select → .single) and
 * write (.update → .single) paths on the same table.
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

describe('C3: Seller ships order (accepted → shipped)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to shipped and resets deadline_reminder_sent_at', async () => {
    const { markShipped } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = makeMockOrder({ status: 'accepted' });
    const shippedOrder = { ...mockOrder, status: 'shipped', shipped_at: new Date().toISOString() };

    let updatePayload: Record<string, unknown> | null = null;

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: shippedOrder,
      onUpdate: (payload) => {
        if (payload.status === 'shipped') updatePayload = payload;
      },
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await markShipped('order-1', 'seller-1');

    expect(result.status).toBe('shipped');
    expect(updatePayload).not.toBeNull();
    expect(updatePayload!.status).toBe('shipped');
    expect(updatePayload!.deadline_reminder_sent_at).toBeNull();
  });

  it('sends shipped notification to buyer', async () => {
    const { markShipped } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');
    const { sendOrderShippedToBuyer } = await import('@/lib/email');
    const { notify } = await import('@/lib/notifications');

    const mockOrder = makeMockOrder({ status: 'accepted' });
    const shippedOrder = { ...mockOrder, status: 'shipped' };

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: shippedOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await markShipped('order-1', 'seller-1');

    expect(sendOrderShippedToBuyer).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerEmail: 'buyer@test.com',
        orderNumber: 'STG-20260413-001',
        gameName: 'Catan',
      })
    );
    expect(notify).toHaveBeenCalledWith('buyer-1', 'order.shipped', expect.any(Object));
  });
});

describe('C4: Day 3 shipping reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends shipping reminder for accepted order 4 days old', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-13T12:00:00Z');
    vi.setSystemTime(now);

    const { enforceOrderDeadlines } = await import('@/lib/services/order-deadlines');
    const { createServiceClient } = await import('@/lib/supabase');
    const { sendShippingReminderToSeller } = await import('@/lib/email');

    const acceptedAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const rawOrder = {
      id: 'order-1',
      order_number: 'STG-20260413-001',
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'accepted',
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'EP-REF-1',
      refund_status: null,
      created_at: acceptedAt,
      accepted_at: acceptedAt,
      shipped_at: null,
      order_items: [
        { listing_id: 'listing-1', listings: { game_name: 'Catan' } },
      ],
      listings: { game_name: 'Catan' },
      buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com' },
      seller_profile: { full_name: 'Seller One', email: 'seller@test.com' },
    };

    let reminderUpdateCalled = false;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        let hasIsNull = false;
        let hasGte = false;

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
        builder.insert = vi.fn(() => builder);
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

        // Reminder queries use .gte() + .is(null) — auto-cancel queries don't.
        builder.then = (resolve: (v: unknown) => void) => {
          if (table === 'orders' && hasIsNull && hasGte) {
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

    expect(result.shippingReminders).toBe(1);
    expect(reminderUpdateCalled).toBe(true);
    expect(sendShippingReminderToSeller).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerEmail: 'seller@test.com',
        orderNumber: 'STG-20260413-001',
      })
    );
  });
});

describe('C5: Day 5 auto-cancel (shipping_timeout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-cancels accepted order after 6 days with shipping_timeout', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-13T12:00:00Z');
    vi.setSystemTime(now);

    const { enforceOrderDeadlines } = await import('@/lib/services/order-deadlines');
    const { createServiceClient } = await import('@/lib/supabase');
    const { refundOrder } = await import('@/lib/services/order-refund');

    const acceptedAt = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const rawOrder = {
      id: 'order-1',
      order_number: 'STG-20260413-001',
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'accepted',
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'EP-REF-1',
      refund_status: null,
      created_at: acceptedAt,
      accepted_at: acceptedAt,
      shipped_at: null,
      order_items: [
        { listing_id: 'listing-1', listings: { game_name: 'Catan' } },
      ],
      listings: { game_name: 'Catan' },
      buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com' },
      seller_profile: { full_name: 'Seller One', email: 'seller@test.com' },
    };

    let cancelPayload: Record<string, unknown> | null = null;
    let listingsRestored = false;
    let orderItemsDeactivated = false;
    let acceptedAutoCancelReturned = false;

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
          if (table === 'orders' && payload.cancellation_reason === 'shipping_timeout') {
            cancelPayload = payload;
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

        // Auto-cancel for accepted: .eq('status','accepted'), NO .gte(), NO .is()
        builder.then = (resolve: (v: unknown) => void) => {
          if (
            table === 'orders' &&
            eqStatus === 'accepted' &&
            !hasGte &&
            !hasIsNull &&
            !acceptedAutoCancelReturned
          ) {
            acceptedAutoCancelReturned = true;
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

    expect(result.shippingAutoCancelled).toBe(1);
    expect(cancelPayload).not.toBeNull();
    expect(cancelPayload!.cancellation_reason).toBe('shipping_timeout');
    expect(cancelPayload!.status).toBe('cancelled');

    expect(refundOrder).toHaveBeenCalledWith('order-1', expect.objectContaining({
      buyer_id: 'buyer-1',
    }));

    expect(listingsRestored).toBe(true);
    expect(orderItemsDeactivated).toBe(true);
  });
});
