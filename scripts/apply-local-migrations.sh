#!/bin/bash
# Apply all migrations to local Supabase using psql inside the DB container.
# The Supabase CLI's built-in migration runner uses prepared statements,
# which can't handle PL/pgSQL $$ function definitions in multi-statement files.
# psql handles them correctly.

set -e

CONTAINER="supabase_db_stg-marketplace"

# Verify container is running
if ! docker inspect "$CONTAINER" &>/dev/null; then
  echo "Error: Local Supabase is not running. Run 'supabase start' first."
  exit 1
fi

echo "Applying migrations to local Supabase..."

for f in supabase/migrations/*.sql; do
  name=$(basename "$f")
  echo "  $name"
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 --quiet < "$f" 2>&1 | grep -v "^NOTICE:" || true
done

echo "Done. All migrations applied."
