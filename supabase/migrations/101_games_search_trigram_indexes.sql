-- Two indexes powering the rewritten search_games_by_name (102).
--
-- Note on CONCURRENTLY: the plan called for `CREATE INDEX CONCURRENTLY` plus a
-- `disable-transaction` directive, but our migrations are applied via psql /
-- Supabase MCP `apply_migration` which wraps the file in a transaction —
-- CONCURRENTLY is incompatible with that. games is ~175k rows with very low
-- write volume (BGG CSV import is the dominant writer; per-listing
-- ensureGameMetadata writes touch one row at a time), so the brief AccessExclusive
-- lock during plain CREATE INDEX is acceptable.

-- Trigram GIN index on name. Supports ILIKE substring + prefix matches for
-- queries with >=3 extractable trigrams. Falls back to seq scan for shorter
-- queries; the search API route already enforces a 2+ char minimum and the
-- frontend a 3+ char debounce, so the unsupported window is narrow.
CREATE INDEX IF NOT EXISTS idx_games_name_trgm
  ON public.games
  USING gin (name extensions.gin_trgm_ops);

-- Partial index covering only the rows with non-null alternate_names (~1,277
-- rows / 0.7% of the table). The function rewrite uses this as the driver for
-- the alt-name path, so we never touch the 173k rows with NULL alternate_names
-- on every search. (is_expansion, id) gives the planner what it needs for the
-- expansion filter + final ORDER BY tiebreaker.
CREATE INDEX IF NOT EXISTS idx_games_with_alt_names
  ON public.games (is_expansion, id)
  WHERE alternate_names IS NOT NULL;
