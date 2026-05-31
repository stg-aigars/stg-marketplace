import { describe, it, expect } from 'vitest';
import { canViewListingDetail } from './detail-access';

describe('canViewListingDetail', () => {
  it('shows active, reserved, and auction_ended listings to anyone', () => {
    for (const status of ['active', 'reserved', 'auction_ended'] as const) {
      expect(canViewListingDetail(status, false, false)).toBe(true);
    }
  });

  it('shows a sold listing to the seller (owner)', () => {
    expect(canViewListingDetail('sold', true, false)).toBe(true);
  });

  it('shows a sold listing to the buyer who has an order for it', () => {
    expect(canViewListingDetail('sold', false, true)).toBe(true);
  });

  it('hides a sold listing from unrelated viewers', () => {
    expect(canViewListingDetail('sold', false, false)).toBe(false);
  });

  it('shows a cancelled listing to its order buyer but hides it from others', () => {
    expect(canViewListingDetail('cancelled', false, true)).toBe(true);
    expect(canViewListingDetail('cancelled', false, false)).toBe(false);
  });
});
