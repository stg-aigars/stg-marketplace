-- Fix: rank exact / prefix matches above popular substring matches.
-- Previously, searching "TEN" buried the actual game "TEN" (id 335609) at rank 70
-- behind highly-rated games matched only via substring "ten" in their primary or
-- alternate names (e.g. Czech "Válka o prsten", German plurals ending in "-ten").
-- The old ORDER BY relied solely on bayesaverage, with no signal that the user's
-- query matched the title exactly.

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
    g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.is_expansion,
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
