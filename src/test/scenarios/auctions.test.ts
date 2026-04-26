/**
 * Auction scenario tests (G1-G6).
 *
 * Tests the end-auctions and auction-payment-deadline cron route handlers
 * by mocking Supabase, email, and notification dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockNotify = vi.fn();
const mockNotifyMany = vi.fn();
const mockFetchProfiles = vi.fn();
const mockSendAuctionWonToWinner = vi.fn((..._args: unknown[]) => Promise.resolve());
const mockSendAuctionWonToSeller = vi.fn((..._args: unknown[]) => Promise.resolve());
const mockSendAuctionLostNotification = vi.fn((..._args: unknown[]) => Promise.resolve());
const mockSendAuctionEndedNoBidsToSeller = vi.fn((..._args: unknown[]) => Promise.resolve());
const mockSendAuctionPaymentReminderToWinner = vi.fn((..._args: unknown[]) => Promise.resolve());
const mockSendAuctionPaymentExpired = vi.fn((..._args: unknown[]) => Promise.resolve());

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('@/lib/env', () => ({
  env: { cron: { secret: 'test-secret' } },
}));
vi.mock('@/lib/notifications', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
}));
vi.mock('@/lib/supabase/helpers', () => ({
  fetchProfiles: (...args: unknown[]) => mockFetchProfiles(...args),
}));

// Mocks for G5 (fulfillCartPayment dependencies)
const mockCreateOrder = vi.fn();
const mockDebitWallet = vi.fn();
const mockCreditWallet = vi.fn();
const mockRefundToWallet = vi.fn();
const mockRefundPayment = vi.fn();
const mockSendCartOrderEmails = vi.fn();
const mockLogAuditEvent = vi.fn();

vi.mock('@/lib/services/orders', () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));
vi.mock('@/lib/services/wallet', () => ({
  debitWallet: (...args: unknown[]) => mockDebitWallet(...args),
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
  refundToWallet: (...args: unknown[]) => mockRefundToWallet(...args),
}));
vi.mock('@/lib/services/everypay/client', () => ({
  refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
}));
vi.mock('@/lib/email/cart-emails', () => ({
  sendCartOrderEmails: (...args: unknown[]) => mockSendCartOrderEmails(...args),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));
vi.mock('@/lib/email', () => ({
  sendAuctionWonToWinner: (...args: unknown[]) => mockSendAuctionWonToWinner(...args),
  sendAuctionWonToSeller: (...args: unknown[]) => mockSendAuctionWonToSeller(...args),
  sendAuctionLostNotification: (...args: unknown[]) => mockSendAuctionLostNotification(...args),
  sendAuctionEndedNoBidsToSeller: (...args: unknown[]) => mockSendAuctionEndedNoBidsToSeller(...args),
  sendAuctionPaymentReminderToWinner: (...args: unknown[]) => mockSendAuctionPaymentReminderToWinner(...args),
  sendAuctionPaymentExpired: (...args: unknown[]) => mockSendAuctionPaymentExpired(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(secret = 'test-secret') {
  return new Request('http://localhost:3000/api/cron/end-auctions', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

function makePaymentDeadlineRequest(secret = 'test-secret') {
  return new Request('http://localhost:3000/api/cron/auction-payment-deadline', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

/** Build a chainable Supabase query builder mock that resolves with configurable data. */
function makeQueryBuilder(resolvedData: unknown = null, resolvedError: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'neq', 'lt', 'gt', 'in', 'not', 'limit', 'update', 'returns'];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  // Terminal — resolves the promise
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: resolvedData, error: resolvedError });
  return builder;
}

function makeProfile(id: string, name: string, email: string) {
  return { id, full_name: name, email, avatar_url: null };
}

// ---------------------------------------------------------------------------
// G1-G2, G6: end-auctions cron
// ---------------------------------------------------------------------------

describe('end-auctions cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('G1: auction with bids -> status auction_ended, winner notified', async () => {
    const { createServiceClient } = await import('@/lib/supabase');

    const auctionRow = {
      id: 'auction-1',
      seller_id: 'seller-1',
      game_name: 'Catan',
      bid_count: 3,
      highest_bidder_id: 'bidder-1',
      current_bid_cents: 2500,
    };

    const profiles = new Map([
      ['seller-1', makeProfile('seller-1', 'Seller', 'seller@test.com')],
      ['bidder-1', makeProfile('bidder-1', 'Winner', 'winner@test.com')],
    ]);
    mockFetchProfiles.mockResolvedValue(profiles);

    const updateBuilder = makeQueryBuilder([{ id: 'auction-1' }]);
    const bidsBuilder = makeQueryBuilder([]); // no losing bidders for G1

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          // First call: select expired auctions; second call: update
          const selectBuilder = makeQueryBuilder([auctionRow]);
          // Make update return a fresh builder that chains to a result
          selectBuilder.update = vi.fn(() => updateBuilder);
          return selectBuilder;
        }
        if (table === 'bids') return bidsBuilder;
        return makeQueryBuilder();
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const { POST } = await import('@/app/api/cron/end-auctions/route');
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(body.endedWithBids).toBe(1);
    expect(body.endedNoBids).toBe(0);

    // Winner notified
    expect(mockNotify).toHaveBeenCalledWith('bidder-1', 'auction.won', {
      gameName: 'Catan',
      listingId: 'auction-1',
    });

    // Winner emailed
    expect(mockSendAuctionWonToWinner).toHaveBeenCalledWith(
      expect.objectContaining({
        winnerEmail: 'winner@test.com',
        gameName: 'Catan',
        winningBidCents: 2500,
      })
    );

    // Seller notified
    expect(mockNotify).toHaveBeenCalledWith('seller-1', 'auction.won_seller', expect.objectContaining({
      gameName: 'Catan',
    }));
  });

  it('G2: auction with no bids -> status cancelled, seller notified', async () => {
    const { createServiceClient } = await import('@/lib/supabase');

    const auctionRow = {
      id: 'auction-2',
      seller_id: 'seller-2',
      game_name: 'Wingspan',
      bid_count: 0,
      highest_bidder_id: null,
      current_bid_cents: null,
    };

    const profiles = new Map([
      ['seller-2', makeProfile('seller-2', 'Seller Two', 'seller2@test.com')],
    ]);
    mockFetchProfiles.mockResolvedValue(profiles);

    const updateBuilder = makeQueryBuilder([{ id: 'auction-2' }]);

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          const selectBuilder = makeQueryBuilder([auctionRow]);
          selectBuilder.update = vi.fn(() => updateBuilder);
          return selectBuilder;
        }
        if (table === 'bids') return makeQueryBuilder([]);
        return makeQueryBuilder();
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const { POST } = await import('@/app/api/cron/end-auctions/route');
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(body.endedWithBids).toBe(0);
    expect(body.endedNoBids).toBe(1);

    // Seller notified about no bids
    expect(mockNotify).toHaveBeenCalledWith('seller-2', 'auction.ended_no_bids', {
      gameName: 'Wingspan',
    });

    // Seller emailed
    expect(mockSendAuctionEndedNoBidsToSeller).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerEmail: 'seller2@test.com',
        gameName: 'Wingspan',
      })
    );
  });

  it('G6: losing bidders notified when auction ends with 3 bidders', async () => {
    const { createServiceClient } = await import('@/lib/supabase');

    const auctionRow = {
      id: 'auction-3',
      seller_id: 'seller-3',
      game_name: 'Azul',
      bid_count: 5,
      highest_bidder_id: 'winner-1',
      current_bid_cents: 3000,
    };

    // 3 bidders total: winner-1 (winner), loser-1, loser-2
    const bidRows = [
      { listing_id: 'auction-3', bidder_id: 'winner-1' },
      { listing_id: 'auction-3', bidder_id: 'loser-1' },
      { listing_id: 'auction-3', bidder_id: 'loser-2' },
      { listing_id: 'auction-3', bidder_id: 'loser-1' }, // duplicate bid from loser-1
    ];

    const profiles = new Map([
      ['seller-3', makeProfile('seller-3', 'Seller Three', 'seller3@test.com')],
      ['winner-1', makeProfile('winner-1', 'Winner', 'winner@test.com')],
      ['loser-1', makeProfile('loser-1', 'Loser One', 'loser1@test.com')],
      ['loser-2', makeProfile('loser-2', 'Loser Two', 'loser2@test.com')],
    ]);
    mockFetchProfiles.mockResolvedValue(profiles);

    const updateBuilder = makeQueryBuilder([{ id: 'auction-3' }]);

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          const selectBuilder = makeQueryBuilder([auctionRow]);
          selectBuilder.update = vi.fn(() => updateBuilder);
          return selectBuilder;
        }
        if (table === 'bids') return makeQueryBuilder(bidRows);
        return makeQueryBuilder();
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const { POST } = await import('@/app/api/cron/end-auctions/route');
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(body.endedWithBids).toBe(1);

    // notifyMany called with exactly 2 losing bidder notifications (deduplicated)
    expect(mockNotifyMany).toHaveBeenCalledTimes(1);
    const notifications = mockNotifyMany.mock.calls[0][0];
    expect(notifications).toHaveLength(2);

    const notifiedIds = notifications.map((n: { userId: string }) => n.userId).sort();
    expect(notifiedIds).toEqual(['loser-1', 'loser-2']);

    for (const n of notifications) {
      expect(n.type).toBe('auction.lost');
      expect(n.context.gameName).toBe('Azul');
    }

    // Losing bidders emailed
    expect(mockSendAuctionLostNotification).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// G3-G4: auction-payment-deadline cron
// ---------------------------------------------------------------------------

describe('auction-payment-deadline cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('G3: 12h payment reminder sent when deadline approaching', async () => {
    const { createServiceClient } = await import('@/lib/supabase');

    const reminderAuction = {
      id: 'auction-r1',
      game_name: 'Spirit Island',
      highest_bidder_id: 'bidder-r1',
      payment_deadline_at: new Date('2026-04-13T20:00:00Z').toISOString(), // 8h from now (within 12h)
    };

    const profiles = new Map([
      ['bidder-r1', makeProfile('bidder-r1', 'Bidder', 'bidder@test.com')],
    ]);
    mockFetchProfiles.mockResolvedValue(profiles);

    // The reminder query returns this auction; the update (optimistic lock) succeeds
    const reminderUpdateBuilder = makeQueryBuilder([{ id: 'auction-r1' }]);
    // Deadline query returns nothing (no expired auctions)
    const deadlineBuilder = makeQueryBuilder([]);

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          callCount++;
          if (callCount === 1) {
            // First: reminder query
            return makeQueryBuilder([reminderAuction]);
          }
          if (callCount === 2) {
            // Second: optimistic update for reminder flag
            const b = makeQueryBuilder();
            b.update = vi.fn(() => reminderUpdateBuilder);
            return { update: vi.fn(() => reminderUpdateBuilder) };
          }
          // Third: deadline expiry query
          return deadlineBuilder;
        }
        return makeQueryBuilder();
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const { POST } = await import('@/app/api/cron/auction-payment-deadline/route');
    const response = await POST(makePaymentDeadlineRequest());
    const body = await response.json();

    expect(body.remindersSent).toBe(1);

    // Winner notified
    expect(mockNotify).toHaveBeenCalledWith('bidder-r1', 'auction.payment_reminder', {
      gameName: 'Spirit Island',
      listingId: 'auction-r1',
    });

    // Winner emailed
    expect(mockSendAuctionPaymentReminderToWinner).toHaveBeenCalledWith(
      expect.objectContaining({
        winnerEmail: 'bidder@test.com',
        gameName: 'Spirit Island',
      })
    );
  });

  it('G4: 24h no payment -> auction cancelled', async () => {
    const { createServiceClient } = await import('@/lib/supabase');

    const expiredAuction = {
      id: 'auction-e1',
      seller_id: 'seller-e1',
      game_name: 'Gloomhaven',
      highest_bidder_id: 'bidder-e1',
    };

    const profiles = new Map([
      ['seller-e1', makeProfile('seller-e1', 'Seller', 'seller@test.com')],
      ['bidder-e1', makeProfile('bidder-e1', 'Bidder', 'bidder@test.com')],
    ]);
    mockFetchProfiles.mockResolvedValue(profiles);

    // Reminder query returns nothing; deadline query returns expired auction
    const cancelUpdateBuilder = makeQueryBuilder([{ id: 'auction-e1' }]);

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          callCount++;
          if (callCount === 1) {
            // Reminder query: nothing pending
            return makeQueryBuilder([]);
          }
          // Deadline expiry query
          const b = makeQueryBuilder([expiredAuction]);
          b.update = vi.fn(() => cancelUpdateBuilder);
          return b;
        }
        return makeQueryBuilder();
      }),
    };

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const { POST } = await import('@/app/api/cron/auction-payment-deadline/route');
    const response = await POST(makePaymentDeadlineRequest());
    const body = await response.json();

    expect(body.expired).toBe(1);

    // Both parties notified
    expect(mockNotify).toHaveBeenCalledWith('bidder-e1', 'auction.payment_expired', expect.objectContaining({
      gameName: 'Gloomhaven',
    }));
    expect(mockNotify).toHaveBeenCalledWith('seller-e1', 'auction.payment_expired_seller', expect.objectContaining({
      gameName: 'Gloomhaven',
    }));

    // Both emailed
    expect(mockSendAuctionPaymentExpired).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// G5: Price tamper-proof — fulfillment uses DB current_bid_cents, not client
// ---------------------------------------------------------------------------

describe('auction price tamper-proof (G5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses current_bid_cents from DB instead of client-provided price_cents for auctions', async () => {
    // This tests the logic in fulfillCartPayment lines 122-127:
    // auction items get price_cents overridden with current_bid_cents from DB.
    //
    // We verify by checking what price is passed to createOrder.

    const { fulfillCartPayment } = await import('@/lib/services/payment-fulfillment');

    const group = {
      id: 'group-1',
      order_number: 'STG-20260413-001',
      callback_token: 'cb-1',
      buyer_id: 'buyer-1',
      terminal_id: 't1',
      terminal_name: 'Omniva Riga',
      terminal_address: null,
      terminal_city: null,
      terminal_postal_code: null,
      terminal_country: 'LV',
      buyer_phone: '+37120000001',
      total_amount_cents: 5000, // client thinks 50.00
      wallet_debit_cents: 0,
      wallet_allocation: {},
      listing_ids: ['listing-auction-1'],
      everypay_payment_reference: 'ep-ref-1',
      status: 'pending' as const,
      created_at: '2026-04-13T10:00:00Z',
    };

    // DB returns the listing with price_cents=5000 (original list price)
    // but current_bid_cents=2500 (actual winning bid)
    const dbListing = {
      id: 'listing-auction-1',
      seller_id: 'seller-1',
      price_cents: 5000,          // original starting price
      status: 'auction_ended',
      country: 'LV',
      game_name: 'Ticket to Ride',
      reserved_by: null,
      listing_type: 'auction',
      highest_bidder_id: 'buyer-1',
      current_bid_cents: 2500,    // actual winning bid
    };

    // Track what createOrder receives
    mockCreateOrder.mockResolvedValue({
      id: 'order-1',
      order_number: 'STG-20260413-001',
    });

    const listingsSelectBuilder = makeQueryBuilder([dbListing]);
    const expansionsBuilder = makeQueryBuilder([]);
    const ordersSelectBuilder = makeQueryBuilder([]); // no existing orders

    const mockServiceClient = {
      from: vi.fn((table: string) => {
        if (table === 'orders') return ordersSelectBuilder;
        if (table === 'listings') return listingsSelectBuilder;
        if (table === 'listing_expansions') return expansionsBuilder;
        if (table === 'cart_checkout_groups') return makeQueryBuilder();
        return makeQueryBuilder();
      }),
    };

    const result = await fulfillCartPayment(
      group,
      'ep-ref-1',
      'settled',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockServiceClient as any,
      'card'
    );

    expect(result.outcome).toBe('created');

    // The critical assertion: createOrder was called with the DB bid price (2500),
    // NOT the client-supplied price (5000)
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ listingId: 'listing-auction-1', priceCents: 2500 }],
      })
    );
  });
});
