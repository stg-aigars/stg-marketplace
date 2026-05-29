/**
 * Pure fan-out helper for cart cross-sell suggestions.
 *
 * Dispatches one `fetchOne` call per seller (capped at `cap`), uses Promise.allSettled
 * so a single seller's failure can't tank the whole map, and logs rejections via the
 * injected `logError` callback. The route handler wraps this with a closure-bound
 * `fetchOne` that knows each seller's cart-item exclude list.
 *
 * Generic over the per-seller row type — the route handler picks the shape that
 * matches its downstream consumer (e.g. `ListingSectionItem`).
 *
 * `logError` is invoked synchronously per rejection; an async callback's returned
 * Promise is not awaited.
 */
export async function buildSuggestionsMap<T>(
  sellerIds: string[],
  fetchOne: (sellerId: string) => Promise<T[]>,
  logError: (sellerId: string, err: unknown) => void,
  cap: number = 5,
): Promise<Record<string, T[]>> {
  const targets = sellerIds.slice(0, cap);
  const results = await Promise.allSettled(targets.map((sid) => fetchOne(sid)));

  const map: Record<string, T[]> = {};
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
