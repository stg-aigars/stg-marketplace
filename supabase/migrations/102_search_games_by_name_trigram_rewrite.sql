-- Rewrite search_games_by_name to use the trigram index from migration 101.
--
-- The previous implementation (migration 092) ran a single SELECT that OR'd
-- name ILIKE and EXISTS-over-jsonb_array_elements_text(alternate_names) in the
-- WHERE clause. Without a trigram index, name ILIKE forced a sequential scan
-- of all ~175k games, and the EXISTS subquery evaluated alternate_names on
-- every row even though 99.3% of the table has alternate_names IS NULL. That
-- combination produced 154M sequential rows read and large work_mem-overflow
-- sorts, consuming ~1.6 GB/day of temp file IO on the Supabase Nano tier.
--
-- This rewrite splits the two paths into separate CTEs:
--   * name_hits: trigram-indexed ILIKE on g.name (uses idx_games_name_trgm).
--                Covers ranks 0 (exact), 2 (prefix), 3 (substring).
--   * alt_hits:  partial-index-driven scan over only the ~1,277 rows with
--                non-null alternate_names (uses idx_games_with_alt_names).
--                Covers ranks 1 (alt exact) and 4 (alt substring). Excludes
--                rows already matched by name to dedupe + preserve
--                "name match wins" semantics.
--
-- Signature, return shape, ESCAPE behavior ('!'), and STABLE / search_path
-- contract are unchanged so all callers continue to work without changes.

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
BEGIN
  -- Escape ILIKE wildcards using '!' as the escape character. standard_conforming_strings
  -- makes backslash a literal so we cannot use '\' here. See migration 046 for history.
  safe_query := replace(replace(replace(search_query, '!', '!!'), '%', '!%'), '_', '!_');
  lower_query := lower(search_query);

  RETURN QUERY
  WITH name_hits AS (
    -- Trigram-indexed path. Handles ranks 0, 2, 3.
    SELECT
      g.id,
      g.name,
      g.yearpublished,
      g.thumbnail,
      g.player_count,
      g.min_age,
      g.playing_time,
      g.weight,
      g.is_expansion,
      g.bayesaverage,
      NULL::text AS matched_alternate_name,
      CASE
        WHEN lower(g.name) = lower_query THEN 0
        WHEN g.name ILIKE safe_query || '%' ESCAPE '!' THEN 2
        ELSE 3
      END AS rank_priority
    FROM public.games g
    WHERE
      (include_expansions OR g.is_expansion = FALSE)
      AND g.name ILIKE '%' || safe_query || '%' ESCAPE '!'
  ),
  alt_hits AS (
    -- Driven by idx_games_with_alt_names (~1,277 rows). Excludes rows already
    -- matched by name so combined never has duplicate ids and the name path
    -- always wins on ranking.
    SELECT
      g.id,
      g.name,
      g.yearpublished,
      g.thumbnail,
      g.player_count,
      g.min_age,
      g.playing_time,
      g.weight,
      g.is_expansion,
      g.bayesaverage,
      (
        SELECT val
        FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE x.val ILIKE '%' || safe_query || '%' ESCAPE '!'
        ORDER BY CASE WHEN lower(x.val) = lower_query THEN 0 ELSE 1 END
        LIMIT 1
      ) AS matched_alternate_name,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
          WHERE lower(x.val) = lower_query
        ) THEN 1
        ELSE 4
      END AS rank_priority
    FROM public.games g
    WHERE
      g.alternate_names IS NOT NULL
      AND (include_expansions OR g.is_expansion = FALSE)
      AND NOT (g.name ILIKE '%' || safe_query || '%' ESCAPE '!')
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE x.val ILIKE '%' || safe_query || '%' ESCAPE '!'
      )
  ),
  combined AS (
    SELECT * FROM name_hits
    UNION ALL
    SELECT * FROM alt_hits
  )
  SELECT
    c.id,
    c.name,
    c.yearpublished,
    c.thumbnail,
    c.player_count,
    c.min_age,
    c.playing_time,
    c.weight,
    c.is_expansion,
    c.matched_alternate_name
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

-- CREATE OR REPLACE preserves grants in Postgres, but make them explicit so a
-- fresh deploy from migrations alone has the right permissions.
GRANT EXECUTE ON FUNCTION public.search_games_by_name(TEXT, BOOLEAN, INTEGER)
  TO authenticated, anon;
