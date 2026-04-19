/**
 * E1-E4: Completion scenarios for delivered orders.
 *
 * E1: Buyer completes (delivered → completed), wallet credit = 90% of item price
 * E2: Auto-complete via cron (delivered_at 3d ago)
 * E3: Double-complete idempotency
 * E4: DAC7 threshold trigger on completion
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// --- Mocks ---

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('@/lib/services/order-refund', () => ({
  refundOrder: vi.fn(() => Promise.resolve({ cardRefunded: 0, walletRefunded: 0 })),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendOrderCompletedToSeller: vi.fn(() => Promise.resolve()),
  sendOrderDeliveredToBuyer: vi.fn(() => Promise.resolve()),
  sendOrderDeliveredToSeller: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/notifications', () => ({
  notify: vi.fn(),
  notifyMany: vi.fn(),
}));
vi.mock('@/lib/services/unisend/shipping', () => ({
  createOrderShipping: vi.fn(() => Promise.resolve({ success: true, parcelId: 1, barcode: 'BC123' })),
}));
const mockCreditWallet = vi.fn(() => Promise.resolve());
vi.mock('@/lib/services/wallet', () => ({
  creditWallet: mockCreditWallet,
  refundToWallet: vi.fn(() => Promise.resolve()),
}));

const mockUpdateDac7Stats = vi.fn(() => Promise.resolve());
vi.mock('@/lib/dac7/service', () => ({
  updateDac7StatsOnCompletion: mockUpdateDac7Stats,
}));

// --- Helpers ---

function makeMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'STG-20260413-001',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    listing_id: 'listing-1',
    status: 'delivered',
    total_amount_cents: 2000,
    items_total_cents: 1500,
    shipping_cost_cents: 500,
    buyer_wallet_debit_cents: 0,
    payment_method: 'card',
    everypay_payment_reference: 'EP-REF-1',
    refund_status: null,
    platform_commission_cents: 150,
    seller_wallet_credit_cents: 1350, // 90% of 1500 = 1350
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
    wallet_credited_at: null,
    accepted_at: new Date().toISOString(),
    shipped_at: new Date().toISOString(),
    delivered_at: new Date().toISOString(),
    completed_at: null,
    cancelled_at: null,
    disputed_at: null,
    refunded_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    item_count: 1,
    cart_group_id: null,
    order_items: [
      { listing_id: 'listing-1', price_cents: 1500, listings: { game_name: 'Catan', seller_id: 'seller-1' } },
    ],
    listings: { game_name: 'Catan', seller_id: 'seller-1' },
    buyer_profile: { full_name: 'Buyer One', email: 'buyer@test.com', phone: '+37120000000', country: 'LV', avatar_url: null },
    seller_profile: { full_name: 'Seller One', email: 'seller@test.com', phone: '+37120000001', country: 'LV', avatar_url: null },
    ...overrides,
  };
}

function makeChainBuilder(resolvedData: unknown = null) {
  const builder: Record<string, unknown> = {
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: resolvedData, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: resolvedData, error: null })),
    then: (resolve: (v: unknown) => void) => resolve({ data: resolvedData, error: null }),
  };
  return builder;
}

/**
 * Build a mock Supabase-like chain that distinguishes between read (select → single)
 * and write (update → ... → single) paths.
 */
function makeSmartBuilder(opts: {
  loadData: unknown;
  updateData: unknown;
}) {
  return {
    from: vi.fn(() => {
      let isUpdate = false;

      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.in = vi.fn(() => builder);
      builder.is = vi.fn(() => builder);
      builder.lt = vi.fn(() => builder);
      builder.gte = vi.fn(() => builder);
      builder.limit = vi.fn(() => builder);
      builder.update = vi.fn(() => {
        isUpdate = true;
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

describe('E1: Buyer completes order (delivered → completed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to completed and credits seller wallet with 90% of item price', async () => {
    const { completeOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = makeMockOrder({ status: 'delivered' });
    const completedOrder = { ...mockOrder, status: 'completed', completed_at: new Date().toISOString() };

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: completedOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await completeOrder('order-1', 'buyer-1');

    expect(result.status).toBe('completed');

    // Wallet credit = seller_wallet_credit_cents = 1350 (90% of 1500)
    expect(mockCreditWallet).toHaveBeenCalledWith(
      'seller-1',
      1350,
      'order-1',
      expect.stringContaining('Catan')
    );
  });

  it('sends completion email to seller', async () => {
    const { completeOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');
    const { sendOrderCompletedToSeller } = await import('@/lib/email');

    const mockOrder = makeMockOrder({ status: 'delivered' });
    const completedOrder = { ...mockOrder, status: 'completed' };

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: completedOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await completeOrder('order-1', 'buyer-1');

    expect(sendOrderCompletedToSeller).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerEmail: 'seller@test.com',
        orderNumber: 'STG-20260413-001',
        earningsCents: 1350,
      })
    );
  });
});

describe('E2: Auto-complete via cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-completes delivered order past dispute window and credits wallet', async () => {
    const { autoCompleteOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const deliveredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const mockOrder = makeMockOrder({
      status: 'delivered',
      delivered_at: deliveredAt,
    });
    const completedOrder = { ...mockOrder, status: 'completed', completed_at: new Date().toISOString() };

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: completedOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await autoCompleteOrder('order-1');

    expect(result).not.toBeNull();
    expect(result!.status).toBe('completed');

    // Wallet should be credited
    expect(mockCreditWallet).toHaveBeenCalledWith(
      'seller-1',
      1350,
      'order-1',
      expect.stringContaining('Catan')
    );
  });
});

describe('E3: Double-complete idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns order without side effects if already completed', async () => {
    const { autoCompleteOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = makeMockOrder({
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    const mockSupabase = {
      from: vi.fn(() => makeChainBuilder(mockOrder)),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await autoCompleteOrder('order-1');

    // Should return the order as-is
    expect(result).not.toBeNull();
    expect(result!.status).toBe('completed');

    // Wallet should NOT be credited again (early bail)
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });

  it('returns null when optimistic lock fails (race condition)', async () => {
    const { autoCompleteOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = makeMockOrder({ status: 'delivered' });

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn(() => builder);
        builder.eq = vi.fn(() => builder);
        builder.in = vi.fn(() => builder);
        builder.update = vi.fn(() => builder);
        builder.single = vi.fn(() => {
          callCount++;
          // First call: loadOrder succeeds
          // Second call: optimistic lock update fails (another process completed it)
          if (callCount === 1) {
            return Promise.resolve({ data: mockOrder, error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'No rows matched' } });
        });
        return builder;
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await autoCompleteOrder('order-1');

    // Should return null (race condition, another process handled it)
    expect(result).toBeNull();

    // No wallet credit should happen
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });
});

describe('E4: DAC7 threshold trigger on completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls updateDac7StatsOnCompletion with correct amounts on buyer complete', async () => {
    const { completeOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = makeMockOrder({
      status: 'delivered',
      items_total_cents: 1500,
      platform_commission_cents: 150,
    });
    const completedOrder = { ...mockOrder, status: 'completed' };

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: completedOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await completeOrder('order-1', 'buyer-1');

    expect(mockUpdateDac7Stats).toHaveBeenCalledWith(
      'seller-1',   // seller_id
      1500,          // items_total_cents
      150            // platform_commission_cents
    );
  });

  it('calls updateDac7StatsOnCompletion on auto-complete too', async () => {
    const { autoCompleteOrder } = await import('@/lib/services/order-transitions');
    const { createServiceClient } = await import('@/lib/supabase');

    const mockOrder = makeMockOrder({
      status: 'delivered',
      items_total_cents: 3000,
      platform_commission_cents: 300,
    });
    const completedOrder = { ...mockOrder, status: 'completed' };

    const mockSupabase = makeSmartBuilder({
      loadData: mockOrder,
      updateData: completedOrder,
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    await autoCompleteOrder('order-1');

    expect(mockUpdateDac7Stats).toHaveBeenCalledWith(
      'seller-1',
      3000,
      300
    );
  });
});
