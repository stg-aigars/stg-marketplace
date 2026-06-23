# Plan: Declining-Price Listings

> Feature request from a `/sell` user: a listing whose price drops automatically on a schedule (e.g. €60, −€5/week, floor €30) until a buyer takes it or it reaches the floor. Known generically as a Dutch auction; **user-facing name is "declining price"** — never "Dutch auction" in UI copy.

## Core architectural decision (read first)

A declining-price listing is **not an auction** in this codebase's sense. There are **no bids, no `bids` table, no `place_bid` RPC, no snipe protection, no `auction_ended` status, no winner-payment-deadline cron, no dedicated auction checkout.** It is a **fixed-price listing whose `price_cents` decreases on a schedule.** The first buyer to purchase at the current price wins through the **normal fixed-price cart → reservation → EveryPay → order flow.**

Build it on the fixed-price rails. Do **not** reuse or branch the `'auction'` machinery. Roughly 90% of this feature is reuse; the genuinely new parts are: schedule fields, one cron that materializes drops, sell-flow config, and display.

Decisions already settled (do not relitigate):
1. Internal `listing_type` value: `'declining'`. User-facing copy: "declining price."
2. Drops are **relative to publish time** (per-listing `schedule_start_at`), not a fixed weekly wall-clock.
3. Edit rule: schedule editable **until the first drop occurs** (`price_cents == starting_price_cents`), then locked. Cancel allowed anytime the listing is not reserved.

---

## Phase 0 — Verification gate (completed 2026-06-23)

Per CLAUDE.md, changes touching DB schema and payment flows require stating the approach and waiting for confirmation before implementing. This pass verified every assumption against source. Five items confirmed the original plan outright; two required correction, folded into Phase 1 below.

1. **`listing_type` enum.** Confirmed: plain `TEXT` column with an inline (auto-named) `CHECK` constraint, not a Postgres enum. Added in `supabase/migrations/032_auctions.sql:10-11`: `ADD COLUMN listing_type TEXT NOT NULL DEFAULT 'fixed_price' CHECK (listing_type IN ('fixed_price', 'auction'))`. No `CONSTRAINT name` was given, so Postgres auto-named it `listings_listing_type_check` — the new migration must `DROP CONSTRAINT listings_listing_type_check` and re-add with `'declining'` appended, mirroring the exact mechanism. `isAuctionWithBids` (`src/lib/listings/types.ts`) is the only existing listing-type guard to mirror with `isDecliningListing(listingType)`.

2. **Listing status enum — CORRECTED.** The DB has **6** status values, not 5: `'active' | 'sold' | 'cancelled' | 'reserved' | 'auction_ended' | 'paused'`. The `ListingStatus` TS type in `src/lib/listings/types.ts` is stale — missing `'paused'` (added in `supabase/migrations/080_seller_status.sql:18-19`, used when a seller is suspended; listings in this state are not buyable). `'active'` is the sole "available for purchase" status. Reservation is modeled directly on `listings` (no separate table): `reserved_at` / `reserved_by` columns (migration `017_reservation_timer.sql`), flipped atomically by the `reserve_listings_atomic` RPC (migration `025_cart_checkout.sql:38-68`, locks rows `FOR UPDATE`, transitions `status: 'active' → 'reserved'`). The `expire-reservations` cron reverts stale `'reserved'` rows back to `'active'` via `expire_stale_reservations`. **Action: the drop cron's `WHERE` clause must be the literal `status = 'active'`** — not a looser "available/listed" predicate — since that's the exact predicate the rest of the codebase already uses to gate price mutation (see item 4). Using the literal value also automatically excludes `'paused'` with no extra clause needed.

3. **Reservation model.** Confirmed above — reservation is row-state on `listings` itself (`status='reserved'`, `reserved_by`), not a separate table. The drop cron's exclusion of any non-`'active'` status is sufficient; no additional reservation-table join is needed.

4. **Buy-path price snapshot — CORRECTED framing, same practical outcome.** Neither `cart_checkout_groups` nor `orders` snapshots a per-listing price at reservation time. Both `src/app/api/payments/cart-create/route.ts` (cart creation) and `src/lib/services/payment-fulfillment.ts` (EveryPay confirmation) re-read `listings.price_cents` live. This is **not a latent bug that needs fixing** — it's already safe today by a separate, pre-existing invariant: `src/lib/listings/actions.ts:246` blocks any price edit unless `listing.status !== 'active'` returns false (i.e. only `'active'` listings can have their price changed), and `reserve_listings_atomic` flips `status` away from `'active'` atomically under a row lock at the moment of reservation. So `price_cents` provably cannot change once a listing leaves `'active'`. As long as the drop cron honors that exact same invariant (`WHERE status = 'active'`, per item 2), the live re-read at EveryPay confirmation is guaranteed to see the same price shown at cart-create — the race the original plan worried about is closed by inheriting an existing invariant, not by adding a new snapshot column.

5. **Auction field null-coupling.** Confirmed: existing auction columns (`auction_end_at`, `starting_price_cents`, `current_bid_cents`, `highest_bidder_id`, `payment_deadline_at`, all added in migration `032_auctions.sql:14-22`) are plain nullable columns with **no cross-column CHECK** — only a single-column range check on `starting_price_cents >= 50`. The new declining fields should follow the same minimal convention: plain nullable columns, single-column range checks only, no type-coupling CHECK invented fresh for this feature.

6. **Badge variants — corrected detail.** `src/components/ui/badge.tsx:6` defines `BadgeVariant` with existing entries `auction` (`aurora-purple`) and `wanted` (reuses `semantic-brand`). Colors come from the `aurora` palette in `src/styles/tokens.ts`, wired into Tailwind via `tailwind.config.ts`. **Correction:** there is no unused aurora hue to repurpose — all five existing entries (`orange`, `green`, `red`, `yellow`, `purple`) already carry specific semantic meaning (e.g. `orange` = purchase-intent CTAs / hot deals, `purple` = auctions). Phase 3 must add a **genuinely new sixth aurora token** for `declining`, chosen to stay visually distinct from `frost.*` (already blue-toned, used for brand/trust) and from `semantic.primary` (orange, purchase-intent).

7. **Cron registration.** Confirmed: `docs/operations/coolify-api-notes.md` documents `POST /api/v1/applications/<uuid>/scheduled-tasks` with `{name, command, frequency, container, enabled, timeout}`. Standard cron syntax for `frequency` (hourly = `0 * * * *`). Re-POSTing the same task duplicates it — register once. The new `apply-price-drops` route follows the same `Authorization: Bearer ${CRON_SECRET}` / `POST` pattern as `expire-reservations`.

8. **Bonus check — `starting_price_cents` reuse.** Confirmed it already exists (`032_auctions.sql:17`, `CHECK (starting_price_cents IS NULL OR starting_price_cents >= 50)`), currently used only by the auction `place_bid` RPC as the auction floor/minimum-bid baseline. Reusing it for declining-listing semantics is a deliberate repurposing of an auction-named column for a new purpose — acceptable (keeps browse/sort/JSON-LD untouched per the architectural decision above) but worth a one-line comment at the point of reuse so a future reader isn't confused about why an "auction" column appears on a non-auction listing type.

9. **New finding — interaction with migration 122 (price-drop tracking), not in the original Phase 0 list.** `supabase/migrations/122_listing_price_drop_tracking.sql` already ships a `BEFORE UPDATE` trigger (`trg_listings_track_price_change`) that maintains `previous_price_cents` / `price_changed_at` / generated `has_price_decrease` for the "Price drops only" browse filter. The trigger explicitly guards on `OLD.listing_type = 'fixed_price' AND NEW.listing_type = 'fixed_price'` (lines 81-83) — the same exclusion pattern already used to keep auctions out. Since the new type is `'declining'`, not `'fixed_price'`, **the drop cron's writes will not populate this tracking, and declining listings will never appear in "Price drops only."** This is the right outcome (mechanical, scheduled drops aren't the same "deal" signal as a seller manually marking something down, and the declining UI already surfaces the drop directly via badge + next-drop date) — but it must be a stated decision, not a silently-inherited side effect. See the updated "Price-drop-tracking note" below.

---

## Phase 1 — Backend (PR 1)

Single concern: data model + drop logic + cron + buy-path correctness. Fully testable without UI. **Migration before code** (additive change).

### Schema migration (next sequential migration number)

Add to `listings`:

| Column | Type | Notes |
|---|---|---|
| `floor_price_cents` | int | minimum; price clamps here and listing stays buyable at floor |
| `decrement_cents` | int | drop per interval |
| `drop_interval_days` | int | 7 = weekly |
| `schedule_start_at` | timestamptz | drops counted from here; defaults to publish time |
| `next_drop_at` | timestamptz (nullable) | denormalized for indexable cron query + display; `NULL` once floor reached |

Reuse, do not re-add:
- **`starting_price_cents`** (already on the table from the auction work; add a one-line comment at the column-reuse site per Phase 0 item 8) for the opening price.
- **`price_cents`** as the effective current price; set `= starting_price_cents` at creation. This is what keeps browse/sort/filter/search/JSON-LD working untouched.

Add `'declining'` to the `listing_type` constraint: `DROP CONSTRAINT listings_listing_type_check` / re-add with `'declining'` included (Phase 0 item 1's exact mechanism).

CHECK constraints (single-column only, per Phase 0 item 5's no-cross-coupling convention):
- `floor_price_cents < starting_price_cents`
- `decrement_cents > 0`
- `drop_interval_days >= 1`

Index `next_drop_at` (partial: `WHERE next_drop_at IS NOT NULL`) for the cron query.

All monetary values are **integer cents**.

**Price-drop-tracking note (migration 122):** declining listings are excluded from `has_price_decrease` / "Price drops only" by the same `listing_type = 'fixed_price'` guard that already excludes auctions — confirmed in Phase 0 item 9. No migration change needed; this is a deliberate inherited behavior, not an oversight.

### Types

In `src/lib/listings/types.ts`: add `'declining'` to `ListingType`, add the new fields to the listing type, add an `isDecliningListing(listingType)` guard alongside the existing guards. While in this file: optionally fix the stale `ListingStatus` union (missing `'paused'`, per Phase 0 item 2) — pre-existing gap, not introduced by this feature, but low-cost to close while the file is open for the declining-type additions.

### Pure price function (the heart — must be unit-tested)

New `src/lib/listings/declining-price.ts`:

```
computeDecliningPrice({
  startingPriceCents, floorPriceCents, decrementCents,
  dropIntervalDays, scheduleStartAt, now
}) -> { currentPriceCents, nextDropAt }
```

Logic (self-healing, compute-from-elapsed — **not** single-step decrement):

```
elapsedMs   = now - scheduleStartAt
steps       = max(0, floor(elapsedMs / (dropIntervalDays * 86_400_000)))
target      = max(floorPriceCents, startingPriceCents - steps * decrementCents)
nextDropAt  = target <= floorPriceCents ? null
                                        : scheduleStartAt + (steps + 1) * intervalMs
```

Co-located `declining-price.test.ts` (Vitest): pre-first-drop, mid-schedule, exact floor, past floor, missed-cron catch-up (large `steps`), `next_drop_at` becomes null at floor. Use `vi.useFakeTimers()`; restore with `vi.useRealTimers()` in `afterEach`. Pure logic, no mocking.

### Cron: `apply-price-drops`

New route `src/app/api/cron/apply-price-drops/route.ts`, following the existing cron pattern exactly: `POST`, `Authorization: Bearer ${CRON_SECRET}` (401 on mismatch via `env.cron.secret`). Schedule **hourly** (`0 * * * *`) — finer than daily-scale intervals is unnecessary; hourly keeps the displayed price honest within an hour. Coolify command:

```
curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/apply-price-drops
```

Behavior:
- Select listings where `listing_type = 'declining'` AND **`status = 'active'`** (Phase 0 items 2 + 4 — the literal value, not a looser predicate; this is the exact invariant `actions.ts:246` already relies on to gate price mutation, and it's what closes the mid-checkout race with zero additional snapshot machinery) AND `next_drop_at <= now()`.
- For each, call `computeDecliningPrice(...)`; update `price_cents` and `next_drop_at` only when `price_cents` differs from the computed target. Volume is low at launch; per-row update via the pure function keeps one tested source of truth (move to a set-based SQL update later only if volume demands).
- **Idempotent by construction** — re-running computes the same target and no-ops. No `source_doc` dedupe needed (this is not the accounting engine).
- Reservation expiry needs no special handling: the next cron run recomputes the correct elapsed-time price automatically.
- **No new audit events.** Price is derivative of the canonical `listings` row (same rationale as `order.status_changed` being operational). Do not invent a per-drop audit event.

### Validation in the create path

Wherever the sell server action inserts a listing: validate the declining inputs before insert (return `{ error }`, never throw), set `price_cents = starting_price_cents`, `schedule_start_at = published_at`, and the initial `next_drop_at`.

### Phase 1 verification
`pnpm verify` green. Cron tested locally with the Bearer header against a seeded declining listing.

---

## Phase 2 — Sell flow (PR 2)

Add the declining branch to the `/sell` flow (`src/app/[locale]/sell/`).

- Listing-type selection (fixed price / auction / declining).
- Declining config inputs: starting price, floor price, decrement, interval (default 7 days). Use shared `Input` / `Select`; money displayed via `Price` / `formatPrice`, integer cents under the hood.
- **Live schedule preview** using the same `computeDecliningPrice` (iterate steps to floor): "€60 today → €55 on 12.06.2026 → … → €30 floor on 17.07.2026", dates via `formatDate` from `@/lib/date-utils`. Straightforward and trust-building (brand voice), and catches nonsense configs before submit.
- Mirror the create-path validation client-side for fast feedback; the server action remains the authority.

i18n: add EN keys (real copy) and mirror into `lv` / `lt` / `et` locale files — **no hardcoded English strings**. Flag the new keys for the translation/humanizer pass. Brand voice: "declining price", no exclamation marks, "pre-loved" where game condition is referenced.

`pnpm verify` green.

---

## Phase 3 — Display (PR 3)

- **Badge:** new `Badge variant="declining"` in `@/components/ui` using a **new sixth aurora color token** (Phase 0 item 6 — no existing unused hue; pick one visually distinct from `frost.*` and `semantic.primary`), `rounded-md`. Per CLAUDE.md: add to `@/components/ui/index.ts`, update the Shared Components table, flag the new design-system variant and the new color token in the PR description.
- **Listing detail:** show current `Price` (always `font-sans`), floor ("won't drop below €X"), and next drop ("drops to €55 on 12.06.2026") from `next_drop_at`. When `next_drop_at IS NULL`, show "lowest price reached" instead. If this block is used only on the detail page, keep it page-scoped; if it also lands on browse cards, extract a shared component (use `cn()` from `@/lib/cn` for className merging) and flag it.
- **Browse / cards:** declining badge plus a subtle downward affordance next to `Price` (Phosphor icon from `@phosphor-icons/react/ssr`). No new query work — `price_cents` already drives card pricing.

i18n for all new strings across the four locale files. `pnpm verify` green.

---

## Explicitly out of scope for v1

- **`listing.price_dropped` notifications** to watchers/favoriters. Only viable if a watchlist table exists; the `listing.` notification prefix is already in the `notifications_type_check` regex, so no prefix migration would be needed — but defer until watchlist is confirmed/built.
- Auto-expiry N days after hitting the floor. Floor listings simply remain buyable at floor.
- Surfacing declining-listing drops in the "Price drops only" browse filter (migration 122) — deliberately excluded, see Phase 0 item 9.

## Accounting note (no work required)

The O.x order-completion entry feeds the actual sale price via `item_value_cents`; a declining sale is just whatever `price_cents` was at purchase. 10% commission on item price as normal. **Zero accounting changes** — stated here so it's not treated as an open question.

## Branching / merge discipline

Feature branch + PR per phase (multi-file). `pnpm verify` is the merge gate. Hold all merges to main for explicit approval. Phase 1 migration goes before Phase 1 code (additive). Delete feature branches after merge.
