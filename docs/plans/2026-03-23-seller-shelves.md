# Seller Shelves — Implementation Plan

## Context

STG's priority differentiator feature. Sellers showcase their board game collection publicly. Each game can be "not for sale" (display only), "open to offers" (buyers propose prices), or "listed" (linked to active listing). Inverts the marketplace from "search for a game" to "browse a collector's shelf."

The shelf is a lightweight storefront layer above the existing listing system. Shelf items graduate into full listings when a deal is struck, reusing the entire listing + checkout + payment pipeline.

## Key Decisions

- **BGG catalog only** — shelf items reference `games.id`
- **Lightweight shelf items** — game ref + visibility + notes. No photos/condition/price
- **Structured offers** — buyer proposes price → seller accepts/counters/declines
- **Single-round counters** — seller counters once, buyer accepts/declines (no ping-pong)
- **7-day offer expiry** — cron job, email notification on expiry
- **Accept flow** — seller accepts → creates listing (photos, condition, locked price) → buyer notified → standard checkout
- **3-day listing deadline** — after accepting, seller has 3 days to create the listing or offer reverts
- **Grid-only** — no Grid/List toggle for v1
- **BGG collection import** — bulk import from public BGG collection with preview

## Known Limitations (v1)

- One shelf entry per game per seller (UNIQUE constraint). Multiple copies not supported.
- No re-sync from BGG (import is additive — only adds, never removes)
- No expansion support (filtered at BGG API level)

---

## Phase 1: Database Schema

### Task 1: shelf_items + offers tables (migration 024)

**Files:** `supabase/migrations/024_seller_shelves.sql`

**shelf_items:**
- `id` UUID PK, `seller_id` FK → user_profiles, `bgg_game_id` FK → games
- `game_name` TEXT, `game_year` INTEGER
- `visibility` TEXT ('not_for_sale' | 'open_to_offers' | 'listed')
- `notes` TEXT (max 500), `listing_id` FK → listings (nullable)
- UNIQUE(seller_id, bgg_game_id)
- RLS: public read, seller write

**offers:**
- `id` UUID PK, `shelf_item_id` FK → shelf_items
- `buyer_id`, `seller_id` FK → user_profiles
- `amount_cents` INTEGER (50–9999999), `counter_amount_cents` INTEGER
- `note` TEXT (max 500), `status` TEXT, `expires_at` TIMESTAMPTZ (default now()+7 days)
- **Partial unique:** only one active offer per buyer per shelf item

```sql
CREATE UNIQUE INDEX idx_offers_active_per_buyer
  ON offers(shelf_item_id, buyer_id)
  WHERE status IN ('pending', 'countered');
```

**Offer state machine:**
```
pending → accepted | countered | declined | expired | cancelled
countered → accepted | declined | expired | cancelled
accepted → completed (listing created + purchased)
```

Enforcement: only the *other* party can act on the current state. Seller acts on 'pending', buyer acts on 'countered'. App logic validates `auth.uid()` against the expected actor.

### Task 2: BGG username on profile (migration 025)

**Files:** `supabase/migrations/025_bgg_username.sql`

```sql
ALTER TABLE user_profiles
  ADD COLUMN bgg_username TEXT CHECK (bgg_username IS NULL OR char_length(bgg_username) <= 50);
```

---

## Phase 2: Types & Service Layer

### Task 3: Shelf and offer types

**Files:** `src/lib/shelves/types.ts`

Types: `ShelfVisibility`, `ShelfItemRow`, `ShelfItemWithGame`, `OfferStatus`, `OfferRow`, `OfferWithDetails`

Constants: `MAX_NOTE_LENGTH = 500`, `OFFER_TTL_DAYS = 7`, `LISTING_DEADLINE_DAYS = 3`

### Task 4: Shelf actions

**Files:** `src/lib/shelves/actions.ts`

Functions:
- `addToShelf(bggGameId, visibility?, notes?)` — insert shelf item
- `addBulkToShelf(items[], bggUsername?)` — batch insert from BGG import (ON CONFLICT skip)
- `updateShelfItem(id, visibility, notes?)` — update own item
- `removeFromShelf(id)` — delete (cascades offers)
- `getMyShelf()` — fetch seller's shelf with game thumbnails
- `getSellerShelf(sellerId)` — fetch public shelf
- `linkListingToShelfItem(shelfItemId, listingId)` — helper for accept flow
- `updateBggUsername(username)` — save BGG username to profile

### Task 5: Offer actions

**Files:** `src/lib/offers/actions.ts`

Functions:
- `makeOffer(shelfItemId, amountCents, note?)` — validate, insert, email seller
- `counterOffer(offerId, counterAmountCents)` — seller only, reset expiry, email buyer
- `acceptOffer(offerId)` — role-dependent (seller accepts pending, buyer accepts countered), email other party
- `declineOffer(offerId)` — role-dependent, email other party
- `cancelOffer(offerId)` — buyer cancels own offer
- `getMyOffers()` — buyer's sent offers
- `getSellerOffers()` — seller's received offers

Validation per action: check `auth.uid()` matches expected actor for current status. Prevent seller acting on 'countered' offers, buyer acting on 'pending' offers.

### Task 6: Offer email notifications

**Files:**
- `src/lib/email/index.ts` — add 6 new email functions
- `src/lib/email/templates/offer-*.tsx` — 4 templates (received, countered, accepted, declined/expired)

Emails (6 functions, 4 templates — expired shares declined template with different copy):
- offer received (seller), offer countered (buyer), offer accepted (both parties)
- offer declined (buyer), offer expired (buyer), offer superseded by listing (buyer — see Task 21)

### Task 7: BGG collection fetch

**Files:**
- `src/lib/bgg/collection.ts` — fetching + parsing + 202 retry loop
- `src/app/api/bgg/collection/route.ts` — API route with auth, validation, matching to local games table

Returns matched items with `inLocalDb`, `alreadyOnShelf` flags. Rate limit: 1 collection fetch per user per 5 minutes.

### Task 8: Batch thumbnail enrichment

**Files:** `src/app/api/games/enrich-batch/route.ts`

POST route accepting up to 20 BGG game IDs. Enriches un-enriched games via single BGG Thing API call. Returns thumbnails for all requested IDs.

### Task 9: Offer expiry + listing deadline cron (combined)

**Files:** `src/app/api/cron/expire-offers/route.ts`

POST + Bearer auth. Single cron, every 6 hours. Two queries in one route:

```sql
-- 1. Expire unanswered offers (7-day TTL)
UPDATE offers SET status = 'expired'
WHERE status IN ('pending', 'countered') AND expires_at < now();

-- 2. Revert accepted offers where seller didn't create listing (3-day deadline)
UPDATE offers SET status = 'expired'
WHERE status = 'accepted' AND updated_at < now() - interval '3 days';
```

Email buyer on both: "Your offer expired" (with different copy for each scenario).

---

## Phase 3: Seller Shelf Management UI

### Task 11: Shelf management page

**Files:**
- `src/app/[locale]/account/shelf/page.tsx` — server component, fetches shelf
- `src/app/[locale]/account/shelf/AddToShelfForm.tsx` — game search modal (reuses `/api/games/search`)
- `src/app/[locale]/account/shelf/ShelfItemCard.tsx` — card with visibility toggle, edit, remove

Layout: "My shelf" heading + [Import from BGG] button + [Add game] button + grid of ShelfItemCards

### Task 12: BGG collection import UI

**Files:** `src/app/[locale]/account/shelf/ImportFromBGG.tsx`

3-step flow:
1. Enter BGG username (pre-filled if saved)
2. Preview collection grid with checkboxes (already-on-shelf dimmed, not-in-DB disabled)
3. Confirm import with count + progress bar

### Task 13: Shelf thumbnail enrichment hook

**Files:** `src/app/[locale]/account/shelf/useShelfEnrichment.ts`

Client hook: on mount, find items with null thumbnails, call batch enrichment for visible items, update state as thumbnails arrive.

### Task 14: Add shelf link to account page

**Files:** `src/app/[locale]/account/page.tsx` — add "My shelf" between "My Listings" and "Favorites"

---

## Phase 4: Public Shelf Page

### Task 15: Shelf section on seller profile

**Files:** `src/app/[locale]/sellers/[id]/page.tsx` — add "Game shelf" section

Display shelf items in grid: thumbnail, name, year, visibility badge. "Open to offers" items show "Make an offer" button (authenticated non-owner only). "Listed" items link to listing.

### Task 16: Make offer modal

**Files:** `src/components/offers/MakeOfferModal.tsx`

Game thumbnail + name, price input (cents, min €0.50), optional note (500 chars), Turnstile widget, submit button.

---

## Phase 5: Offer Management UI

### Task 17: Offers page with tabs

**Files:**
- `src/app/[locale]/account/offers/page.tsx` — Tabs: "Received" (seller) / "Sent" (buyer)
- `src/components/offers/OfferCard.tsx` — offer display with role-dependent actions

OfferCard: game thumbnail + name, buyer/seller name, amount (+ counter if applicable), note, status badge, expiry countdown, action buttons.

Seller actions on pending: Accept / Counter / Decline
Buyer actions on countered: Accept / Decline
Buyer actions on pending: Cancel

### Task 18: Add offers link to account page

**Files:** `src/app/[locale]/account/page.tsx` — add "Offers" to quick links

---

## Phase 6: Accept Flow

### Task 19: Pre-filled listing creation from accepted offer

**Files:**
- `src/app/[locale]/sell/from-offer/[offerId]/page.tsx` — listing creation with game pre-selected, price locked
- Modify: `src/lib/listings/actions.ts` — accept optional `offerId` to link offer on creation

Flow: seller accepts → navigates to pre-filled sell flow → game locked, price locked at agreed amount → seller adds photos, condition, edition → listing created → shelf item updated (visibility=listed, listing_id set) → offer status → completed → buyer emailed with link to listing

### Task 20: Listing deadline enforcement

If seller doesn't create listing within 3 days of acceptance, offer reverts to expired. Handled by the combined cron in Task 9.

---

## Phase 7: Integration & Sync

### Task 21: Auto-link new listings to shelf + decline stale offers

**Files:** `src/lib/listings/actions.ts`, `src/lib/offers/actions.ts`

When seller creates any listing (not just from offer), check if they have a shelf_item for the same bgg_game_id. If yes:
1. Update shelf_item: visibility → 'listed', listing_id → new listing id
2. Auto-decline any active offers (pending/countered) on that shelf item — the game is now listed at a specific price, so open offers are stale
3. Email each affected buyer: "The seller has listed [game]. View the listing here." (uses the "superseded by listing" email from Task 6)

### Task 22: Sync shelf on listing sold/cancelled

**Files:** `src/lib/services/order-transitions.ts`, `src/lib/listings/actions.ts`

- Listing sold (order completed): shelf_item visibility → 'not_for_sale'
- Listing cancelled: shelf_item visibility → 'open_to_offers', listing_id → null

### Task 23: Update CLAUDE.md and docs

**Files:** `CLAUDE.md`, `memory/seller_shelves.md`

---

## Execution Order

```
Phase 1 (DB: Tasks 1-2)
  ↓
Phase 2 (Services: Tasks 3-10)
  ↓
Phase 3 (Seller UI: Tasks 11-14)  ←→  Phase 4 (Public UI: Tasks 15-16)
                    ↓                              ↓
              Phase 5 (Offer UI: Tasks 17-18)
                    ↓
              Phase 6 (Accept flow: Tasks 19-20)
                    ↓
              Phase 7 (Integration: Tasks 21-23)
```

## Effort

| Phase | Tasks | Effort |
|---|---|---|
| 1. DB Schema | 1-2 | Half day |
| 2. Types & Services | 3-9 | 3-4 days |
| 3. Seller UI + Import | 11-14 | 2-3 days |
| 4. Public Shelf | 15-16 | 1 day |
| 5. Offer UI | 17-18 | 1-2 days |
| 6. Accept Flow | 19-20 | 1-2 days |
| 7. Integration | 21-23 | 1 day |
| **Total** | **23 tasks** | **~4-5 weeks** |

## Verification Protocol

1. `pnpm build` + `pnpm test` per task
2. Feature branch → PR → `/code-review:code-review` → `/simplify` → merge
3. Visual spot-check on mobile (375px)
4. Update CLAUDE.md shared components table if new components added
5. DB migrations applied via Supabase MCP before code deployment
