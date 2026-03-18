-- Add integer min/max player count columns for efficient filtering.
-- The existing player_count TEXT field (e.g. "2-4") is retained for display.

ALTER TABLE games
  ADD COLUMN min_players INTEGER,
  ADD COLUMN max_players INTEGER;

-- Backfill from existing player_count text field
UPDATE games SET
  min_players = CASE
    WHEN player_count ~ '^\d+–\d+$' THEN split_part(player_count, '–', 1)::integer
    WHEN player_count ~ '^\d+-\d+$' THEN split_part(player_count, '-', 1)::integer
    WHEN player_count ~ '^\d+$' THEN player_count::integer
    ELSE NULL
  END,
  max_players = CASE
    WHEN player_count ~ '^\d+–\d+$' THEN split_part(player_count, '–', 2)::integer
    WHEN player_count ~ '^\d+-\d+$' THEN split_part(player_count, '-', 2)::integer
    WHEN player_count ~ '^\d+$' THEN player_count::integer
    ELSE NULL
  END
WHERE player_count IS NOT NULL;

-- Index for filter queries
CREATE INDEX idx_games_players ON games(min_players, max_players);
