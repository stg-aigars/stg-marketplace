/**
 * D1, D5, D6: Delivery scenarios for shipped orders.
 *
 * D1: Buyer confirms delivery (shipped → delivered)
 * D5: 14d delivery reminder
 * D6: 21d auto-escalate (creates dispute)
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
  sendOrderDeliveredToBuyer: vi.fn(() => Promise.resolve()),
  sendOrderDeliveredToSeller: vi.fn(() => Promise.resolve()),
  sendDeliveryReminderToBuyer: vi.fn(() => Promise.resolve()),
  sendDisputeEscalated: vi.fn(() => Promise.resolve()),
  sendSellerResponseReminder: vi.fn(() => Promise.resolve()),
  sendOrderAutoCancelledToBuyer: vi.fn(() => Promise.resolve()),
  sendOrderAutoCancelledToSeller: vi.fn(() => Promise.resolve()),
  sendShippingReminderToSeller: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/notifications', () => ({
  notify: vi.fn(),
  notifyMany: vi.fn(),
}));
vi.mock('@/lib/services/unisend/shipping', () => ({
  createOrderShipping: vi.fn(() => Promise.resolve({ success: true, parcelId: 1, barcode: 'BC123' })),
}));
vi.mock('@/lib/listings/actions', () => ({
  syncShelfOnListingSold: vi.fn(() => Promise.resolve()),
  syncShelfOnListingRemoved: vi.fn(() => Promise.resolve()),
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
    status: 'shipped',
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
    shipped_at: new Date().toISOString(),
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

describe('D1: Buyer confirms delivery (shipped → delivered)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to delivered and notifies both parties', async () => {
    const { markDelivered } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');
    const { sendOrderDeliveredToBuyer, sendOrderDeliveredToSeller } = await import('@/lib/email');
    const { notify } = await import('@/lib/notifications');

    const mockOrder = makeMockOrder({ status: 'shipped' });
    const deliveredOrder = { ...mockOrder, status: 'delivered', delivered_at: new Date().toISOString() };

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: deliveredOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await markDelivered('order-1', 'buyer-1');

    expect(result.status).toBe('delivered');

    expect(sendOrderDeliveredToBuyer).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerEmail: 'buyer@test.com',
        orderNumber: 'STG-20260413-001',
      })
    );
    expect(sendOrderDeliveredToSeller).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerEmail: 'seller@test.com',
        orderNumber: 'STG-20260413-001',
      })
    );

    expect(notify).toHaveBeenCalledWith('buyer-1', 'order.delivered', expect.any(Object));
    expect(notify).toHaveBeenCalledWith('seller-1', 'order.delivered_seller', expect.any(Object));
  });

  it('rejects non-buyer attempting to mark delivered', async () => {
    const { markDelivered } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = makeMockOrder({ status: 'shipped' });

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: mockOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await expect(markDelivered('order-1', 'seller-1')).rejects.toThrow(
      'Only the buyer can perform this action'
    );
  });
});

describe('D5: 14d delivery reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends delivery reminder for shipped order 15 days old', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-13T12:00:00Z');
    vi.setSystemTime(now);

    const { enforceOrderDeadlines } = await import('@/lib/services/order-deadlines');
    const { createServiceClient } = await import('@/lib/supabase');
    const { sendDeliveryReminderToBuyer } = await import('@/lib/email');

    const shippedAt = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const rawOrder = {
      id: 'order-1',
      order_number: 'STG-20260413-001',
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'shipped',
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'EP-REF-1',
      refund_status: null,
      created_at: shippedAt,
      accepted_at: shippedAt,
      shipped_at: shippedAt,
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

        // Reminder queries use .gte() + .is(null)
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

    expect(result.deliveryReminders).toBe(1);
    expect(reminderUpdateCalled).toBe(true);
    expect(sendDeliveryReminderToBuyer).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerEmail: 'buyer@test.com',
        orderNumber: 'STG-20260413-001',
      })
    );
  });
});

describe('D6: 21d auto-escalate (creates dispute)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('escalates shipped order to disputed after 22 days and creates dispute record', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-13T12:00:00Z');
    vi.setSystemTime(now);

    const { enforceOrderDeadlines } = await import('@/lib/services/order-deadlines');
    const { createServiceClient } = await import('@/lib/supabase');

    const shippedAt = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString();
    const rawOrder = {
      id: 'order-1',
      order_number: 'STG-20260413-001',
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'shipped',
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'EP-REF-1',
      refund_status: null,
      created_at: shippedAt,
      accepted_at: shippedAt,
      shipped_at: shippedAt,
      order_items: [
        { listing_id: 'listing-1', listings: { game_name: 'Catan' } },
      ],
      listings: { game_name: 'Catan' },
      buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com' },
      seller_profile: { full_name: 'Seller One', email: 'seller@test.com' },
    };

    let disputeStatusUpdate: Record<string, unknown> | null = null;
    let disputeInserted = false;
    let disputeInsertPayload: Record<string, unknown> | null = null;

    // The escalation flow (escalateStaleShippedOrders):
    // 1. Query shipped orders past 21d cutoff (NO .gte(), NO .is())
    // 2. For each: check existing dispute (.maybeSingle on disputes table)
    // 3. Update order to disputed
    // 4. Insert dispute record
    //
    // We need to distinguish this from reminder queries (which use .gte() + .is()).
    // The escalation query only uses .lt() on shipped_at without .gte()/.is().

    const mockSupabase = {
      from: vi.fn((table: string) => {
        let hasIsNull = false;
        let hasGte = false;
        let isUpdate = false;

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
          isUpdate = true;
          if (table === 'orders' && payload.status === 'disputed') {
            disputeStatusUpdate = payload;
          }
          return builder;
        });
        builder.insert = vi.fn((payload: Record<string, unknown>) => {
          if (table === 'disputes') {
            disputeInserted = true;
            disputeInsertPayload = payload;
          }
          return builder;
        });
        builder.single = vi.fn(() =>
          Promise.resolve({ data: { id: 'order-1' }, error: null })
        );
        builder.maybeSingle = vi.fn(() => {
          // No existing dispute
          return Promise.resolve({ data: null, error: null });
        });

        // Return shipped orders only for non-reminder queries on orders table
        // (escalation query uses .lt() but NOT .gte()/.is())
        builder.then = (resolve: (v: unknown) => void) => {
          if (table === 'orders' && !hasGte && !hasIsNull) {
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

    expect(result.deliveryEscalations).toBe(1);

    expect(disputeStatusUpdate).not.toBeNull();
    expect(disputeStatusUpdate!.status).toBe('disputed');

    expect(disputeInserted).toBe(true);
    expect(disputeInsertPayload).toEqual(
      expect.objectContaining({
        order_id: 'order-1',
        buyer_id: 'buyer-1',
        seller_id: 'seller-1',
        reason: 'Auto-escalated: no delivery confirmation after 21 days',
      })
    );
  });

  it('skips escalation if dispute already exists (idempotency)', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-13T12:00:00Z');
    vi.setSystemTime(now);

    const { enforceOrderDeadlines } = await import('@/lib/services/order-deadlines');
    const { createServiceClient } = await import('@/lib/supabase');

    const shippedAt = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString();
    const rawOrder = {
      id: 'order-1',
      order_number: 'STG-20260413-001',
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'shipped',
      total_amount_cents: 2000,
      buyer_wallet_debit_cents: 0,
      payment_method: 'card',
      everypay_payment_reference: 'EP-REF-1',
      refund_status: null,
      created_at: shippedAt,
      accepted_at: shippedAt,
      shipped_at: shippedAt,
      order_items: [
        { listing_id: 'listing-1', listings: { game_name: 'Catan' } },
      ],
      listings: { game_name: 'Catan' },
      buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com' },
      seller_profile: { full_name: 'Seller One', email: 'seller@test.com' },
    };

    let disputeInserted = false;

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
        builder.update = vi.fn(() => builder);
        builder.insert = vi.fn(() => {
          if (table === 'disputes') disputeInserted = true;
          return builder;
        });
        builder.single = vi.fn(() =>
          Promise.resolve({ data: { id: 'order-1' }, error: null })
        );
        builder.maybeSingle = vi.fn(() => {
          // Dispute ALREADY exists
          if (table === 'disputes') {
            return Promise.resolve({ data: { id: 'dispute-existing' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        });

        builder.then = (resolve: (v: unknown) => void) => {
          if (table === 'orders' && !hasGte && !hasIsNull) {
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

    expect(result.deliveryEscalations).toBe(0);
    expect(disputeInserted).toBe(false);
  });
});
