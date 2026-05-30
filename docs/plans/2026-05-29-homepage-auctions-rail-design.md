# Homepage auctions rail — design

**Status:** design approved 2026-05-29; not yet implemented.
**Scope:** add an "Auctions ending soon" rail to the homepage above the existing "Recently listed" rail, with a "See all auctions" link to `/browse?auctions=1`.
**Goal:** give auctions a dedicated discovery surface as both a content lane and a marketing signal that auctions exist on the platform.

## Background

A visibility audit on 2026-05-29 confirmed auctions get no preferential treatment on the homepage today. They sit interleaved into the "Recently listed" rail, distinguished only by the in-card gavel + countdown overlay rendered by `ListingCard`. The audit also confirmed:

- `ListingCard` already supports auction rendering (badge, countdown, bid count). No card-layer work.
- `ListingSection` already accepts the props needed (eyebrow, heading, href, linkText, listings, favoriteIds, expansionCounts, commentCounts). No section-layer work.
- Migration 032 ships `idx_listings_auction_end ON listings(auction_end_at) WHERE listing_type = 'auction' AND status = 'active'`, a partial index whose predicate matches the new query exactly and whose sort column matches the ASC order. No new index migration.
- Browse already handles `?auctions=1` by filtering to `listing_type = 'auction'`. No browse-side work.

## Decisions

1. **Framing:** "ending soon" (urgency). Sort by `auction_end_at` ASC.
2. **Card count:** up to 4.
3. **Render threshold:** ≥ 1 active auction. Sparse-row trade-off at low counts (1-of-4 columns on desktop) is accepted as the cost of marketing-discovery visibility.
4. **Rail semantics:** the existing "Recently listed" rail becomes fixed-price only. Two distinct lanes on the homepage: auctions above, fixed-price below.
5. **Copy:** eyebrow `Going, going…`, heading `Auctions ending soon`, link `See all auctions`. i18n namespace `home.auctions.*` (durable parent surface, not state-coupled).
6. **No new components.** No new index. No new analytics event. No feature flag. No empty-state evergreen card.

## Data

Add a second `from('listings').select(...)` to the existing `Promise.all` block in [src/app/[locale]/page.tsx](src/app/[locale]/page.tsx):

```ts
supabase
  .from('listings')
  .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
  .eq('listing_type', 'auction')
  .eq('status', 'active')
  .gt('auction_end_at', new Date().toISOString())
  .order('auction_end_at', { ascending: true })
  .limit(4)
  .returns<RecentListingRow[]>()
```

The time predicate `gt('auction_end_at', now())` is the primary filter. `status = 'active'` is the secondary guard. The `end-auctions` cron runs every 60s, so without the time predicate a just-expired auction would land at position 1 in an ASC sort — the worst possible slot.

The projection is identical to the existing `recentListings` query, so:
- `RecentListingRow` reuses cleanly.
- `getListingCardCounts` extends to `[...recentListings, ...endingSoonAuctions].map(l => l.id)`.
- `ListingCard` consumes `isAuction`, `bidCount`, `auctionEndAt` — all present in the projection. The card does **not** read `current_bid_cents`; auction price display uses `price_cents` with a "Starting at" prefix when `bidCount === 0`.

### Listing type literal verification

`ListingType` is `'fixed_price' | 'auction'` ([src/lib/listings/types.ts:3](src/lib/listings/types.ts#L3)). Migration 032 enforces `CHECK (listing_type IN ('fixed_price', 'auction'))`. Wanted listings live on a separate `wanted_listings` table, not on `listing_type`. Filtering "Recently listed" to `listing_type = 'fixed_price'` therefore creates exactly two homepage lanes and does not silently exclude wanted content.

### Existing query change

Add `.eq('listing_type', 'fixed_price')` to the existing `recentListings` query. This is the dedupe mechanism: a freshly created auction no longer appears in both rails. The semantic shift is intentional. "Recently listed" stops meaning "everything recent" and starts meaning "ready-to-buy". The PR description calls this out.

## Render

Inside [src/app/[locale]/page.tsx](src/app/[locale]/page.tsx), insert the new section between `<TrustBand />` and the existing "Recently listed" wrapper:

```tsx
{endingSoonAuctions.length >= 1 && (
  <div className="max-w-7xl mx-auto px-4 sm:px-6">
    <ListingSection
      eyebrow={t('auctions.eyebrow')}
      heading={t('auctions.heading')}
      href="/browse?auctions=1"
      linkText={t('auctions.browseAll')}
      listings={endingSoonAuctions}
      favoriteIds={favoriteIds}
      isAuthenticated={isAuthenticated}
      expansionCounts={expansionCounts}
      commentCounts={commentCounts}
      className="py-8 sm:py-10 lg:py-12"
    />
  </div>
)}
```

Wrapper, padding, and section component are identical to the "Recently listed" block directly below.

### Sparse-row trade-off

`ListingSection` renders `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`. At one active auction the desktop view shows a single card occupying 1 of 4 columns, with the rest of the row blank. This reads as ~75% empty space.

The trade-off is deliberate. Hiding the rail until ≥ 2 active auctions exist would lose the marketing signal in the early-launch period when auctions are rarest. The discovery purpose argues for showing the surface whenever the feature is live, accepting that the rail looks sparse at the threshold edge. The PR description must call this out so reviewers do not file the sparse row as a layout bug.

## Copy and i18n

Only `src/messages/en.json` exists today. No lv/lt/et files have landed. Add three keys under `home`:

```json
"auctions": {
  "eyebrow": "Going, going…",
  "heading": "Auctions ending soon",
  "browseAll": "See all auctions"
}
```

The eyebrow follows the warm scene-setting pattern already in use (`recentlyListed.eyebrow = "On the shelves"`, `wanted.eyebrow = "On the hunt"`). The uppercase look comes from CSS (`uppercase tracking-wider` at [src/components/listings/ListingSection.tsx:64](src/components/listings/ListingSection.tsx#L64)); source strings stay sentence-case.

`Going, going…` carries a mild brand-voice risk. The auctioneer cadence is playful, but it leans into a specific scene. Fallback if it reads as too cute on review: `On the block` (same idiom family, drier). Heading and link copy are descriptive and unlikely to iterate.

The friction rule from the brand voice notes (no wit on blocked / error / tax / payment / dispute paths) does not apply here.

## Edge cache and the countdown anchor

The homepage at `/` sits behind Cloudflare per the existing proxy setup. The current cache rule for `/` and the locale-prefixed homepages needs verification before merge. Two cases:

- If `/` is cache-bypassed or has zero edge TTL, the `auction_end_at` anchor is fresh per request. Countdown is correct from hydration onward.
- If `/` has a non-trivial edge TTL, the rendered anchor can be stale by up to `edge_TTL + 60s` (compounded with the `end-auctions` cron window).

`AuctionCountdown` handles a stale anchor gracefully. At [src/components/auctions/AuctionCountdown.tsx:33](src/components/auctions/AuctionCountdown.tsx#L33), `timeLeft.totalSeconds <= 0` renders an "Ended" label, and `getTimeLeft` clamps the delta with `Math.max(0, …)`. The failure mode is "the first card briefly displays an Ended badge for an auction that concluded mid-TTL," not a negative countdown or garbage render.

**Action before merge:** grep the Cloudflare cache rules for `/` and locale variants. If a non-trivial TTL exists, decide between (a) tightening the rule for the homepage, (b) accepting the bounded staleness given the graceful fallback. Either is defensible. Pick deliberately and note the call in the PR.

## Index

The partial index `idx_listings_auction_end ON listings(auction_end_at) WHERE listing_type = 'auction' AND status = 'active'` matches the new query's predicate exactly and indexes the sort column. Postgres uses an index scan (ASC), not a memory sort. No new migration. An `EXPLAIN` on staging confirms before merge.

## Testing

A Vitest covering "renders auction section when ≥ 1 active auction" and "hides when zero" is trivial and worth shipping. Pure render logic, no DB mocking per the project testing convention.

The substantive risk surface is the query itself — filter correctness, ordering under load, edge TTL composition — which Vitest cannot reach without an integration harness. The project's integration-test gap is already documented in CLAUDE.md (Test Infrastructure Gaps). Manual smoke is the real safety net: uncontaminated cache, real Supabase state, both the homepage and `/browse?auctions=1` verified end-to-end.

The PR description states this trade-off explicitly so reviewers do not read the conditional render test as substantive risk coverage.

## Files touched

1. [src/app/[locale]/page.tsx](src/app/[locale]/page.tsx) — second Supabase query for `endingSoonAuctions`, conditional render block, `.eq('listing_type', 'fixed_price')` added to the existing `recentListings` query.
2. [src/messages/en.json](src/messages/en.json) — three new keys under `home.auctions`.

Two files. CLAUDE.md's "state approach before 3+ file changes" gate is satisfied by this design doc.

## Pre-merge gate

`pnpm verify` (`type-check && lint && test && build`) per the project's local-gate convention.

## PR description must enumerate

1. "Recently listed" becomes `listing_type = 'fixed_price'` only as a deliberate semantic split. Two-lane homepage: auctions above, fixed-price below. Wanted listings unaffected (separate table).
2. Sparse-row trade-off at low auction counts (1-of-4 columns on desktop) is intentional for marketing discovery, not a layout bug.
3. Compounded stale window for the countdown anchor (`edge_TTL + 60s`) is bounded by `AuctionCountdown`'s graceful "Ended" fallback at `totalSeconds <= 0`. Final decision on whether to tighten the CF cache rule recorded in the PR.
4. `ListingType` verified as `'fixed_price' | 'auction'`. The "Recently listed" filter uses `'fixed_price'`, not `'item'`.

## Out of scope (explicitly)

- No new analytics event. `listing_viewed` already fires on card click. A future `source` property on `listing_viewed` would let us compare auction-rail vs recent-rail engagement; per the project's `AnalyticsEventMap` convention that is a typed event change, not a one-liner. Deferred until we have a question to answer.
- No new index migration.
- No `ListingCardMini` variant for this rail.
- No empty-state evergreen card at zero auctions. The marketing intent only activates when the feature is live.
- No homepage tile A/B test.
