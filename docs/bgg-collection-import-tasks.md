# BGG Collection Import — Addendum to Seller Shelves Plan

> Extends Phase 3 (Seller Shelf Management UI) with bulk import from a BGG user's public collection.

## Context

BGG's XML API v2 exposes any user's public game collection at `/xmlapi2/collection?username=X&own=1&subtype=boardgame`. This returns every game they've marked as "owned" — BGG ID, name, year, and thumbnail URL.

The collection endpoint has a quirk: BGG queues collection requests and initially returns HTTP 202 ("still processing"). The caller must poll until a 200 comes back with actual data. For large collections (300+ games), this can take 5-15 seconds across multiple retries.

## Key Decisions

- **Server-side fetching only** — BGG API calls go through our API route, never from the client (consistent with existing BGG patterns)
- **Polling with retry** — API route handles the 202 → 200 retry loop server-side, client polls the API route for status
- **Preview before import** — user sees their full collection and can deselect games before adding to shelf
- **No auth required** — BGG collections are public; we only need the username, no BGG login
- **Lazy enrichment** — import shelf items with name/year from collection response; thumbnails enriched separately via existing `ensureGameMetadata()` pattern
- **BGG username stored on profile** — enables future re-sync and social proof on seller pages

## Architecture

```
User enters BGG username
        ↓
POST /api/bgg/collection  →  BGG XML API (retry loop)
        ↓                            ↓
    202 (queued)              200 (collection XML)
    retry after 3s                   ↓
        ↓                    Parse items, match to games table
        ↓                           ↓
    Return to client     { games: [...], notFound: [...] }
        ↓
Client shows preview grid
        ↓
User selects games → POST addBulkToShelf(bggGameIds[])
        ↓
Batch INSERT into shelf_items (ON CONFLICT skip)
        ↓
Background: enrich thumbnails for visible page
```

---

## Tasks

### Task 20: Store BGG username on user profile

**Files:**
- Create: `supabase/migrations/025_bgg_username.sql`
- Modify: `src/lib/shelves/actions.ts` — add `updateBggUsername(username)` action

**Migration:**
```sql
ALTER TABLE user_profiles
  ADD COLUMN bgg_username TEXT CHECK (bgg_username IS NULL OR char_length(bgg_username) <= 50);

CREATE INDEX idx_user_profiles_bgg ON user_profiles(bgg_username)
  WHERE bgg_username IS NOT NULL;
```

**Notes:**
- Optional field, nullable
- No uniqueness constraint (multiple sellers could share a BGG account, e.g. household)
- Display on public seller profile page when set (future task)

---

### Task 21: BGG collection fetch API route

**Files:**
- Create: `src/app/api/bgg/collection/route.ts`
- Create: `src/lib/bgg/collection.ts` — collection fetching + parsing logic

**`src/lib/bgg/collection.ts`:**

```typescript
export interface BGGCollectionItem {
  bggGameId: number;
  name: string;
  yearPublished: number | null;
  thumbnail: string | null;
}

export interface CollectionResult {
  items: BGGCollectionItem[];
  totalCount: number;
  username: string;
}

export async function fetchBGGCollection(username: string): Promise<CollectionResult>
```

**Fetch logic:**
1. Call `https://boardgamegeek.com/xmlapi2/collection?username={username}&own=1&subtype=boardgame&excludesubtype=boardgameexpansion`
2. Include `Authorization` header with BGG API token (from `env.bgg.apiToken`)
3. If response is 202: wait 3 seconds, retry (max 10 retries = 30s total timeout)
4. If response is 200: parse XML with `fast-xml-parser`, decode entities with `he`
5. If retries exhausted: throw `BGGCollectionTimeoutError`
6. If username not found (BGG returns error message in XML): throw `BGGUserNotFoundError`
7. Filter to `subtype="boardgame"` items only (double-check; should already be filtered by URL params)

**API route (`GET /api/bgg/collection?username=X`):**
- Requires authentication (must be logged in)
- Validates username param (non-empty, alphanumeric + underscores, max 50 chars)
- Calls `fetchBGGCollection(username)`
- Returns `{ items, totalCount, username }`
- Error responses: 400 (bad username), 404 (BGG user not found), 504 (BGG timeout)

**Edge cases:**
- BGG usernames with special characters — URL-encode the username
- Empty collections — return `{ items: [], totalCount: 0 }` (valid response, not error)
- BGG API rate limiting — if 429, return 503 with "BGG is busy, try again in a minute"

---

### Task 22: Match collection to local games table

**Files:**
- Modify: `src/app/api/bgg/collection/route.ts` — add matching step after fetch

**After fetching the BGG collection, match items against the local `games` table:**

```typescript
// Fetch all BGG IDs from collection
const bggIds = collectionItems.map(item => item.bggGameId);

// Batch query: which of these exist in our games table?
const { data: existingGames } = await supabase
  .from('games')
  .select('id, thumbnail, image')
  .in('id', bggIds);

const existingGameMap = new Map(existingGames.map(g => [g.id, g]));
```

**Return shape enriched with match status:**
```typescript
{
  items: [
    {
      bggGameId: 174430,
      name: "Gloomhaven",
      yearPublished: 2017,
      thumbnail: "https://...",       // from BGG collection response
      localThumbnail: "https://...",  // from games table (if enriched)
      inLocalDb: true,                // exists in games table
      alreadyOnShelf: false,          // already in seller's shelf_items
    },
    // ...
  ],
  totalCount: 312,
  alreadyOnShelfCount: 47,
  notInDatabaseCount: 3,    // games missing from CSV import (rare)
  username: "aigars_bgg"
}
```

**Pre-filter shelf items:**
```typescript
const { data: existingShelf } = await supabase
  .from('shelf_items')
  .select('bgg_game_id')
  .eq('seller_id', user.id);

const onShelfSet = new Set(existingShelf.map(s => s.bgg_game_id));
```

**Games not in local DB:**
- Extremely rare (CSV has ~170k ranked games), but possible for unranked/very new games
- Flag these in the response so the UI can show them as "not available for import"
- Future enhancement: auto-insert missing games into `games` table from BGG data

---

### Task 23: Bulk add to shelf (server action)

**Files:**
- Modify: `src/lib/shelves/actions.ts` — add `addBulkToShelf(items, bggUsername?)` action

**Function signature:**
```typescript
export async function addBulkToShelf(
  items: Array<{ bggGameId: number; gameName: string; gameYear: number | null }>,
  bggUsername?: string
): Promise<{ added: number; skipped: number }>
```

**Logic:**
1. Validate auth (must be logged in)
2. If `bggUsername` provided and user has no `bgg_username` set, update profile
3. Batch insert into `shelf_items` with `ON CONFLICT (seller_id, bgg_game_id) DO NOTHING`
4. Default visibility: `'open_to_offers'` (most useful default for imported games)
5. Return count of actually inserted vs skipped (already on shelf)

**Batch size:** Insert in chunks of 50 to avoid oversized queries. 300 games = 6 batches.

```typescript
const BATCH_SIZE = 50;
let added = 0;
let skipped = 0;

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  const rows = batch.map(item => ({
    seller_id: user.id,
    bgg_game_id: item.bggGameId,
    game_name: item.gameName,
    game_year: item.gameYear,
    visibility: 'open_to_offers',
  }));

  const { data, error } = await supabase
    .from('shelf_items')
    .upsert(rows, { onConflict: 'seller_id,bgg_game_id', ignoreDuplicates: true })
    .select('id');

  if (error) throw error;
  added += data?.length ?? 0;
  skipped += batch.length - (data?.length ?? 0);
}
```

---

### Task 24: Batch thumbnail enrichment

**Files:**
- Create: `src/app/api/games/enrich-batch/route.ts`

**Purpose:** After a bulk import, the shelf page needs thumbnails for up to 20-30 visible games. Instead of enriching 300 games at import time, enrich one page worth on demand.

**API route (`POST /api/games/enrich-batch`):**
```typescript
// Request: { bggGameIds: number[] }  (max 20 per call)
// Response: { enriched: Array<{ id: number; thumbnail: string | null }> }
```

**Logic:**
1. Accept array of BGG game IDs (cap at 20 per request)
2. Check which are already enriched (`thumbnail IS NOT NULL`)
3. For un-enriched games: call BGG Thing API with batched IDs (`?id=1,2,3,...,20&stats=1`)
4. Parse metadata, update `games` table rows
5. Return all thumbnails (freshly fetched + already cached)

**Why a separate route (not reusing `/api/games/[id]/enrich`):**
- Existing enrich route handles one game at a time
- BGG Thing API supports up to 20 IDs in a single call — 1 API call vs 20
- Critical for import UX: enriching 20 games in 1 request (~1-2s) vs 20 requests (~20-30s)

---

### Task 25: Import UI on shelf management page

**Files:**
- Create: `src/app/[locale]/account/shelf/ImportFromBGG.tsx` — client component
- Modify: `src/app/[locale]/account/shelf/page.tsx` — add import button/section

**UI flow:**

**Step 1: Enter username**
- Text input for BGG username
- "Import from BGG" button
- If user already has `bgg_username` set, pre-fill the input
- Loading state: "Connecting to BoardGameGeek..." → "Loading your collection..." (with spinner)

**Step 2: Preview collection**
- Header: "Found 312 games in [username]'s collection" with subtext: "47 already on your shelf"
- Grid of game cards (reuse existing game card pattern): thumbnail, name, year
- Each card has a checkbox (pre-selected for games not already on shelf)
- Games already on shelf: dimmed with "Already on shelf" badge, checkbox unchecked
- Games not in database: dimmed with "Not available" badge, no checkbox
- "Select all" / "Deselect all" toggle
- Count display: "247 games selected"

**Step 3: Confirm import**
- "Add 247 games to shelf" button
- Default visibility selector: dropdown to pick default visibility for all imported games (default: "Open to offers")
- Progress indicator during batch insert: "Adding games... 150/247"
- Completion: "Added 247 games to your shelf" success alert, page refreshes to show updated shelf

**Pagination for the preview:**
- For 300+ games, don't render all at once
- Use virtualized list or simple "show 50 more" button
- Sort: alphabetical by name (matches BGG default)

**Error states:**
- BGG username not found → "No BGG account found for '[username]'. Check the spelling and try again."
- BGG timeout → "BoardGameGeek is taking longer than usual. Please try again in a moment."
- BGG rate limited → "BoardGameGeek is busy right now. Try again in a minute."
- Network error → "Could not connect to BoardGameGeek. Check your connection and try again."

---

### Task 26: Trigger thumbnail enrichment on shelf page load

**Files:**
- Create: `src/app/[locale]/account/shelf/useShelfEnrichment.ts` — client hook
- Modify: `src/app/[locale]/account/shelf/ShelfItemCard.tsx` — use enriched thumbnails

**Hook logic:**
```typescript
export function useShelfEnrichment(shelfItems: ShelfItemWithGame[]) {
  // On mount, find items where games.thumbnail is null
  // Collect their bgg_game_ids (up to 20)
  // Call POST /api/games/enrich-batch
  // Update local state with returned thumbnails
  // On scroll/pagination, enrich next batch
}
```

**Behavior:**
- First render: show shelf items with whatever thumbnails are available (many will be null after import)
- Background: fire enrichment for visible items
- As thumbnails arrive: update cards with fade-in (avoid layout shift — use fixed card image height)
- Placeholder: show game name initials or generic board game icon while thumbnail loads

---

## Updated Shelf Page Layout (Task 9 modification)

With collection import, the shelf management page becomes:

```
┌──────────────────────────────────────────────────┐
│  My shelf                                [Import from BGG]  │
│  ───────────────────────────────────────────────  │
│  [Add game]  (manual search, existing flow)       │
│                                                    │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐              │
│  │ img │  │ img │  │ img │  │ img │   ...         │
│  │name │  │name │  │name │  │name │              │
│  │badge│  │badge│  │badge│  │badge│              │
│  └─────┘  └─────┘  └─────┘  └─────┘              │
│                                                    │
│  Showing 1-24 of 312          [Load more]         │
└──────────────────────────────────────────────────┘
```

---

## Execution Order & Dependencies

```
Task 20 (bgg_username column)     — independent, do first
Task 21 (collection fetch)        — depends on existing BGG infra
Task 22 (match to local DB)       — depends on 21
Task 23 (bulk add action)         — depends on Task 1 (shelf_items table)
Task 24 (batch enrichment)        — depends on existing enrich pattern
Task 25 (import UI)               — depends on 21, 22, 23
Task 26 (shelf enrichment hook)   — depends on 24, Task 9 (shelf page)
```

Tasks 20-22 can be built alongside Phase 1-2 of the main plan.
Task 23 can be built as soon as the shelf_items table exists (Task 1).
Tasks 25-26 integrate into Phase 3 (Seller UI).

## Effort Estimate

| Task | Effort |
|------|--------|
| 20. BGG username column | 1 hour |
| 21. Collection fetch + retry | 3-4 hours |
| 22. Match to local DB | 1-2 hours |
| 23. Bulk add action | 2-3 hours |
| 24. Batch enrichment route | 3-4 hours |
| 25. Import UI | 4-6 hours |
| 26. Shelf enrichment hook | 2-3 hours |
| **Total** | **~2-3 days** |

## Open Questions

1. **Re-sync behavior** — Should "Import from BGG" be a one-time action, or should users be able to re-sync periodically? Re-sync is cheap to build (`ON CONFLICT DO NOTHING` handles it), but the UX needs to communicate what happens (only new games are added, nothing is removed).

2. **Remove games not in BGG anymore** — If a user syncs and a game is no longer in their BGG collection, should we flag it? Remove it? For v1, probably ignore — only add, never remove.

3. **Expansion handling** — The URL param `excludesubtype=boardgameexpansion` should filter out expansions, but BGG classification isn't always clean. Some standalone expansions might slip through. Acceptable for v1; can add expansion filtering via the existing BGG classifier later.

4. **Default visibility on import** — Plan says "open to offers." Should we let users pick per-game during preview, or just set a batch default? Batch default is simpler and can be changed per-game afterwards on the shelf page. Recommend batch default for v1.

5. **Rate limits** — One collection fetch per user per... hour? Day? No limit? Since it only hits BGG once per import and our server handles retries, the main risk is a user spam-clicking. A simple client-side debounce + server-side rate limit (1 collection fetch per user per 5 minutes) should suffice.
