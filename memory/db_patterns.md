---
name: Supabase Database Patterns
description: Critical Supabase gotchas for SSR cookie handling, RLS, migrations, and views
type: project
---

## Supabase SSR Cookie Handling

- `@supabase/ssr@0.5+` requires `getAll`/`setAll` cookie API
- The old `get`/`set`/`remove` silently breaks chunked cookie handling (large JWTs from OAuth get split across multiple cookies)
- Files using Supabase server client: `middleware.ts`, `lib/supabase/server.ts`, auth callback routes

## OAuth Callback Protection

- Middleware must NOT clear auth cookies during OAuth callbacks (`?code=` or `?token_hash=` in URL)
- The PKCE code verifier cookie (`sb-xxx-auth-token-code-verifier`) is needed for client-side code exchange
- OAuth callbacks may land on `/?code=...` depending on Supabase dashboard redirect URL config

## Migration Gotchas

- When dropping columns from tables, check ALL dependent views first
- Use: `SELECT viewname FROM pg_views WHERE schemaname = 'public' AND definition LIKE '%column_name%';`
- Supabase MCP `apply_migration` doesn't support CASCADE on ALTER TABLE — must explicitly DROP VIEW first
- When recreating views, ALWAYS include `WITH (security_invoker = true)` to enforce RLS

## RLS Best Practices

- Enable RLS on every table from day one — retrofitting is painful
- Views must use `WITH (security_invoker = true)` to preserve RLS
- Service role client bypasses RLS — use only where necessary (webhooks, crons, admin ops)

## Games Table

- INTEGER primary key (BGG game ID, not UUID) — not auto-generated
- No INSERT/UPDATE/DELETE RLS policies — writes via service role only, public SELECT
- Populated via CSV import (`scripts/import-bgg-csv.ts`), metadata enriched on-demand
- `ensureGameMetadata()` is idempotent — checks for existing data before BGG API call
- Listings FK to games via `bgg_game_id` with `ON DELETE RESTRICT`
- `game_name` and `game_year` denormalized on listings for query performance
- Edition tracking: `version_source` ('bgg' | 'manual'), `language` field is critical for Baltic market

## Profile Creation

- Database trigger creates user_profiles on auth signup
- Trigger may be slow — implement retry logic (up to 3 retries with 1s delay) when fetching profile after signup
