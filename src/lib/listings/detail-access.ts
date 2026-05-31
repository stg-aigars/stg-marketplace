import type { ListingStatus } from './types';

/** Statuses at which a listing is visible to anyone, including anonymous visitors. */
const PUBLICLY_VIEWABLE_STATUSES: readonly ListingStatus[] = ['active', 'reserved', 'auction_ended'];

/**
 * Whether a listing is visible to anyone (anonymous included). Callers use this
 * to decide whether they even need to check order-participation — for a public
 * status, nobody needs the buyer/owner probe.
 *
 * Note: a won auction settles to status `auction_ended` (not `sold` — see
 * `markListingsAsSold` in order-transitions.ts), so it stays publicly viewable
 * and an auction winner reaches the public auction view rather than the
 * "you purchased this" buyer panel. That's a known limitation, not handled here.
 */
export function isPubliclyViewableStatus(status: ListingStatus): boolean {
  return PUBLICLY_VIEWABLE_STATUSES.includes(status);
}

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
  if (isPubliclyViewableStatus(status)) return true;
  return isOwner || isOrderBuyer;
}
