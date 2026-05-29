# Homepage auctions rail — implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Auctions ending soon" rail to the homepage above the existing "Recently listed" rail, with a link to `/browse?auctions=1`. Two distinct lanes: auctions above (urgency framing), fixed-price below.

**Architecture:** Two file changes. (1) Add three i18n keys to `src/messages/en.json` under `home.auctions`. (2) In `src/app/[locale]/page.tsx`: add a second Supabase query for the top 4 active auctions sorted by `auction_end_at` ASC, filter the existing `recentListings` query to `listing_type = 'fixed_price'` only (dedupe + semantic split), extend `getListingCardCounts` to cover both result sets, and render a new `ListingSection` between `<TrustBand />` and the existing Recently Listed block. No new components, no new index, no new analytics event.

**Tech stack:** Next.js App Router (Server Component), Supabase (`@/lib/supabase/server`), `next-intl` for translations, existing `ListingSection` and `ListingCard` components, existing partial index `idx_listings_auction_end` from migration 032.

**Design doc:** [docs/plans/2026-05-29-homepage-auctions-rail-design.md](2026-05-29-homepage-auctions-rail-design.md) — read this first if any decision below seems under-justified. All trade-offs (sparse-row at low counts, fixed-price-only semantic split, Cloudflare TTL composition) are recorded there.

**Testing approach:** No automated test for this change. The project has no Server Component page-render test infrastructure (verified: no `page.test.*` files exist anywhere in `src/app`), and the CLAUDE.md test convention is "test pure business logic, no mocking" — there is no pure logic to extract from "add a query and a render block." Verification is `pnpm verify` (the project's merge gate) plus a manual smoke test against the dev server with real Supabase state. This trade-off is documented in the design doc and must be called out in the PR description so reviewers do not read the absence of tests as an oversight.

**Branch:** Already on `feature/homepage-auctions-rail` (cut from `main` at commit `4af863d`).

---

## Task 1: Add i18n keys for the auctions rail

**Files:**
- Modify: `src/messages/en.json`

**Step 1: Add the `home.auctions` block right after `home.recentlyListed`**

Use the `Edit` tool. Locate the `recentlyListed` block (around lines 35-39 in [src/messages/en.json](src/messages/en.json)):

```json
    "recentlyListed": {
      "eyebrow": "On the shelves",
      "heading": "Recently listed",
      "browseAll": "Browse all games"
    },
    "wanted": {
```

Replace with:

```json
    "recentlyListed": {
      "eyebrow": "On the shelves",
      "heading": "Recently listed",
      "browseAll": "Browse all games"
    },
    "auctions": {
      "eyebrow": "Going, going…",
      "heading": "Auctions ending soon",
      "browseAll": "See all auctions"
    },
    "wanted": {
```

The `Going, going…` ellipsis is a single Unicode character (U+2026, `…`), not three periods. Copy-paste from this plan to preserve it.

**Step 2: Verify JSON validity and type-check**

Run: `pnpm type-check`

Expected: passes. `next-intl` derives types from `en.json` at compile time; a malformed JSON or unknown key reference would fail here.

**Step 3: Commit**

```bash
git add src/messages/en.json
git commit -m "feat(home): i18n keys for auctions rail"
```

No Co-Authored-By trailer.

---

## Task 2: Implement the auctions rail in `page.tsx`

**Files:**
- Modify: `src/app/[locale]/page.tsx`

Current relevant region of the file: [src/app/[locale]/page.tsx:48-105](../../src/app/[locale]/page.tsx#L48-L105). The data-fetch block is at lines 51-69, the seller-prop flags at 71-73, and the JSX return at 75-104.

This task makes four edits to `page.tsx`, then verifies, then commits. The intermediate states after each individual Edit are valid TypeScript; only the final state has the new rail rendering.

**Step 1: Filter the existing `recentListings` query to fixed-price only**

Use the `Edit` tool. Find:

```ts
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .in('status', ['active', 'reserved'])
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<RecentListingRow[]>(),
```

Replace with:

```ts
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .eq('listing_type', 'fixed_price')
      .in('status', ['active', 'reserved'])
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<RecentListingRow[]>(),
```

One added line: `.eq('listing_type', 'fixed_price')`. This is the dedupe mechanism — without it, a freshly created auction would appear in both rails after the new rail lands.

**Behavioral side effect to note:** the `showAvailableNowRail = recentListingsList.length >= 6` threshold at [page.tsx:71](../../src/app/[locale]/page.tsx#L71) now needs 6 fixed-price listings, not 6 of anything. At launch this is a slightly higher bar. No code change required; this is recorded as an intentional consequence of the rail-semantic split.

**Step 2: Add the `endingSoonAuctions` query to the `Promise.all` block**

Use the `Edit` tool. Find the destructuring line:

```ts
  const [{ data: recentListings }, { user, favoriteIds }] = await Promise.all([
```

Replace with:

```ts
  const [{ data: recentListings }, { data: endingSoonAuctions }, { user, favoriteIds }] = await Promise.all([
```

Then find the closing of the recentListings query and the `getUserWithFavorites()` call:

```ts
      .returns<RecentListingRow[]>(),
    getUserWithFavorites(),
  ]);
```

Replace with:

```ts
      .returns<RecentListingRow[]>(),
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .eq('listing_type', 'auction')
      .eq('status', 'active')
      .gt('auction_end_at', new Date().toISOString())
      .order('auction_end_at', { ascending: true })
      .limit(4)
      .returns<RecentListingRow[]>(),
    getUserWithFavorites(),
  ]);
```

Notes:
- `gt('auction_end_at', ...)` is the **primary** filter, not belt-and-braces. The `end-auctions` cron runs every 60s, so without the time predicate a just-expired auction would land at position 1 of the ASC-sorted rail.
- The partial index `idx_listings_auction_end ON listings(auction_end_at) WHERE listing_type = 'auction' AND status = 'active'` (migration 032) matches both the WHERE predicate and the ORDER BY column. Postgres uses an index scan, not a memory sort. `EXPLAIN` on staging confirms this in Task 3.
- Same projection as `recentListings`. `RecentListingRow` reuses cleanly. `ListingCard` consumes `isAuction`, `bidCount`, `auctionEndAt` — all present.

**Step 3: Add the local default for `endingSoonAuctionsList` and extend `getListingCardCounts`**

Use the `Edit` tool. Find:

```ts
  const recentListingsList = recentListings ?? [];

  const { expansionCounts, commentCounts } = await getListingCardCounts(
    supabase,
    recentListingsList.map((l) => l.id)
  );
```

Replace with:

```ts
  const recentListingsList = recentListings ?? [];
  const endingSoonAuctionsList = endingSoonAuctions ?? [];

  const { expansionCounts, commentCounts } = await getListingCardCounts(
    supabase,
    [...recentListingsList, ...endingSoonAuctionsList].map((l) => l.id)
  );
```

Two changes: new `endingSoonAuctionsList` default and spread both arrays into the `.map()` call. The combined id list may contain at most `8 + 4 = 12` ids; `getListingCardCounts` handles this cleanly.

**Step 4: Add the `showEndingSoonRail` guard and render the new section**

Use the `Edit` tool. Find:

```ts
  const showAvailableNowRail = recentListingsList.length >= 6;
  const showCompactSellerProp = !showAvailableNowRail && !IS_PRELAUNCH;
  const showFullSellerProp = showAvailableNowRail && !IS_PRELAUNCH;
```

Replace with:

```ts
  const showEndingSoonRail = endingSoonAuctionsList.length >= 1;
  const showAvailableNowRail = recentListingsList.length >= 6;
  const showCompactSellerProp = !showAvailableNowRail && !IS_PRELAUNCH;
  const showFullSellerProp = showAvailableNowRail && !IS_PRELAUNCH;
```

Then find the JSX block immediately after `<TrustBand />`:

```tsx
      <HomeHero />
      <TrustBand />

      {showAvailableNowRail && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ListingSection
            eyebrow={t('recentlyListed.eyebrow')}
            heading={t('recentlyListed.heading')}
            href="/browse"
            linkText={t('recentlyListed.browseAll')}
            listings={recentListingsList}
```

Replace with:

```tsx
      <HomeHero />
      <TrustBand />

      {showEndingSoonRail && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ListingSection
            eyebrow={t('auctions.eyebrow')}
            heading={t('auctions.heading')}
            href="/browse?auctions=1"
            linkText={t('auctions.browseAll')}
            listings={endingSoonAuctionsList}
            favoriteIds={favoriteIds}
            isAuthenticated={isAuthenticated}
            expansionCounts={expansionCounts}
            commentCounts={commentCounts}
            className="py-8 sm:py-10 lg:py-12"
          />
        </div>
      )}

      {showAvailableNowRail && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ListingSection
            eyebrow={t('recentlyListed.eyebrow')}
            heading={t('recentlyListed.heading')}
            href="/browse"
            linkText={t('recentlyListed.browseAll')}
            listings={recentListingsList}
```

Identical wrapper, padding, and props pattern as the existing rail directly below. The href deliberately includes the `?auctions=1` query string — browse already filters to `listing_type = 'auction'` when this param is present.

**Step 5: Run `pnpm verify` (the project's merge gate)**

Run: `pnpm verify`

This runs `type-check && lint && test && build`. All four must pass.

Expected: passes.

Common failure modes to watch for:
- **`next-intl` key not found** for `auctions.eyebrow` etc. → Task 1 was not committed or the key path is wrong. Verify `home.auctions.eyebrow` exists in `en.json`.
- **Destructuring mismatch** → triple-check the `Promise.all` order matches the destructuring order: `[recentListings, endingSoonAuctions, user/favorites]`.
- **Lint error on unused import** → unlikely since no imports added or removed.
- **Build failure** → likely a real bug. Read the trace, do not skip.

**Step 6: Commit**

```bash
git add src/app/\[locale\]/page.tsx
git commit -m "feat(home): add 'Auctions ending soon' rail above recently listed"
```

No Co-Authored-By trailer.

---

## Task 3: Pre-merge verification — Cloudflare cache rule for `/`

**Files:** None (verification only)

**Step 1: Inspect the Cloudflare cache rules for the homepage**

Open the Cloudflare dashboard for the `secondturn.games` zone → Caching → Cache Rules. Look for rules matching `/`, `/en`, `/lv`, `/lt`, `/et`, or the root path generally.

Per memory `cloudflare_cache_rules_stacking.md`: rules do not first-match-win in the way one might expect. Verify the actual TTL applied to `/` by checking which rule's expression evaluates true for the homepage URL.

**Step 2: Decide**

Two outcomes:

- **No edge TTL or zero-TTL bypass:** The `auction_end_at` anchor is fresh per request. Countdown is correct from hydration. Record "CF cache: `/` bypassed" in PR description.
- **Non-trivial edge TTL exists:** Compounded stale window is `edge_TTL + 60s` (60s = `end-auctions` cron interval). `AuctionCountdown` handles this gracefully ([src/components/auctions/AuctionCountdown.tsx:33](../../src/components/auctions/AuctionCountdown.tsx#L33) — `timeLeft.totalSeconds <= 0` renders "Ended"). Either (a) tighten the CF rule for the homepage now, or (b) accept the bounded staleness and record the decision in the PR.

**Step 3: Record finding**

Append to scratch notes for the PR description. No commit.

---

## Task 4: Pre-merge verification — `EXPLAIN` on staging

**Files:** None (verification only)

**Step 1: Run `EXPLAIN ANALYZE` against the staging Supabase database**

Connect via the Supabase SQL editor on the staging project. Run:

```sql
EXPLAIN ANALYZE
SELECT id, game_name, game_year, condition, price_cents, previous_price_cents,
       price_changed_at, photos, country, status, listing_type, bid_count,
       auction_end_at, version_thumbnail
  FROM listings
 WHERE listing_type = 'auction'
   AND status = 'active'
   AND auction_end_at > NOW()
 ORDER BY auction_end_at ASC
 LIMIT 4;
```

**Step 2: Verify the plan**

Expected: `Index Scan using idx_listings_auction_end` (the partial index from migration 032). The ASC sort should be satisfied by the index, not a separate `Sort` node.

If a `Sort` node appears: investigate. Either the index was not selected (statistics may need `ANALYZE listings`) or the index shape does not match the query (would be surprising; design doc verified the predicate match).

**Step 3: Record finding**

Append to scratch notes for the PR description ("query plan: index scan via `idx_listings_auction_end`, no memory sort").

---

## Task 5: Manual smoke test

**Files:** None

**Step 1: Start the dev server**

Run: `pnpm dev`

Expected: `localhost:3000` ready.

**Step 2: Verify the homepage**

Open `http://localhost:3000/en` (or `/`).

Verify:
- The "Going, going…" eyebrow + "Auctions ending soon" heading + "See all auctions" link appear above the "On the shelves" / "Recently listed" rail.
- Auction cards in the new rail show the gavel countdown overlay.
- The countdown ticks (every 1s when <1h remaining, every 60s otherwise).
- A test auction (if one exists in dev data) does **not** appear in the Recently Listed rail below.

**Step 3: Verify the "See all auctions" link**

Click "See all auctions". Verify the destination is `/browse?auctions=1` and that the browse page filters to auctions only.

**Step 4: Verify zero-auctions case**

Either temporarily expire all active auctions in dev data, or visually confirm the rail does not render when no auctions exist. The wrapper `<div className="max-w-7xl ...">` must not render — there should be no orphan whitespace between `<TrustBand />` and the Recently Listed rail.

**Step 5: Verify sparse case (1 card on desktop)**

If only one active auction exists in dev data, the rail will show 1 card in column 1 with the remaining 3 columns blank at the `lg` breakpoint. This is intentional per the design doc but the PR description must call it out.

**Step 6: Record findings**

Append observations to PR description scratch notes. No commit.

---

## Task 6: Open the PR

**Files:** None (already pushed during Task 1 and Task 2 commits — but actually only the design-doc commit was pushed at `feature/homepage-auctions-rail` setup time; the new commits need pushing first).

**Step 1: Push the new commits**

Run:

```bash
git push
```

Expected: pushes Task 1 + Task 2 commits to `origin/feature/homepage-auctions-rail`.

**Step 2: Open the PR**

Run:

```bash
gh pr create --title "feat(home): auctions rail above recently listed" --body "$(cat <<'EOF'
## Summary

Adds an "Auctions ending soon" rail to the homepage above the existing "Recently listed" rail, with a "See all auctions" link to `/browse?auctions=1`. Two distinct lanes: auctions above (urgency framing, sort by `auction_end_at` ASC, top 4), fixed-price below.

Design doc: `docs/plans/2026-05-29-homepage-auctions-rail-design.md`.

## Behavioral changes called out

1. **Recently listed becomes `listing_type = 'fixed_price'` only.** Deliberate semantic split: two lanes on the homepage. Wanted listings unaffected (separate table). Side effect: the existing `showAvailableNowRail` threshold (`>= 6`) now needs 6 fixed-price listings specifically, slightly higher bar at launch than the prior "6 of anything" rule.
2. **Sparse-row trade-off at low counts is intentional.** Render threshold is `>= 1` active auction. At 1 card on desktop, columns 2-4 are blank. This is the cost of marketing-discovery visibility, not a layout bug.
3. **Countdown anchor staleness is bounded.** Compounded stale window is `cf_edge_ttl + 60s` (`end-auctions` cron interval). `AuctionCountdown` renders "Ended" gracefully at `totalSeconds <= 0`. See Cloudflare cache verification below.
4. **`ListingType` enum verified as `'fixed_price' | 'auction'`.** Used `'fixed_price'` in the Recently Listed filter, not `'item'`.

## Pre-merge verifications

- [ ] Cloudflare cache rule for `/` (and `/en|/lv|/lt|/et`) — TTL composition for the countdown anchor. Decision recorded: …
- [ ] `EXPLAIN ANALYZE` on staging confirming `idx_listings_auction_end` partial index is selected, ASC sort is index-scanned (no memory sort).
- [ ] Humanizer review of user-facing copy ("Going, going…" / "Auctions ending soon" / "See all auctions"). Fallback eyebrow if "Going, going…" reads too cute on review: "On the block".

## Test plan

No automated test added. The project has no Server Component page-render test infrastructure, and CLAUDE.md's "test pure business logic, no mocking" convention rules out fabricating a render harness for two file changes. Verification path:

- [ ] `pnpm verify` (type-check + lint + test + build) passes locally.
- [ ] Manual smoke on `pnpm dev`: homepage renders both rails correctly, "See all auctions" link goes to `/browse?auctions=1`, auctions do not appear in Recently Listed, countdown ticks on auction cards.
- [ ] Zero-auctions case: rail hidden, no orphan whitespace.
- [ ] Sparse case (1 auction): rail visible, 3 desktop columns blank as expected.

## Files touched

- `src/app/[locale]/page.tsx` — second Supabase query for `endingSoonAuctions`, conditional render block above Recently Listed, `.eq('listing_type', 'fixed_price')` added to the existing `recentListings` query, `getListingCardCounts` extended.
- `src/messages/en.json` — three new keys under `home.auctions`.
EOF
)"
```

Expected: PR URL printed. Report the URL.

---

## Out of scope (do not implement)

These were considered in the design doc and explicitly excluded. Do not add them as part of this PR:

- New analytics event. `listing_viewed` already fires on card click. A future `source` property on `listing_viewed` would enable rail comparison, but per the project's `AnalyticsEventMap` convention it is a typed event change, not a one-liner. Deferred.
- New index migration. The partial index from migration 032 covers the query.
- `ListingCardMini` or other compressed card variant for this rail. The card-rhythm parity with Recently Listed below is the design intent.
- Empty-state evergreen card at zero auctions. The marketing intent only activates when the feature is live.
- Homepage tile A/B test.
- Latvian / Lithuanian / Estonian translations. Only `en.json` exists today; lv/lt/et files have not landed, so there is no stub work for this PR. When those files land wholesale, `home.auctions` joins the add.

---

## Skill references

- @superpowers:executing-plans — execute this plan task-by-task.
- @superpowers:verification-before-completion — required before claiming tasks complete.
- @superpowers:requesting-code-review — before merging.
- @humanizer — for the user-facing copy review at the PR stage.
