import type { ListingStatus } from './types';

/** Statuses at which a listing is visible to anyone, including anonymous visitors. */
const PUBLICLY_VIEWABLE_STATUSES: readonly ListingStatus[] = ['active', 'reserved', 'auction_ended'];

/**
 * Whether a viewer may see the full listing detail page rather than the
 * "no longer available" screen.
 *
 * Active / reserved / auction_ended listings are public. Once a listing is
 * sold (or cancelled) it is hidden from the public — but the seller (owner) and
 * any buyer who has an order for the listing must still be able to open it, so a
 * buyer can always revisit a game they purchased from their order.
 */
export function canViewListingDetail(
  status: ListingStatus,
  isOwner: boolean,
  isOrderBuyer: boolean,
): boolean {
  if (PUBLICLY_VIEWABLE_STATUSES.includes(status)) return true;
  return isOwner || isOrderBuyer;
}
