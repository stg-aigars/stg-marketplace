# Listing Expansions Support

## Context

Sellers frequently sell board games bundled with their expansions (e.g. "Catan + Seafarers + Cities & Knights"), but the marketplace currently enforces a strict 1:1 listing-to-game relationship. Expansions are tracked in the `games` table (`is_expansion=true`) and classified via BGG links, but are filtered out of all search/browse/listing flows. This feature adds structured expansion support to listings, enabling two scenarios:

1. **Base game + expansions bundle** — seller selects a base game, ticks included expansions from BGG's known expansion list, sells as one unit at one price
2. **Standalone expansion listing** — seller lists an expansion directly as the primary game

Unrelated game bundles (e.g. "Catan + Ticket to Ride") are explicitly deferred to a future phase.

## Data Model

### New table: `listing_expansions`

```sql
CREATE TABLE listing_expansions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bgg_game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  game_name TEXT NOT NULL,
  version_source TEXT CHECK (version_source IN ('bgg', 'manual')),
  bgg_version_id INTEGER,
  version_name TEXT,
  publisher TEXT,
  language TEXT,
  edition_year INTEGER,
  version_thumbnail TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, bgg_game_id)
);
```

- **No changes to `listings` table** — base game stays as `bgg_game_id` on listing, expansions are child rows
- **Version fields mirror `listings`** — same types, same semantics
- **RLS:** Public read. Write restricted to listing owner via `auth.uid() = (SELECT seller_id FROM listings WHERE id = listing_id)`. Verify query plan with EXPLAIN after creating policy (PK index on `listings.id` should make subquery efficient).
- **Self-reference guard:** Enforced in server action — reject any expansion where `bgg_game_id` matches the listing's `bgg_game_id`

### Games table: expansion upsert

When fetching expansions for a base game, linked expansions that don't exist in `games` are upserted as lightweight stubs:

```sql
INSERT INTO games (id, name, is_expansion)
VALUES ($1, $2, true)
ON CONFLICT (id) DO NOTHING;
```

`ON CONFLICT DO NOTHING` handles concurrent upserts from multiple sellers.

## API Endpoints

### New: `GET /api/games/[id]/expansions`

- Calls `fetchGameMetadata(gameId)` (existing function — uses `rateLimitedFetch` and in-memory LRU cache with 24h TTL)
- If metadata is already cached (likely — `ensureGameMetadata` was called on game select via `/api/games/[id]/enrich`), this is a **cache hit with zero BGG API calls**
- Extracts `outboundLinks` where `type = 'boardgameexpansion'`
- For each linked expansion: upserts into `games` if missing (using service client, `ON CONFLICT (id) DO NOTHING`)
- Returns `{ expansions: Array<{ id: number, name: string, year?: number }> }`
- Follows existing versions endpoint pattern (`src/app/api/games/[id]/versions/route.ts`) for auth, error handling, rate limiting
- BGG errors return `{ error: string, expansions: [] }` (graceful degradation)

### New: `GET /api/games/versions` (batch)

- Accepts `?ids=123,456,789` (comma-separated BGG game IDs, max 20)
- Calls BGG Thing API via `rateLimitedFetch` with all IDs in one request (BGG API supports comma-separated IDs — single HTTP call for up to 20 games)
- **Guard for >20 IDs:** Split into multiple BGG API calls (e.g. 21 IDs → two calls of 20+1), each going through `rateLimitedFetch` (1s minimum gap). Extremely unlikely in practice.
- Parses versions from response using existing `parseVersions()` logic in `src/lib/bgg/api.ts`
- Returns `{ versions: Record<number, Version[]> }` keyed by game ID
- Uses service client for any `games` table version cache updates (same pattern as existing `ensureGameVersions`)
- Follows existing error handling: BGGError → 503/502 with Retry-After header, returns empty versions for failed games

### Modified: `GET /api/games/search`

- Add optional `?includeExpansions=true` query param
- When enabled: remove `.eq('is_expansion', false)` filter
- Add `is_expansion` to SELECT fields for UI badge rendering
- Sort: `is_expansion ASC, bayesaverage DESC` (base games first, then expansions by ranking)
- Default behavior unchanged (base games only)

## Listing Creation Flow

### Updated step sequence

**Game Search → Expansions (conditional) → Version (multi-game) → Condition/Photos → Review/Price**

### Step: Game Search (modified)

- Sell flow always passes `includeExpansions=true` to `/api/games/search` so sellers can find and list standalone expansions
- Add `is_expansion` to response; show "Expansion" `Badge` on expansion game results in the search list
- After game selection, fetch `/api/games/[id]/expansions` in the background
- Show loading indicator on the selected game row during expansion fetch (existing pattern from version fetching)
- **Expansion gate (yes/no prompt):** Once expansion fetch completes:
  - If game has 1+ expansions AND game is not itself an expansion: show prompt — "Does your copy include any expansions?" Yes / No
  - **Yes** → advance to Expansions step
  - **No** → skip straight to Version step
  - If game has 0 expansions or is an expansion: skip silently, no prompt
- This filters out the no-expansions majority (one tap) while serving as feature discovery

### Duplicate listing awareness

- After game selection, alongside the expansion fetch, query seller's active listings for the same `bgg_game_id`
- If active listing(s) exist: show an `Alert` (variant: `info`) below the selected game — "You already have an active listing for this game"
- Include a `ListingRow` (existing component) showing each active listing — thumbnail, title, price, condition badge, linked to the listing page (new tab)
- **Non-blocking** — seller can continue creating the new listing. This is informational, not a gate.
- Query: `listings.select('id, game_name, price_cents, condition, photos, listing_type').eq('bgg_game_id', selectedGameId).eq('seller_id', userId).eq('status', 'active')` — include expansion count via lateral join so `ListingRow` can show "+N expansions" badge (helps seller distinguish "Catan" from "Catan + Seafarers")
- Can be fetched in parallel with the expansion fetch (both happen after game selection)

### Step: Expansions (new, conditional)

- **Shown when:** seller answered "Yes" to the expansion prompt
- **UI:** Scrollable checkbox list with a client-side text filter input at top ("Filter expansions...") — handles long lists (Dominion 30+, Carcassonne 20+)
- Each row: checkbox + expansion name + year (if available)
- Seller ticks included expansions, hits Next
- Step is fully optional — seller can skip without selecting any
- **Known v1 limitation:** Only expansions in BGG's outbound links are shown. If BGG data is incomplete for an obscure expansion, it won't appear. This is acceptable — BGG covers 95%+ of commercially published expansions. Manual search escape hatch is a natural v2 addition.

### Step: Version (modified)

- State shape changes from `VersionSelection` to `Record<number, VersionSelection>` keyed by `bgg_game_id`
- **Layout:** Single scrollable page with base game version selector at top, then each selected expansion's version selector below
- **Base game:** Version selection required (unchanged behavior)
- **Expansions:** Version selectors start in empty "No edition selected" state. Seller fills in what they know, hits Next. No per-row skip button — passive optionality ("fill in what you know, move on")
- **Batch fetch:** Single call to `/api/games/versions?ids=baseId,exp1Id,exp2Id,...` for all versions at once
- One "Next" button for the whole page

### Steps: Condition/Photos (unchanged)

- Single condition for the whole bundle

### Step: Review/Price (modified for bundle pricing)

- Single price for the whole bundle
- Review page shows base game + listed expansions with their edition info (if provided)
- Works identically for fixed price and auctions
- **PricingAssistant enhanced for bundles** (see Pricing section below)

### Submit action (`createListing` in `src/lib/listings/actions.ts`)

- Follows existing pattern: sequential service client calls (no RPC, no explicit transaction — matches current `createListing` architecture)
- Base game data saves to `listings` columns (unchanged `.insert()`)
- After listing insert succeeds: insert expansion rows into `listing_expansions` sequentially via service client
- Self-reference guard: reject if any expansion `bgg_game_id` === listing `bgg_game_id` (validated before insert)
- If expansion insert fails: listing exists without expansions — seller can edit to add them (acceptable degradation, matches pattern of non-blocking post-insert operations like shelf sync)

## Listing Edit Flow

### Edit form (`src/app/[locale]/listings/[id]/edit/EditListingForm.tsx`)

- **Game remains immutable** (unchanged — can't change `bgg_game_id` after listing)
- **Add expansion editing:** show the expansion step within the edit form, pre-populated with current expansions
- Fetch available expansions for the listing's base game via `/api/games/[id]/expansions`
- Seller can add/remove expansion checkboxes and edit expansion version selections
- **Skipped for standalone expansion listings** (same conditional logic as creation — no prompt shown if primary game is an expansion)
- **Auctions with bids:** expansion editing blocked (same as other field edits — `isAuctionWithBids` guard)

### Update action (`updateListing` in `src/lib/listings/actions.ts`)

- Diff existing `listing_expansions` rows against submitted expansion data:
  - **Removed expansions:** DELETE rows where `bgg_game_id` not in new set
  - **Added expansions:** INSERT new rows
  - **Changed versions:** UPDATE rows where `bgg_game_id` matches but version fields differ
- Uses service client (matches existing `updateListing` pattern)
- Self-reference guard applied on update too

## Pricing Assistant (Bundle Support)

### Modified: `GET /api/games/[id]/pricing`

- Add optional `?expansionIds=456,789` query param (comma-separated BGG game IDs)
- Fetch retail prices for base game + each expansion in parallel via `Promise.all(ids.map(id => fetchRetailPrice(id, supabase)))`
- Each game's retail price is independently cached in `external_pricing_cache` with 65-min TTL (existing per-game caching — no schema changes needed)
- Repeat calls for same expansions are cache hits (no BGP API call)
- Response adds new fields while preserving existing contract:
  ```typescript
  {
    // Existing fields — UNCHANGED (base game only):
    retailPriceCents: number | null,        // base game retail price only (not summed)
    shopName: string | null,                // base game's cheapest shop
    marketplace: MarketplaceStats,          // base game only (no bundle-specific historical data)
    attributionUrl: string | null,
    cached: boolean,
    // New fields (bundle-specific, only present when expansionIds provided):
    bundleRetailPriceCents?: number | null, // sum of all available retail prices
    breakdown?: Array<{
      bggGameId: number,
      gameName: string,
      retailPriceCents: number | null,      // null if no retail data for this game
      shopName: string | null,
    }>,
    gamesWithRetailData?: number,           // e.g. 3 of 4 games have data
    totalGames?: number,
  }
  ```
- `retailPriceCents` stays base-game-only — existing consumers see no change
- `bundleRetailPriceCents` is the sum of all games with available retail data
- When no expansion IDs provided: response is identical to today (backward compatible)
- Marketplace stats (lowest active, median sold) remain base-game-only — aggregating across different bundle compositions would be misleading

### PricingAssistant component changes

- Accepts new prop: `expansionIds: number[]` (from selected expansions in flow state)
- Passes expansion IDs to pricing endpoint
- **Suggested price:** Uses `bundleRetailPriceCents` (sum of available retail prices) × condition multiplier (× auction multiplier if applicable). When only some games have retail data, the suggestion is based on the partial sum — the UI shows "based on X of Y games" as a disclaimer. No threshold cutoff — even partial data is a useful anchor that sellers naturally adjust.
- **Breakdown display:** Collapsible section below the suggested price showing each game's retail contribution:
  - "Catan — €38.00"
  - "Catan: Seafarers — €22.00"
  - "Catan: Cities & Knights — Price not available"
- If not all games have retail data: note "Retail price based on X of Y games"
- **Marketplace context** (lowest active, median sold): shown for base game only, labeled as such

### calculateSuggestedPrice changes

- Accepts `bundleRetailPriceCents` when expansions are present, otherwise `retailPriceCents` (base game only)
- No logic change needed — it just receives a larger input number for bundles
- Condition multiplier and auction multiplier apply to the total, not per-game

## Cart Display

- Cart items (`src/app/[locale]/cart/page.tsx`) show game title, thumbnail, condition, price
- **New:** If listing has expansions, show "+N expansions" text below game title (same muted styling as listing cards and browse)
- Cart item data (`CartItem` type in `src/lib/checkout/cart-types.ts`) needs an `expansionCount` field
- Populated during cart validation when listing data is fetched

## Browse & Search Display

### Browse page (`/browse`)

- Add filter toggle: "Show expansion listings" (off by default) — label is explicit about listing type, not bundle contents
- When enabled: remove `is_expansion=false` filter from browse query
- Expansion-primary listings show "Expansion" badge on card

### Listing cards (`ListingCardMini`, browse cards)

- If listing has expansion associations: show "+N expansions" text below game title
- Muted styling, similar to `GameMeta` year/publisher display
- **Query efficiency:** Add expansion count via LEFT JOIN LATERAL within the existing browse query, before pagination:
  ```sql
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS expansion_count
    FROM listing_expansions
    WHERE listing_id = l.id
  ) ec ON true
  ```
  This adds one column per row without affecting existing filters or pagination counts. **Do NOT use N+1 queries.**

### Listing detail page

- New "Included Expansions" section below game info area
- Each expansion: `GameThumb` (sm) + name + year + edition info (if provided)
- Expansion images: accept placeholder fallback for un-enriched expansion stubs — don't trigger `ensureGameMetadata()` on detail page load. Lazy enrichment happens when that expansion is eventually listed/viewed directly
- Section absent if no expansions (no empty state)

## Order Flow Display

### Order detail page (`src/components/orders/OrderDetailClient.tsx`)

- Fetch `listing_expansions` alongside listing data in order queries
- Display expansion names below the game name in order item rows (e.g. "Catan (2015) + Seafarers, Cities & Knights")
- Muted styling, consistent with listing card display

### Order confirmation emails (`src/lib/email/templates/`)

- Update `gameName` passed to buyer/seller email templates to include expansion info
- Format: "Catan + 2 expansions" or "Catan + Seafarers, Cities & Knights" (short list for 1-2, count for 3+)
- Minimal template changes — just enriching the existing `gameName` string

### Seller notification emails

- Same expansion info in new order notifications, shipping reminders, etc.
- Uses the same formatting helper as order confirmation

### In-app notifications (`src/lib/notifications/templates.ts`)

- Notifications use `ctx.gameName` string interpolation
- Enrich `gameName` with expansion info at the call site (same formatting as emails)
- Applies to order-related notifications: `order.created`, `order.accepted`, `auction.won`, etc.
- No template changes needed — just richer `gameName` passed in context

## Files to Create/Modify

### New files
- `supabase/migrations/0XX_listing_expansions.sql` — table, constraints, RLS policies (no standalone index on `listing_id` needed — the `UNIQUE(listing_id, bgg_game_id)` composite index covers `listing_id`-only lookups since it's the leftmost column)
- `src/app/api/games/[id]/expansions/route.ts` — expansion discovery endpoint
- `src/app/api/games/versions/route.ts` — batch version fetch endpoint
- `src/app/[locale]/sell/_components/ExpansionStep.tsx` — expansion selection step component

### Modified files
- `src/lib/listings/types.ts` — add `ListingExpansion` type, update `CreateListingData` and `UpdateListingData`
- `src/app/[locale]/sell/_components/ListingCreationFlow.tsx` — add conditional expansion step, update state to include expansion selections
- `src/app/[locale]/sell/_components/GameSearchStep.tsx` — pass `includeExpansions=true`, show "Expansion" badge, fetch expansions on game select
- `src/app/[locale]/sell/_components/VersionStep.tsx` — multi-game version selection (`Record<number, VersionSelection>`)
- `src/app/[locale]/sell/_components/ReviewPriceStep.tsx` — show expansions in review summary
- `src/lib/listings/actions.ts` — `createListing`: insert expansion rows after listing; `updateListing`: diff and sync expansion rows
- `src/app/[locale]/listings/[id]/edit/EditListingForm.tsx` — add expansion editing UI
- `src/app/api/games/search/route.ts` — add `includeExpansions` param, add `is_expansion` to SELECT
- `src/app/api/games/[id]/pricing/route.ts` — accept `expansionIds` param, parallel retail fetch, breakdown response
- `src/lib/pricing/suggestions.ts` — `fetchRetailPrice` called per-game (existing), new bundle aggregation logic
- `src/app/[locale]/sell/_components/PricingAssistant.tsx` — accept `expansionIds` prop, display breakdown
- `src/app/[locale]/browse/page.tsx` — add "Show expansion listings" filter, add expansion count lateral join
- `src/components/listings/ListingCardMini.tsx` — "+N expansions" badge
- Listing detail page component — "Included Expansions" section
- `src/components/orders/OrderDetailClient.tsx` — show expansion names in order items
- `src/lib/email/templates/order-confirmation-buyer.tsx` — expansion info in game name
- `src/lib/email/templates/` (seller templates) — same expansion info enrichment
- `src/lib/email/cart-emails.ts` — `orderGameSummary()` to include expansion data
- `src/lib/checkout/cart-types.ts` — add `expansionCount` to `CartItem`
- `src/app/[locale]/cart/page.tsx` — "+N expansions" display in cart items

## Verification

1. **Create a base game + expansions listing:** Select a game with known expansions (e.g. Catan), verify expansion step appears, tick 2-3 expansions, complete version selection for base game, leave expansion versions empty, publish listing
2. **Verify version optionality:** Confirm listing saves successfully with null version columns on expansions
3. **Verify listing display:** Check browse card shows "+N expansions", detail page shows expansion section with names
4. **Create a standalone expansion listing:** Search for an expansion by name, verify it appears in results with "Expansion" badge, create listing, verify no expansion step appears
5. **Edit a listing's expansions:** Edit an existing bundle listing, add an expansion, remove one, change a version — verify all changes persist correctly
6. **Browse filter:** Toggle "Show expansion listings" on/off, verify expansion-primary listings appear/disappear
7. **Order display:** Purchase a bundle listing, verify order detail page and confirmation email show expansion info
8. **Bundle pricing:** Create a listing with base + 2 expansions, verify pricing assistant shows summed retail price with per-game breakdown. Verify games without retail data show "Price not available" and are excluded from sum.
9. **Edge cases:** Game with 0 expansions (step skips), game with 30+ expansions (filter works), concurrent expansion upserts (no errors), self-reference guard (rejected), auction with bids blocks expansion editing
9. **Auction compatibility:** Create an auction listing with expansions, verify bidding works normally
10. **`pnpm build`** passes with no type errors
11. **Cart display:** Add a bundle listing to cart, verify "+N expansions" appears below game title
13. **Existing listings unaffected:** Browse existing listings, verify no regressions

## Implementation Sequence

Each step should be a separate commit, independently verifiable with `pnpm build`.

1. **Migration + RLS** — `listing_expansions` table, constraints, RLS policies
2. **Expansion discovery endpoint** — `GET /api/games/[id]/expansions` + games upsert logic
3. **Batch versions endpoint** — `GET /api/games/versions`
4. **Search endpoint** — `includeExpansions` param, `is_expansion` in response
5. **Creation flow** — expansion gate prompt, `ExpansionStep`, multi-game `VersionStep`, duplicate listing alert, updated `ReviewPriceStep`, submit action with expansion rows
6. **Edit flow** — expansion editing in `EditListingForm`, update action with diff logic
7. **Browse/display** — "Show expansion listings" filter, expansion count lateral join, "+N expansions" badge on cards, "Included Expansions" section on detail page
8. **Pricing** — bundle retail price fetching, `bundleRetailPriceCents`, breakdown display in `PricingAssistant`
9. **Order/email/notification display** — expansion info in order detail, email templates, notification `gameName` enrichment
10. **Cart** — `expansionCount` in `CartItem`, "+N expansions" in cart display

## Deferred Items (Explicitly Out of Scope for v1)

- **Unrelated game bundles** (scenario C) — selling "Catan + Ticket to Ride" as a lot. Natural v2 if manual game search is added.
- **Manual expansion search** — escape hatch for expansions missing from BGG's outbound links. v2 addition, also enables scenario C.
- **Shelf sync for expansion items** — linking/reverting expansion shelf items when bundle listings are created/cancelled/sold. Deferred alongside broader shelf feature review.
- **Wanted listings with expansions** — "Looking for Catan + Seafarers." Separate feature with its own design considerations.
- **Summed marketplace stats** — lowest active / median sold for bundle compositions. No meaningful historical data to aggregate yet.
- **Smart version defaults (Option B)** — auto-matching expansion versions to base game's language/publisher. v2 polish once we see real usage patterns.
- **Denormalized expansion count** — `expansion_count` column on `listings` for query optimization. Premature for current traffic; add if browse queries show performance issues.
