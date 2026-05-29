import { describe, it, expect, vi } from 'vitest';
import { buildSuggestionsMap } from './suggestions';

/** Local fixture shape — `buildSuggestionsMap` is generic, so the test picks a minimal row. */
interface TestListing {
  listingId: string;
  gameTitle: string;
  priceCents: number;
}

function mkListing(id: string): TestListing {
  return {
    listingId: id,
    gameTitle: `Game ${id}`,
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

  it('returns suggestions = {} when every fetchOne rejects, logging each', async () => {
    const fetchOne = vi.fn(async () => {
      throw new Error('db hiccup');
    });
    const logError = vi.fn();

    const result = await buildSuggestionsMap(['s1', 's2'], fetchOne, logError);

    expect(result).toEqual({});
    expect(logError).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledWith('s1', expect.any(Error));
    expect(logError).toHaveBeenCalledWith('s2', expect.any(Error));
  });

  it('partitions fulfilled and rejected sellers independently', async () => {
    const fetchOne = vi.fn(async (sellerId: string) => {
      if (sellerId === 'bad') throw new Error('boom');
      return [mkListing(`${sellerId}-a`)];
    });
    const logError = vi.fn();

    const result = await buildSuggestionsMap(['good1', 'bad', 'good2'], fetchOne, logError);

    expect(result).toEqual({
      good1: [mkListing('good1-a')],
      good2: [mkListing('good2-a')],
    });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('bad', expect.any(Error));
  });

  it('caps fan-out at first N sellers in input order', async () => {
    const fetchOne = vi.fn(async (sellerId: string) => [mkListing(`${sellerId}-a`)]);
    const logError = vi.fn();

    await buildSuggestionsMap(['a', 'b', 'c', 'd', 'e', 'f', 'g'], fetchOne, logError, 5);

    expect(fetchOne).toHaveBeenCalledTimes(5);
    expect(fetchOne).toHaveBeenNthCalledWith(1, 'a');
    expect(fetchOne).toHaveBeenNthCalledWith(2, 'b');
    expect(fetchOne).toHaveBeenNthCalledWith(3, 'c');
    expect(fetchOne).toHaveBeenNthCalledWith(4, 'd');
    expect(fetchOne).toHaveBeenNthCalledWith(5, 'e');
  });

  it('returns {} and dispatches nothing when sellerIds is empty', async () => {
    const fetchOne = vi.fn(async () => [mkListing('x')]);
    const logError = vi.fn();

    const result = await buildSuggestionsMap([], fetchOne, logError);

    expect(result).toEqual({});
    expect(fetchOne).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });
});
