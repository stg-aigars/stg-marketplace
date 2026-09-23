# Feature proposals: buyers and sellers

**Status:** proposal, nothing implemented
**Date:** 2026-09-23
**Method:** read through every route, `src/lib/` module, the migrations and the earlier `docs/plans/`, then ran read-only aggregate queries on production (counts only, no personal data) to decide what matters most.

---

## 1. Where the marketplace stands (production, 23.09.2026)

| Signal | Number | What it tells us |
|---|---|---|
| Users / sellers ever / buyers | 168 / 55 / 43 | Small, engaged core |
| Users with no listing, order, or wanted post | **76 (45%)** | Almost half of signups never do anything |
| Active listings | 307 from 44 sellers | Top seller has 53. Supply is concentrated |
| Active listings older than 90 days | **182 (59%)** | Inventory is going stale |
| New listings per month | May 154, Jun 152, Jul 45, Aug 71, **Sep 20** (to date) | Listing activity has dropped a lot since launch |
| Orders | 65 (61 completed), 12 repeat buyers | Buyers who come back make up about 28% of buyers |
| Cross-border orders | **47 of 65 (72%)** | Shipping cost is part of almost every purchase |
| Orders with 2+ items | 12 of 65 (18%) | Buyers sometimes combine items |
| Active wanted posts | **82 from 29 users** | Clear, stated demand… |
| …of which have a matching active listing | **1** | …and almost none of it is being supplied |
| Favourites on active, unsold listings | 116 on 76 listings | Interested buyers who never get a follow-up |
| Declining-price listings | 96 of 447 (21%) | Sellers use pricing tools when we give them |
| Reviews | 40, **all positive** | A thumbs-up/down review no longer tells buyers much |
| Listing comments | 4 total | Public Q&A is barely used, so don't invest there |

Things already in place that these ideas build on: wanted-listing match and price-drop notifications (`src/lib/listings/actions.ts`), the price-drop tracking columns (migration 122), declining-price listings, the pricing assistant (`src/lib/pricing/suggestions.ts`), the "More from {seller}" cart cross-sell, the message digest cron, the onboarding checklist, PostHog analytics, and the notification + email infrastructure.

**What was tried before and should not come back as it was.** Seller Shelves and structured Offers were built and then removed in migration 076 ("insufficient user engagement"). Listing comments sit at 4. What these have in common: they asked users to do extra work up front for a benefit that might never arrive. The proposals below go the other way. Each one uses a signal users **have already given us** (a favourite, a wanted post, a view, a completed order) and turns it into a sale.

---

## 2. Summary: top picks

| # | Feature | For | Effort | Why now |
|---|---|---|---|---|
| 1 | Alerts for saved listings | Buyers → sales | S | 116 favourites currently lead to nothing |
| 2 | Wanted → sell pipeline | Sellers | S–M | 82 wanted posts, 1 match |
| 3 | Listing insights + stale-listing nudges | Sellers | M | 59% of inventory is older than 90 days |
| 4 | Game pages with sold-price history | Both + SEO | M | Browse already groups by game; no page exists yet |
| 5 | BGG import: wishlist → wanted, collection → "what's it worth" | Both, activation | M–L | 45% of users are inactive; new listings are falling |
| 6 | Objective trust stats (ship speed, response time) + review tags | Buyers | S–M | Reviews are 100% positive, so they don't tell buyers apart |
| 7 | Better browse: condition, price range, sort by delivered price | Buyers | S | 72% of orders are cross-border |
| 8 | Saved searches / "Alert me" | Buyers | M | Covers vague intent that a wanted post can't |
| 9 | Multi-buy discount set by the seller | Both | M (payment flow) | Increases items per order on top of cross-sell |
| 10 | Away mode, relist, listing drafts | Sellers | S each | Quality-of-life for sellers |

Effort: S ≈ 1–3 days, M ≈ 1–2 weeks, L ≈ 2+ weeks.

---

## 3. Detailed proposals

### 3.1 Alerts for saved listings (favourites that do something)

**Problem.** A favourite today is just a bookmark. When the seller cuts the price or a declining listing drops a step, only *wanted* posts are notified. The 116 buyers who saved a specific copy hear nothing.

**Feature.**
- Notify people who saved a listing when:
  - its price drops (manual fixed-price drop **or** a declining step)
  - a declining listing reaches its floor price ("lowest it will go")
  - optionally, someone else adds it to their cart, as a softly worded "In someone's cart right now" message. This is optional and needs a careful tone check.
- Seller side: show "Saved by N people" on `/account/listings` and on the owner view of the listing. The count is anonymous and gives sellers a reason to drop the price.
- Bundle alerts into a daily digest if a user has many saved listings, reusing the `message-digest` two-pass pattern.

**Implementation sketch.**
- Hook into the same code paths as `notifyWantedListingPriceDropped` (`src/lib/listings/actions.ts`) and the `apply-price-drops` cron.
- New notification types `favorite.price_dropped`, `favorite.floor_reached`. Per the CLAUDE.md rule, a new `favorite.` prefix needs a **paired migration updating `notifications_type_check`**.
- Remove duplicates per (user, listing, price) the same way the wanted price-drop flow does.
- PostHog: `favorite_alert_sent`, then conversion via `order_completed` with `source=favorite_alert`.

**Success metric.** Share of favourited listings that sell within 14 days of an alert.

---

### 3.2 Wanted → sell pipeline

**Problem.** 29 buyers have posted 82 active wants, and only 1 has matching supply. The "List this game for sale" button on `/wanted/[id]` goes to a blank `/sell`, and sellers never see demand while they're listing.

**Feature.**
1. **Pre-filled sell flow.** Accept `/sell?game=<bggId>` (plus the edition language from the wanted post if there is one) so the seller starts past the game-search step. Update the wanted detail page and the wanted notification emails to link to it.
2. **"Wanted by N buyers" nudge** on the game-selection step of `/sell` and in the pricing assistant: "2 buyers are looking for this, 1 prefers the Latvian edition."
3. **Optional "I'd pay up to €X"** on wanted posts (`max_price_cents`, integer cents). Show it to sellers as a price anchor, and use it in match notifications ("A copy was listed at €24, within your €30 budget").
4. **"Can you help?" wanted feed for sellers.** On `/account/listings`, and in a monthly email to active sellers, list the most-wanted games. Sellers often own a second copy they haven't thought of listing.
5. **Keep demand current.** Ask "Still looking?" once a wanted post is 60 days old; auto-archive after 90 days with no response. This keeps the counts in step 2 honest.

**Implementation sketch.** Step 1 only touches the frontend (`SellPageClient` / `GameSearchStep` reading the search param, reusing `buildEnrichedGame`). Step 3 is a one-column migration on `wanted_listings`. Step 5 is a daily cron route following the existing cron pattern.

**Success metric.** Share of wanted posts that end in a purchase; listings created from `/sell?game=`.

---

### 3.3 Seller listing insights + stale-listing nudges

**Problem.** 182 listings are older than 90 days. Sellers have no idea whether anyone is looking at them, so they can't tell whether the problem is price, photos, or demand.

**Feature.**
- **Per-listing stats** on `/account/listings`: views (7d / total), saves, wanted matches, days listed, and the price compared with the marketplace median / retail from the existing pricing-suggestion data.
- **A health label** per listing: "Getting attention", "Priced above similar copies", "No views in 14 days".
- **Nudges at 45 and 90 days** (email + in-app): the listing's stats and one-click actions. "Drop price by 10%", "Switch to declining price" (the conversion action already exists: `convertListingToDeclining`), "Add more photos". The existing price-drop machinery then notifies wanted posts and savers automatically, so each nudge that leads to a price cut also brings back interested buyers.

**Implementation sketch.**
- View counting: a small `listing_view_daily(listing_id, day, views)` table with no personal data, incremented through a `SECURITY DEFINER` RPC from the listing detail page. Skip owner views, rate-limit per request. Alternative: query PostHog's `listing_viewed` server-side. Simpler to set up, but it adds an external dependency to a page sellers look at every day.
- Nudge cron: `listing-nudges` (daily), idempotent through a `last_nudged_at` / `nudge_stage` column.

**Success metric.** Sell-through of listings older than 90 days; number of price actions taken from nudges.

---

### 3.4 Game pages with sold-price history

**Problem.** There's no `/games/[id]` route. Browse already groups results by game, but buyers can't see "all copies of *Cascadia*, what it usually sells for, and whether anyone wants it". The search engine visibility of a 170k-game catalogue is going unused.

**Feature.** `/games/[bggId]`:
- Game identity (BGG image, year, players, weight, `GameTitle` in Fraunces)
- All active copies, sortable by delivered price to the viewer's country
- **Recent sold prices**: median and range of completed sales, shown only once there are ≥ `MIN_SALES_FOR_MEDIAN` (3) sales so no individual sale can be identified
- Wanted count + a one-click "Tell me when one is listed", which creates a wanted post and makes wanted-post creation much easier
- "Sell yours" CTA → `/sell?game=<bggId>` (see 3.2)
- JSON-LD `Product` + `AggregateOffer`; only index games with at least one active or past listing so we don't flood the index with empty pages

This page is also where a public **"What's my game worth?"** tool (search a game → price range) would sit, which is a seller acquisition channel on its own.

**Success metric.** Organic landings on game pages; wanted posts created from "Tell me when".

---

### 3.5 BGG import: wishlist → wanted, collection → "what's it worth"

**Problem.** 45% of users never act. Listing is the heaviest thing we ask of anyone, and new listings are down 87% from June. Shelves tried BGG import before, but aimed it at a *public showcase*, which nobody used.

**Feature (import is private and aimed at a specific goal, with no public shelf).**
- **Buyers: "Import my BGG wishlist".** Enter a BGG username → preview the wishlist → create wanted posts in bulk. One step turns an inactive signup into a user who receives match alerts.
- **Sellers: "What's in my collection worth here?"** Enter a BGG username → a private report: which owned games have active wanted posts, recent sold prices, and suggested prices. Pick games → start listing drafts (see 3.10) with game and edition pre-filled.
- Nothing is stored beyond the user's choices. The BGG username is optional to save (the column was dropped in 076, so re-adding it is a decision to make).

**Implementation sketch.** The 202→200 polling design and matching logic in `docs/bgg-collection-import-tasks.md` can be reused almost as-is. Only where the result goes changes (wanted posts / drafts instead of `shelf_items`). BGG calls stay server-side.

**Success metric.** Signup→first-action activation; listings created from the collection report.

---

### 3.6 Objective trust stats + review tags

**Problem.** 40 reviews, 100% positive. The thumbs-up/down system can no longer tell a good seller from an average one, and new sellers with 0 reviews look the same as sellers with no record at all.

**Feature.**
- **Stats computed from order timestamps** (no user input needed), shown on the seller profile and listing detail:
  - "Usually ships within 1 day" (median accepted→shipped)
  - "Replies within a few hours" (median first-response time on listing messages)
  - "Accepts 98% of orders"
  - Only shown once there are ≥3 data points
- **Optional review tags** on the existing review form: *Packed carefully*, *Condition as described*, *Quick to ship*, *Friendly communication*. Show aggregated tag counts on the seller profile.
- **Seller reply** to a review (one reply, no editing, same model as comments).

**Implementation sketch.** The stats come from a nightly aggregate on `user_profiles` (the same shape as the `trader-signals` / `dac7-reconcile` counters) so public pages stay fast and read through `public_profiles`. Watch the anonymous-access RLS rules in CLAUDE.md: expose only the computed numbers through the definer view.

---

### 3.7 Browse improvements

**Problem.** `BrowseFilters` has no **condition** or **price range** filter, even though the Week 3 plan listed both. With 72% of orders cross-border, the price that matters is *item + shipping to me*, and browse can't sort by it.

**Feature.**
- Condition filter (multi-select, using `conditionConfig` icons)
- Price range (min/max in €, stored as cents in the URL)
- **"Delivered price" display and sort** for signed-in users with a known country, using `getShippingPriceCents(sellerCountry, buyerCountry)` already used on listing detail
- "Ships from my country" quick toggle (local pickup already has one)

**Effort.** Small. The filter parsing lives in `src/lib/listings/filters.ts` with tests next to it. Delivered-price sort needs the route-based shipping price in the query (a small SQL `CASE` on the seller's country, since the price matrix is 3×3).

---

### 3.8 Saved searches ("Alert me about new matches")

**Problem.** Wanted posts cover "I want *this* game". Many buyers want "any 2-player game under €25 shipped to LV" or "anything heavy in English". Right now they have to check back by hand.

**Feature.** A "Save this search" button on `/browse` stores the current filter set. New matching listings go out in a daily digest (email + in-app). Managed from `/account` next to wanted posts.

**Implementation sketch.** `saved_searches(user_id, filters jsonb, last_notified_at)`. A daily cron runs each search against listings created since `last_notified_at`, reusing `parseFiltersFromParams` so saved and live searches behave the same. Cap at 10 per user. Needs a new `search.` notification prefix and a paired CHECK migration.

---

### 3.9 Multi-buy discount set by the seller

**Problem.** 18% of orders have more than one item. The cart cross-sell shows more items from the same seller but gives buyers no reason to add them beyond shared shipping.

**Feature.** A seller setting: "10% off when buying 2+ of my games" (fixed tiers: 5/10/15%). Shown on the seller profile, the listing detail ("Save 10% when you add another game from Anna"), and in the cart seller card.

**Caution — this touches the payment flow.** The discount changes `item_value_cents`, and with it commission (10% of the discounted item price), the invoice lines, the O.x GL payloads, and the DAC7 totals. The cleanest option is a per-item discounted price computed at cart validation and frozen on `order_items`, so every later step sees a plain price. Per CLAUDE.md this **needs sign-off before implementation**, and probably a check with the accountant that invoices don't need a separate discount line.

---

### 3.10 Smaller seller improvements

- **Away mode.** "I'm away until 12.10": hides listings from browse (or marks them "Ships after 12.10") and blocks new orders, so the 48h accept deadline doesn't auto-cancel orders. Lives on `user_profiles`; the listing queries add one predicate.
- **Relist / duplicate.** On a sold or removed listing, "List another copy" pre-fills the game, edition, and description and only asks for photos and condition.
- **Listing drafts.** Save a half-finished listing and resume it. Needed for the collection flow in 3.5, and helps anyone listing on a phone who needs to go and take photos. `listings.status = 'draft'` is the tempting shortcut, but every browse/RLS query would need to exclude it. A separate `listing_drafts` table is safer.
- **Removal reason reporting.** `removal_reason` (migration 136) is null on all 58 cancelled listings. Either the column shipped after those removals, or the prompt is skipped. Worth checking before building anything that depends on that data.

---

## 4. Explicitly not recommended (for now)

- **Bringing back Offers / Shelves.** Removed for low engagement. The price-signal need is better met by wanted `max_price` (3.2) + saves (3.1) + declining price, which need no back-and-forth between buyer and seller.
- **Game trades/swaps.** Board gamers love them, but trades don't fit escrow, commission, invoicing, or the GL model. If there's demand, run a one-off community "math trade" event by hand first.
- **Referral credits paid into the wallet.** Wallet credits have GL, VAT, and DAC7 consequences. Revisit after the accounting cutover settles.
- **More investment in public listing Q&A.** 4 comments in total; messaging (124 listing messages) is where conversations actually happen.

---

## 5. Suggested order

| Phase | Contents | Rough size |
|---|---|---|
| **1 — Quick wins** (≈2 weeks) | 3.1 saved-listing alerts · 3.2 steps 1–2 (pre-filled sell, "wanted by N") · 3.7 condition + price filters · 3.10 relist | Mostly frontend + one CHECK migration |
| **2 — Seller help** (≈2–3 weeks) | 3.3 view counts, insights, nudges · 3.2 steps 3–5 (max price, wanted feed, still-looking check) · 3.6 trust stats | 2–3 migrations, 2 cron routes |
| **3 — Discovery** (≈3 weeks) | 3.4 game pages + price history · 3.7 delivered-price sort · 3.8 saved searches | New route, SEO, 1 cron |
| **4 — Activation** (≈3 weeks) | 3.5 BGG wishlist/collection import · 3.10 drafts + away mode · 3.6 review tags | Reuses the old import design |
| **Later, needs sign-off** | 3.9 multi-buy discount | Payment / invoicing / GL review |

Phase 1 doesn't depend on anything else. Each later phase benefits from the one before: nudges (3.3) fire the alerts from 3.1, and game pages (3.4) link to the sell flow pre-filled from 3.2.

## 6. Process notes

- Every item that adds a migration is a schema change. Per CLAUDE.md, confirm before implementing, and check whether the RLS policy is reachable anonymously (game pages and seller trust stats both are).
- Each new notification prefix (`favorite.`, `search.`, maybe `listing.nudge`) must ship with its `notifications_type_check` migration in the same PR.
- New audit events (e.g. a seller setting a multi-buy discount) must be added to the CLAUDE.md event register with their retention class.
- Measure every feature with a typed PostHog event added to `AnalyticsEventMap`, and set its success metric **before** building it. Shelves showed that engagement can't be assumed.
