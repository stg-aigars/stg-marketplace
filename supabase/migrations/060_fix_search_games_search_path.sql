-- Fix: schema-qualify table references in search_games_by_name so the function
-- works with search_path = '' (set by migration 059 for security hardening).
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
BEGIN
  -- Escape ILIKE wildcards using '!' as the escape character
  safe_query := replace(replace(replace(search_query, '!', '!!'), '%', '!%'), '_', '!_');

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
    g.bayesaverage DESC NULLS LAST,
    g.id ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = '';
