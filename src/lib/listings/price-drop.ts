import type { ListingType } from './types';

export const PRICE_DROP_WINDOW_DAYS = 14;

const WINDOW_MS = PRICE_DROP_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Single source of truth for "is this listing's price drop visible right now?"
 *
 * SQL mirror: the browse query filters by the `has_price_decrease` generated
 * column (directional fact: price_cents < previous_price_cents) plus a
 * `price_changed_at > now() - 14d AND price_changed_at <= now()` predicate
 * (freshness window). Helper computes all conditions inline; SQL short-circuits
 * the directional check via the generated column. Semantics are identical —
 * any change to one side must update the other (see migration 122).
 *
 * SSR caching: helper evaluates against `Date.now()` at render time. Browse
 * pages are dynamic today (searchParams forces dynamic rendering), so the
 * visual is always fresh. A future PPR/ISR migration touching browse would
 * need to revisit — a cached card could show a stale strike up to the
 * revalidate TTL after the 14d boundary.
 *
 * Narrowing contract: when this returns true, `previous_price_cents` is
 * guaranteed non-null. Callers using `listing.previous_price_cents!` after
 * an `isPriceDropActive(listing)` check are relying on this contract.
 */
export function isPriceDropActive(listing: {
  listing_type: ListingType;
  price_cents: number;
  previous_price_cents: number | null;
  price_changed_at: string | null;
}): boolean {
  if (listing.listing_type !== 'fixed_price') return false;
  if (listing.previous_price_cents == null || listing.price_changed_at == null) return false;
  if (listing.price_cents >= listing.previous_price_cents) return false;
  const now = Date.now();
  const changedAt = new Date(listing.price_changed_at).getTime();
  if (changedAt > now) return false;
  return changedAt > now - WINDOW_MS;
}
