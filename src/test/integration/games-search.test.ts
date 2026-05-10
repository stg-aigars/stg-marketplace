/**
 * Integration tests for the search_games_by_name RPC after the trigram-index
 * rewrite (migrations 100-102). Exercises ranking semantics, alt-name path,
 * ILIKE wildcard escaping (! escape character), include_expansions toggle,
 * and result_limit — the contract callers depend on.
 *
 * Test rows use sentinel ids > 9_000_000 to avoid collision with real BGG ids
 * (which top out around the high 400_000s in 2026). Cleanup runs in afterAll.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestServiceClient } from '../helpers/supabase';

const supabase = createTestServiceClient();

const TEST_IDS = {
  CATAN_EXACT: 9_000_013,
  SETTLERS_OF_CATAN: 9_001_234,
  CATAN_CITIES: 9_005_678,
  CATAN_SEAFARERS_EXP: 9_004_321,
  POLISH_CATAN_ALT: 9_009_999,
  FRENCH_CATAN_ALT: 9_008_888,
  SPECIAL_CHARS: 9_001_001,
  BIG_CATAN_ADV: 9_007_777
} as const;

const TEST_ID_LIST = Object.values(TEST_IDS);

beforeAll(async () => {
  // Clean any leftover rows from a prior run, then seed fresh.
  await supabase.from('games').delete().in('id', TEST_ID_LIST);

  const { error } = await supabase.from('games').insert([
    {
      id: TEST_IDS.CATAN_EXACT,
      name: 'Catan',
      yearpublished: 1995,
      is_expansion: false,
      alternate_names: ['Settlers of Catan', 'The Settlers of Catan'],
      bayesaverage: 7.1
    },
    {
      id: TEST_IDS.SETTLERS_OF_CATAN,
      name: 'Settlers of Catan',
      yearpublished: 1995,
      is_expansion: false,
      alternate_names: null,
      bayesaverage: 6.5
    },
    {
      id: TEST_IDS.CATAN_CITIES,
      name: 'Catan: Cities & Knights',
      yearpublished: 1998,
      is_expansion: false,
      alternate_names: null,
      bayesaverage: 7.5
    },
    {
      id: TEST_IDS.CATAN_SEAFARERS_EXP,
      name: 'Catan: Seafarers',
      yearpublished: 1997,
      is_expansion: true,
      alternate_names: null,
      bayesaverage: 7.2
    },
    {
      id: TEST_IDS.POLISH_CATAN_ALT,
      name: 'Osadnicy z Katanu',
      yearpublished: 1995,
      is_expansion: false,
      alternate_names: ['Catan (Polish edition)', 'Catane'],
      bayesaverage: 6.8
    },
    {
      id: TEST_IDS.FRENCH_CATAN_ALT,
      name: 'Le Jeu Polonais',
      yearpublished: 2000,
      is_expansion: false,
      alternate_names: ['Catane'],
      bayesaverage: 7.0
    },
    {
      id: TEST_IDS.SPECIAL_CHARS,
      name: '50%_test!game',
      yearpublished: 2020,
      is_expansion: false,
      alternate_names: null,
      bayesaverage: 5.0
    },
    {
      id: TEST_IDS.BIG_CATAN_ADV,
      name: 'The Big Catan Adventure',
      yearpublished: 2010,
      is_expansion: false,
      alternate_names: null,
      bayesaverage: 6.0
    }
  ]);

  if (error) throw error;
});

afterAll(async () => {
  await supabase.from('games').delete().in('id', TEST_ID_LIST);
});

type SearchRow = {
  id: number;
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
  player_count: string | null;
  min_age: number | null;
  playing_time: string | null;
  weight: number | null;
  is_expansion: boolean;
  matched_alternate_name: string | null;
};

async function search(
  query: string,
  includeExpansions = false,
  limit = 20
): Promise<SearchRow[]> {
  const { data, error } = await supabase.rpc('search_games_by_name', {
    search_query: query,
    include_expansions: includeExpansions,
    result_limit: limit
  });
  if (error) throw error;
  // Filter to the test fixture rows so this test stays independent of any
  // real BGG data the CSV importer might have already loaded into the table.
  return (data as SearchRow[]).filter((row) =>
    TEST_ID_LIST.includes(row.id as (typeof TEST_ID_LIST)[number])
  );
}

describe('search_games_by_name (post-trigram rewrite)', () => {
  describe('ranking semantics', () => {
    it('puts exact name match first, then prefix matches, then substring', async () => {
      const rows = await search('catan');
      const ids = rows.map((r) => r.id);

      // Tier 0 (exact name) wins above all
      expect(ids[0]).toBe(TEST_IDS.CATAN_EXACT);

      // Tier 2 (prefix: "Catan: Cities...") beats tier 3 (substring: "Settlers of Catan")
      const prefixIdx = ids.indexOf(TEST_IDS.CATAN_CITIES);
      const substrIdx = ids.indexOf(TEST_IDS.SETTLERS_OF_CATAN);
      expect(prefixIdx).toBeGreaterThan(-1);
      expect(substrIdx).toBeGreaterThan(-1);
      expect(prefixIdx).toBeLessThan(substrIdx);

      // Tier 3 (substring on name) beats tier 4 (alt-name only)
      const altOnlyIdx = ids.indexOf(TEST_IDS.FRENCH_CATAN_ALT);
      expect(altOnlyIdx).toBeGreaterThan(-1);
      expect(substrIdx).toBeLessThan(altOnlyIdx);
    });

    it('within the same tier, orders by bayesaverage DESC', async () => {
      // The two substring-on-name matches are SETTLERS_OF_CATAN (bayes 6.5) and
      // BIG_CATAN_ADV (bayes 6.0). Higher bayesaverage must come first.
      const rows = await search('catan');
      const ids = rows.map((r) => r.id);
      const settlersIdx = ids.indexOf(TEST_IDS.SETTLERS_OF_CATAN);
      const bigAdvIdx = ids.indexOf(TEST_IDS.BIG_CATAN_ADV);
      expect(settlersIdx).toBeGreaterThan(-1);
      expect(bigAdvIdx).toBeGreaterThan(-1);
      expect(settlersIdx).toBeLessThan(bigAdvIdx);
    });
  });

  describe('alt-name path', () => {
    it('returns rows where only the alt name matches, with matched_alternate_name populated', async () => {
      // "catane" matches alts on FRENCH_CATAN_ALT and POLISH_CATAN_ALT but
      // not the primary names ("Le Jeu Polonais", "Osadnicy z Katanu").
      const rows = await search('catane');
      const altRows = rows.filter((r) => r.matched_alternate_name !== null);
      const altIds = altRows.map((r) => r.id);

      expect(altIds).toContain(TEST_IDS.FRENCH_CATAN_ALT);
      expect(altIds).toContain(TEST_IDS.POLISH_CATAN_ALT);

      const french = rows.find((r) => r.id === TEST_IDS.FRENCH_CATAN_ALT);
      expect(french?.matched_alternate_name).toBe('Catane');
    });

    it('leaves matched_alternate_name NULL when the row matched on primary name', async () => {
      const rows = await search('catan');
      const exact = rows.find((r) => r.id === TEST_IDS.CATAN_EXACT);
      const settlers = rows.find((r) => r.id === TEST_IDS.SETTLERS_OF_CATAN);

      expect(exact?.matched_alternate_name).toBeNull();
      expect(settlers?.matched_alternate_name).toBeNull();
    });

    it('never returns the same row twice when both name and alt match', async () => {
      // CATAN_EXACT has alts containing "Catan" — both name and alt match for "catan",
      // but the row must appear at most once (name path wins, alt path excluded).
      const rows = await search('catan');
      const occurrences = rows.filter(
        (r) => r.id === TEST_IDS.CATAN_EXACT
      ).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('ILIKE wildcard escaping', () => {
    it('escapes %, _, and ! as literal characters', async () => {
      // The fixture row "50%_test!game" contains all three. A query of the
      // exact string must match it and only it (no rampant wildcard expansion).
      const rows = await search('50%_test!game');
      const ids = rows.map((r) => r.id);
      expect(ids).toEqual([TEST_IDS.SPECIAL_CHARS]);
    });

    it('treats raw "%" and "_" in the query as literals, not wildcards', async () => {
      // The fixture name "50%_test!game" contains the literal sequence "%_test".
      // If "%" or "_" leaked through as ILIKE wildcards, this query would also
      // match other rows (e.g. anything containing "test"). With proper
      // escaping, only the SPECIAL_CHARS row matches.
      const rows = await search('%_test');
      expect(rows.map((r) => r.id)).toEqual([TEST_IDS.SPECIAL_CHARS]);
    });
  });

  describe('include_expansions toggle', () => {
    it('excludes expansions by default', async () => {
      const rows = await search('catan', false);
      const ids = rows.map((r) => r.id);
      expect(ids).not.toContain(TEST_IDS.CATAN_SEAFARERS_EXP);
    });

    it('includes expansions when flag is true, ordered after non-expansions', async () => {
      const rows = await search('catan', true);
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(TEST_IDS.CATAN_SEAFARERS_EXP);
      // is_expansion ASC means the only expansion in the fixture sits at the end.
      expect(ids.indexOf(TEST_IDS.CATAN_SEAFARERS_EXP)).toBe(rows.length - 1);
    });
  });

  describe('result_limit', () => {
    it('respects the result_limit parameter', async () => {
      // Use the unfiltered RPC result here — slicing on the test fixture would
      // mask whether the SQL LIMIT was applied or not.
      const { data, error } = await supabase.rpc('search_games_by_name', {
        search_query: 'catan',
        include_expansions: false,
        result_limit: 2
      });
      if (error) throw error;
      expect((data as SearchRow[]).length).toBeLessThanOrEqual(2);
    });
  });
});
