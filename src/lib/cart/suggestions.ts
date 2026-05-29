/** Bare DB row shape returned by the per-seller suggestion query. Not the full CartSuggestion (expansion counts decorated later in the route). */
export interface SuggestionListing {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable';
  priceCents: number;
}

export async function buildSuggestionsMap(
  _sellerIds: string[],
  _fetchOne: (sellerId: string) => Promise<SuggestionListing[]>,
  _logError: (sellerId: string, err: unknown) => void,
  _cap: number = 5,
): Promise<Record<string, SuggestionListing[]>> {
  throw new Error('not implemented');
}
