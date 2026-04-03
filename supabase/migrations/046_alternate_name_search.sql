-- RPC: search games by primary name OR alternate names
-- Supports substring matching (ILIKE) for localized name search (e.g., "Mežā" → Forest Shuffle)
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
  -- Escape ILIKE wildcards into a distinct variable
  -- so all three ILIKE clauses use the same escaped value
  safe_query := replace(replace(replace(search_query, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT
    g.id, g.name, g.yearpublished, g.thumbnail, g.player_count, g.is_expansion,
    (
      SELECT val FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
      WHERE x.val ILIKE '%' || safe_query || '%'
      LIMIT 1
    ) AS matched_alternate_name
  FROM games g
  WHERE
    (include_expansions OR g.is_expansion = FALSE)
    AND (
      g.name ILIKE '%' || safe_query || '%'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(g.alternate_names) AS x(val)
        WHERE x.val ILIKE '%' || safe_query || '%'
      )
    )
  ORDER BY
    g.is_expansion ASC,
    g.bayesaverage DESC NULLS LAST,
    g.id ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;
