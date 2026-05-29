import type { ListingCondition } from '@/lib/listings/types';

export interface SuggestionListing {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
}

/**
 * Pure fan-out helper for cart cross-sell suggestions.
 *
 * Dispatches one `fetchOne` call per seller (capped at `cap`), uses Promise.allSettled
 * so a single seller's failure can't tank the whole map, and logs rejections via the
 * injected `logError` callback. The route handler wraps this with a closure-bound
 * `fetchOne` that knows each seller's cart-item exclude list.
 *
 * `logError` is invoked synchronously per rejection; an async callback's returned
 * Promise is not awaited.
 */
export async function buildSuggestionsMap(
  sellerIds: string[],
  fetchOne: (sellerId: string) => Promise<SuggestionListing[]>,
  logError: (sellerId: string, err: unknown) => void,
  cap: number = 5,
): Promise<Record<string, SuggestionListing[]>> {
  const targets = sellerIds.slice(0, cap);
  const results = await Promise.allSettled(targets.map((sid) => fetchOne(sid)));

  const map: Record<string, SuggestionListing[]> = {};
  for (let i = 0; i < targets.length; i++) {
    const sellerId = targets[i];
    const settled = results[i];
    if (settled.status === 'fulfilled') {
      map[sellerId] = settled.value;
    } else {
      logError(sellerId, settled.reason);
    }
  }
  return map;
}
