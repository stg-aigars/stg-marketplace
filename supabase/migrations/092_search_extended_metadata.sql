-- Extend search_games_by_name to return min_age, playing_time, weight so the
-- sell-flow Step 1 search rows can render the same metadata block as the BGG
-- section on listing detail pages (Users / Baby / Timer / Scales). Columns
-- already exist on `games` (migrations 001 + 011); this only updates the RPC's
-- RETURNS TABLE shape and SELECT projection. Ranking and filtering logic is
-- preserved verbatim from migration 091.
--
-- DROP + CREATE rather than CREATE OR REPLACE: Postgres rejects RETURNS TABLE
-- shape changes via CREATE OR REPLACE (42P13). The function is only called from
-- the search API route, so the brief gap between DROP and CREATE has negligible
-- impact. No DB-side dependencies (no views, triggers, or other functions
-- reference search_games_by_name), so CASCADE is unnecessary.

DROP FUNCTION IF EXISTS public.search_games_by_name(TEXT, BOOLEAN, INTEGER);

CREATE FUNCTION public.search_games_by_name(
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
  -- Escape ILIKE wildcards using '!' as the escape character
  safe_query := replace(replace(replace(search_query, '!', '!!'), '%', '!%'), '_', '!_');
  lower_query := lower(search_query);

  RETURN QUERY
  SELECT
    g.id, g.name, g.yearpublished, g.thumbnail, g.player_count,
    g.min_age, g.playing_time, g.weight,
    g.is_expansion,
    CASE
      WHEN g.name ILIKE '%' || safe_query || '%' ESCAPE '!' THEN NULL
      ELSE (
        SELECT val FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE x.val ILIKE '%' || safe_query || '%' ESCAPE '!'
        LIMIT 1
      )
    END AS matched_alternate_name
  FROM public.games g
  WHERE
    (include_expansions OR g.is_expansion = FALSE)
    AND (
      g.name ILIKE '%' || safe_query || '%' ESCAPE '!'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE x.val ILIKE '%' || safe_query || '%' ESCAPE '!'
      )
    )
  ORDER BY
    g.is_expansion ASC,
    CASE
      -- Tier 0: primary name is an exact match for the query
      WHEN lower(g.name) = lower_query THEN 0
      -- Tier 1: an alternate name is an exact match (e.g. "Catane" → "Catan")
      WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE lower(x.val) = lower_query
      ) THEN 1
      -- Tier 2: primary name starts with the query
      WHEN g.name ILIKE safe_query || '%' ESCAPE '!' THEN 2
      -- Tier 3: query appears anywhere in the primary name
      WHEN g.name ILIKE '%' || safe_query || '%' ESCAPE '!' THEN 3
      -- Tier 4: query only matched an alternate name (substring)
      ELSE 4
    END ASC,
    g.bayesaverage DESC NULLS LAST,
    g.id ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = '';
