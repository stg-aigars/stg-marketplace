-- Add normalized + token-AND search tiers to search_games_by_name.
--
-- The trigram-indexed ILIKE substring path from migration 102 requires the
-- query to appear as a contiguous substring of the stored name. Two real
-- user-reported failure modes:
--   1. Punctuation mismatch: "Exit the Game Sinister Mansion" cannot find
--      "EXIT: The Game - The Sinister Mansion" because the colon, en-dash,
--      and extra "The" break the substring.
--   2. Token reorder: "sinister exit" returns nothing because tokens must
--      appear contiguously in the stored name.
--
-- This migration adds:
--   * IMMUTABLE helper normalize_game_name(text) that lowercases input and
--     collapses runs of non-alphanumeric characters to a single space.
--   * GIN tsvector index on to_tsvector('simple', normalize_game_name(name)).
--     The 'simple' tsearch config tokenizes on word boundaries with no
--     stemming and no stop words — perfect for game titles where every word
--     is signal.
--   * Two new CTEs in search_games_by_name (rank tiers 5 + 6) that match when
--     every query token (after normalization, length >= 2) is present in the
--     normalized name (rank 5) or in one of the normalized alternate names
--     (rank 6), in any order, via @@ tsquery. Each query token gets a `:*`
--     prefix so partial words still match (e.g. "wing" finds "wingspan").
--
-- An earlier draft of this migration used trigram GIN + LIKE ALL (array),
-- but the planner can't decompose LIKE ALL into per-pattern index lookups
-- and falls back to seq scan. tsvector @@ tsquery is Postgres's native
-- token-AND predicate with native GIN index support.
--
-- Existing tiers 0-4 are unchanged and rank above the new tiers, so every
-- query that returns results today returns the same top results. The new
-- tiers only fill previously-empty results, or rank below existing matches.
--
-- Diacritic-insensitive matching ("pokemon" -> "Pokémon", "meza" -> "Mežā")
-- is a follow-up: it needs the unaccent extension + an IMMUTABLE wrapper and
-- is not part of the user-reported issue. The regex below intentionally
-- preserves non-ASCII letters so today's localized alt names keep working.

-- 1. Normalization helper. IMMUTABLE + PARALLEL SAFE so the index expression
-- below is valid and the planner can use it in parallel scans.
CREATE OR REPLACE FUNCTION public.normalize_game_name(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT trim(regexp_replace(lower(coalesce(input, '')), '[^[:alnum:]]+', ' ', 'g'));
$$;

GRANT EXECUTE ON FUNCTION public.normalize_game_name(TEXT) TO authenticated, anon;

-- 2. GIN tsvector index over the normalized expression. CONCURRENTLY is
-- incompatible with the transaction-wrapped Supabase migration runner (see
-- migration 101 for the same rationale); games is ~175k rows with low write
-- volume so the brief AccessExclusive lock during CREATE INDEX is acceptable.
-- The 'simple' config and the qualified normalize_game_name reference must
-- match the @@ predicate in the RPC exactly for the planner to use this index.
CREATE INDEX IF NOT EXISTS idx_games_name_normalized_tsv
  ON public.games
  USING gin (to_tsvector('simple'::regconfig, public.normalize_game_name(name)));

-- 3. Rewrite search_games_by_name. Signature and return shape unchanged;
-- existing CTEs name_hits / alt_hits unchanged. Two new CTEs appended.
CREATE OR REPLACE FUNCTION public.search_games_by_name(
  search_query TEXT,
  include_expansions BOOLEAN DEFAULT FALSE,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  yearpublished INTEGER,
  thumbnail TEXT,
  player_count TEXT,
  min_age INTEGER,
  playing_time TEXT,
  weight NUMERIC,
  is_expansion BOOLEAN,
  matched_alternate_name TEXT
) AS $$
DECLARE
  safe_query TEXT;
  lower_query TEXT;
  ts_query tsquery;
BEGIN
  -- Escape ILIKE wildcards using '!' (see migration 046 for the
  -- standard_conforming_strings rationale).
  safe_query := replace(replace(replace(search_query, '!', '!!'), '%', '!%'), '_', '!_');
  lower_query := lower(search_query);

  -- Build a prefix-match tsquery from normalized tokens, length >= 2 only.
  -- Each token becomes `t:*` (prefix match), joined with ` & ` (AND). Tokens
  -- are already lowercased by normalize_game_name and contain no tsquery
  -- syntax characters (regex stripped them), so string concatenation is safe.
  -- When no usable tokens remain, string_agg over an empty set returns NULL
  -- and to_tsquery is STRICT, so ts_query ends up NULL. The IS NOT NULL guard
  -- in the new CTEs then short-circuits to behavior identical to migration 102.
  SELECT to_tsquery('simple'::regconfig, string_agg(t || ':*', ' & '))
    INTO ts_query
    FROM unnest(string_to_array(public.normalize_game_name(search_query), ' ')) AS t
    WHERE length(t) >= 2;

  RETURN QUERY
  WITH name_hits AS (
    -- Tiers 0 / 2 / 3. Trigram-indexed substring. Unchanged from migration 102.
    SELECT
      g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.min_age,
      g.playing_time, g.weight, g.is_expansion, g.bayesaverage,
      NULL::text AS matched_alternate_name,
      CASE
        WHEN lower(g.name) = lower_query THEN 0
        WHEN g.name ILIKE safe_query || '%' ESCAPE '!' THEN 2
        ELSE 3
      END AS rank_priority
    FROM public.games g
    WHERE (include_expansions OR g.is_expansion = FALSE)
      AND g.name ILIKE '%' || safe_query || '%' ESCAPE '!'
  ),
  alt_hits AS (
    -- Tiers 1 / 4. Partial-index-driven alt-name path. Unchanged from migration 102.
    SELECT
      g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.min_age,
      g.playing_time, g.weight, g.is_expansion, g.bayesaverage,
      (
        SELECT val
        FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE x.val ILIKE '%' || safe_query || '%' ESCAPE '!'
        ORDER BY CASE WHEN lower(x.val) = lower_query THEN 0 ELSE 1 END
        LIMIT 1
      ) AS matched_alternate_name,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
          WHERE lower(x.val) = lower_query
        ) THEN 1
        ELSE 4
      END AS rank_priority
    FROM public.games g
    WHERE g.alternate_names IS NOT NULL
      AND (include_expansions OR g.is_expansion = FALSE)
      AND NOT (g.name ILIKE '%' || safe_query || '%' ESCAPE '!')
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE x.val ILIKE '%' || safe_query || '%' ESCAPE '!'
      )
  ),
  normalized_name_hits AS (
    -- Tier 5: every normalized query token present in the normalized name, in
    -- any order, prefix-matchable. Punctuation-insensitive. The GIN tsvector
    -- index on to_tsvector('simple', normalize_game_name(name)) powers the @@
    -- predicate. Excludes rows already matched by name_hits or alt_hits.
    SELECT
      g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.min_age,
      g.playing_time, g.weight, g.is_expansion, g.bayesaverage,
      NULL::text AS matched_alternate_name,
      5 AS rank_priority
    FROM public.games g
    WHERE ts_query IS NOT NULL
      AND (include_expansions OR g.is_expansion = FALSE)
      AND NOT EXISTS (SELECT 1 FROM name_hits nh WHERE nh.id = g.id)
      AND NOT EXISTS (SELECT 1 FROM alt_hits ah WHERE ah.id = g.id)
      AND to_tsvector('simple'::regconfig, public.normalize_game_name(g.name)) @@ ts_query
  ),
  normalized_alt_hits AS (
    -- Tier 6: same shape over alternate names. An alt name qualifies only if
    -- it matches the tsquery (every token present in that single alt name,
    -- any order, prefix-matchable). Driven by the existing
    -- idx_games_with_alt_names partial index over ~1,277 rows. CROSS JOIN
    -- LATERAL gives us EXISTS semantics (row drops when subquery returns 0)
    -- while computing the to_tsvector(@@)/JSONB-explode work once per row
    -- instead of twice (once for EXISTS, once for the scalar matched-name).
    SELECT
      g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.min_age,
      g.playing_time, g.weight, g.is_expansion, g.bayesaverage,
      alt_match.val AS matched_alternate_name,
      6 AS rank_priority
    FROM public.games g
    CROSS JOIN LATERAL (
      SELECT val
      FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
      WHERE to_tsvector('simple'::regconfig, public.normalize_game_name(x.val)) @@ ts_query
      LIMIT 1
    ) AS alt_match
    WHERE ts_query IS NOT NULL
      AND g.alternate_names IS NOT NULL
      AND (include_expansions OR g.is_expansion = FALSE)
      AND NOT EXISTS (SELECT 1 FROM name_hits nh WHERE nh.id = g.id)
      AND NOT EXISTS (SELECT 1 FROM alt_hits ah WHERE ah.id = g.id)
      AND NOT EXISTS (SELECT 1 FROM normalized_name_hits nnh WHERE nnh.id = g.id)
  ),
  combined AS (
    SELECT * FROM name_hits
    UNION ALL SELECT * FROM alt_hits
    UNION ALL SELECT * FROM normalized_name_hits
    UNION ALL SELECT * FROM normalized_alt_hits
  )
  SELECT
    c.id, c.name, c.yearpublished, c.thumbnail, c.player_count, c.min_age,
    c.playing_time, c.weight, c.is_expansion, c.matched_alternate_name
  FROM combined c
  ORDER BY
    c.is_expansion ASC,
    c.rank_priority ASC,
    c.bayesaverage DESC NULLS LAST,
    c.id ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = '';

GRANT EXECUTE ON FUNCTION public.search_games_by_name(TEXT, BOOLEAN, INTEGER)
  TO authenticated, anon;
