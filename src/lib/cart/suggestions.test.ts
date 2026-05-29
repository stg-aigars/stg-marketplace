import { describe, it, expect, vi } from 'vitest';
import { buildSuggestionsMap, type SuggestionListing } from './suggestions';

function mkListing(id: string): SuggestionListing {
  return {
    listingId: id,
    gameTitle: `Game ${id}`,
    gameThumbnail: null,
    firstPhoto: null,
    condition: 'good',
    priceCents: 1000,
  };
}

describe('buildSuggestionsMap', () => {
  it('returns each seller mapped to their fetched listings', async () => {
    const fetchOne = vi.fn(async (sellerId: string) => [
      mkListing(`${sellerId}-a`),
      mkListing(`${sellerId}-b`),
    ]);
    const logError = vi.fn();

    const result = await buildSuggestionsMap(['s1', 's2'], fetchOne, logError);

    expect(result).toEqual({
      s1: [mkListing('s1-a'), mkListing('s1-b')],
      s2: [mkListing('s2-a'), mkListing('s2-b')],
    });
    expect(fetchOne).toHaveBeenCalledTimes(2);
    expect(logError).not.toHaveBeenCalled();
  });
});
