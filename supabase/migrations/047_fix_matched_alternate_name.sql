-- Fix: only return matched_alternate_name when the primary name does NOT match.
-- Previously, searching "Arcs" would return an alternate like "Arcs: Conflict & Collapse"
-- even though the primary name "Arcs" matched — causing the wrong name to be pre-selected.
CREATE OR REPLACE FUNCTION search_games_by_name(
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
  -- Avoids backslash ambiguity with standard_conforming_strings
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
  FROM games g
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
$$ LANGUAGE plpgsql STABLE;
