-- Enable pg_trgm so we can build a trigram GIN index on games.name. Standalone
-- migration (separate from the index DDL in 101) so a future rollback of the
-- indexes doesn't drop the extension. Schema convention matches Supabase's
-- managed setup where pgcrypto / pg_stat_statements live in `extensions`.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
