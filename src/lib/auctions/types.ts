// ============================================================================
// Auction Constants
// ============================================================================

export type AuctionDuration = 7 | 14;

export const AUCTION_DURATIONS: AuctionDuration[] = [7, 14];

export const AUCTION_DURATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
];

export const MIN_BID_INCREMENT_CENTS = 100; // €1.00

export const SOFT_CLOSE_WINDOW_HOURS = 24;
export const QUIET_WINDOW_MS = 30 * 60 * 1000;

export const PAYMENT_DEADLINE_HOURS = 24;

export const PAYMENT_REMINDER_HOURS = 12;

// ============================================================================
// Bid Types
// ============================================================================

export interface BidRow {
  id: string;
  listing_id: string;
  bidder_id: string;
  amount_cents: number;
  created_at: string;
}

export interface BidWithBidder extends BidRow {
  bidder_name: string;
  bidder_avatar_url: string | null;
  bidder_country: string | null;
}

// ============================================================================
// Auction Listing Fields (extends base listing)
// ============================================================================

export interface AuctionFields {
  listing_type: 'auction';
  auction_end_at: string;
  auction_original_end_at: string;
  starting_price_cents: number;
  current_bid_cents: number | null;
  bid_count: number;
  highest_bidder_id: string | null;
  payment_deadline_at: string | null;
  auction_payment_reminder_sent: boolean;
}

// ============================================================================
// Place Bid RPC Result
// ============================================================================

export interface PlaceBidResult {
  success: boolean;
  error?: string;
  new_end_at?: string;
  bid_count?: number;
  prev_bidder_id?: string | null;
}

// ============================================================================
// Auction State (for client-side polling)
// ============================================================================

export interface AuctionState {
  currentBidCents: number | null;
  startingPriceCents: number;
  bidCount: number;
  highestBidderId: string | null;
  auctionEndAt: string;
  status: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Calculate minimum bid amount for an auction. */
export function getMinimumBid(
  currentBidCents: number | null,
  startingPriceCents: number
): number {
  if (currentBidCents === null) return startingPriceCents;
  return currentBidCents + MIN_BID_INCREMENT_CENTS;
}

// TODO: revisit thresholds after launch — may need more granular tiers
// (e.g., +€10/+€25 above €100)
export function getQuickBidIncrements(minBidCents: number): [number, number] {
  if (minBidCents < 5000) return [200, 400];   // +€2, +€4 under €50
  return [500, 1000];                            // +€5, +€10 above €50
}
