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
--   * Trigram GIN index on the normalized name expression so token LIKE
--     lookups don't fall back to sequential scan.
--   * Two new CTEs in search_games_by_name (rank tiers 5 + 6) that match when
--     every query token (after normalization, length >= 2) is present in the
--     normalized name (rank 5) or in one of the normalized alternate names
--     (rank 6), in any order.
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

-- 2. Trigram GIN index over the normalized expression. CONCURRENTLY is
-- incompatible with the transaction-wrapped Supabase migration runner (see
-- migration 101 for the same rationale); games is ~175k rows with low write
-- volume so the brief AccessExclusive lock during CREATE INDEX is acceptable.
-- pg_trgm lives in the extensions schema (migration 100).
CREATE INDEX IF NOT EXISTS idx_games_name_normalized_trgm
  ON public.games
  USING gin (public.normalize_game_name(name) extensions.gin_trgm_ops);

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
  tok_patterns TEXT[];
BEGIN
  -- Escape ILIKE wildcards using '!' (see migration 046 for the
  -- standard_conforming_strings rationale).
  safe_query := replace(replace(replace(search_query, '!', '!!'), '%', '!%'), '_', '!_');
  lower_query := lower(search_query);

  -- Build LIKE patterns from normalized tokens, length >= 2 only. Single-char
  -- tokens degrade the trigram index without adding signal. Empty array would
  -- make LIKE ALL vacuously true, so the cardinality guard on the new CTEs
  -- short-circuits behavior to be identical to migration 102 when no usable
  -- tokens remain. Tokens are already lowercased by normalize_game_name and
  -- contain no SQL wildcards (regex stripped them), so '%' || t || '%' is
  -- safe without escaping and we use LIKE (not ILIKE) for cheaper matching.
  tok_patterns := ARRAY(
    SELECT '%' || t || '%'
    FROM unnest(string_to_array(public.normalize_game_name(search_query), ' ')) AS t
    WHERE length(t) >= 2
  );

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
    -- Tier 5: every normalized token present somewhere in the normalized name,
    -- in any order. Punctuation-insensitive. The trigram GIN index on the
    -- normalize_game_name(name) expression powers the LIKE ALL clause.
    -- Excludes rows already matched by name_hits or alt_hits so dedup holds.
    SELECT
      g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.min_age,
      g.playing_time, g.weight, g.is_expansion, g.bayesaverage,
      NULL::text AS matched_alternate_name,
      5 AS rank_priority
    FROM public.games g
    WHERE cardinality(tok_patterns) > 0
      AND (include_expansions OR g.is_expansion = FALSE)
      AND NOT EXISTS (SELECT 1 FROM name_hits nh WHERE nh.id = g.id)
      AND NOT EXISTS (SELECT 1 FROM alt_hits ah WHERE ah.id = g.id)
      AND public.normalize_game_name(g.name) LIKE ALL (tok_patterns)
  ),
  normalized_alt_hits AS (
    -- Tier 6: same shape over alternate names. An alt name qualifies only if
    -- it contains every token (any-order, punctuation-insensitive). Driven by
    -- the existing idx_games_with_alt_names partial index over ~1,277 rows.
    SELECT
      g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.min_age,
      g.playing_time, g.weight, g.is_expansion, g.bayesaverage,
      (
        SELECT val
        FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE public.normalize_game_name(x.val) LIKE ALL (tok_patterns)
        LIMIT 1
      ) AS matched_alternate_name,
      6 AS rank_priority
    FROM public.games g
    WHERE cardinality(tok_patterns) > 0
      AND g.alternate_names IS NOT NULL
      AND (include_expansions OR g.is_expansion = FALSE)
      AND NOT EXISTS (SELECT 1 FROM name_hits nh WHERE nh.id = g.id)
      AND NOT EXISTS (SELECT 1 FROM alt_hits ah WHERE ah.id = g.id)
      AND NOT EXISTS (SELECT 1 FROM normalized_name_hits nnh WHERE nnh.id = g.id)
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE public.normalize_game_name(x.val) LIKE ALL (tok_patterns)
      )
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
