# Cart cross-sell: "More from {seller}"

**Status:** design validated, not yet implemented
**Date:** 2026-05-29
**Touches:** cart page, `/api/cart/validate`, cart-types, analytics, ListingCardMini

## Goal

When a cart contains a seller's item, surface that seller's other active fixed-price listings inside the same seller card. Drives basket size and gives the per-seller shipping cost a clearer payoff narrative ("if you're already paying their shipping, here's what else they have").

## Scope

- Per-seller strip rendered inside each `<Card>` in `src/app/[locale]/cart/page.tsx`, positioned after the Subtotal + Checkout footer row (last thing in the card).
- Horizontal-scroll row, up to 8 thumbnails. Each thumb links to `/listings/{id}` — no inline "add to cart" in v1.
- Only `status = 'active'` listings with `listing_type = 'regular'`. Auctions and wanted listings excluded.
- Excludes listings already present in the cart for **that same seller**. Other sellers' cart items are not excluded — different seller's universe.
- Strip renders only when the seller has ≥1 eligible other listing. Zero eligible → section omits cleanly.

## UX

### Placement

Below the seller card's footer row (subtotal + Checkout button). Narrative framing wins for v1 — strip sits right after "here's what this bundle costs," reading as "and here's how to make it pay off more."

Known tradeoff: on mobile, the strip competes with "scroll to next seller card" because it sits below the primary CTA. Mitigation is purely visual — small muted label (not a heading), no top border, tighter top padding than between major sections. If post-launch PostHog data shows users not engaging with the strip, revisit by promoting it above the footer.

### Layout

Always `overflow-x-auto snap-x snap-mandatory` regardless of item count. The peek/affordance (partial-next-thumb visible at the right edge) emerges as a CSS consequence of count ≥ 4 exceeding viewport width — no JS branching, no tier-based special-casing. Renders valid at every viewport from 320px up.

`scrollbar-hide` utility: project Tailwind does not include `tailwind-scrollbar-hide`. Add a small custom utility either via a `globals.css` rule or inline arbitrary classes (`[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`). Trivial to land alongside the strip.

Per-thumb width: `w-[160px] sm:w-[180px] shrink-0 snap-start`. Confirm against mobile pass.

### Component

Reuse `ListingCardMini` from `src/components/listings/ListingCardMini.tsx`. Its existing props (`id`, `gameTitle`, `gameThumbnail`, `firstPhoto`, `condition`, `priceCents`, `expansionCount`) match the `CartSuggestion` shape exactly, it already links to `/listings/{id}`, and it carries a square image — natural fit for a horizontal-scroll strip. No new thumb component.

### Copy

Header label and conditional secondary line, gated on buyer country (which is already loaded on the cart page via `useAuth().profile.country`):

| Buyer state | Label | Secondary line |
|---|---|---|
| `country ∈ {LV, LT, EE}` | More from {seller} | Shipping is usually included when sellers ship together. |
| `country` known, non-Baltic | More from {seller} | — |
| Signed-out (`country === null`) | More from {seller} | — |

The "usually" carries the parcel-physics caveat (Unisend lockers have per-parcel weight/size limits, but listings carry no parcel-dimension data — so we can't compute remaining capacity in v1). It softens the claim without leaning on a mid-sentence qualifier.

### Semantics and accessibility

- Label uses `<p className="text-sm text-semantic-text-secondary">`, not a heading. The seller card has no formal heading currently (uses `UserIdentity`), so adding an `<h3>` here would skip `<h2>` — best avoided. Screen reader users still get structure via the next bullet.
- Strip container is `<ul role="list" aria-label="More from {sellerName}">`. Each thumb is a `<li>`. The `aria-label` carries the seller's name so screen readers don't need the visible label for context.

## Data layer

### Endpoint

Extend the existing `POST /api/cart/validate` rather than adding a dedicated route. The validate call already loads cart listings, derives sellers, and returns seller profiles in one round-trip. Adding suggestions composes with that — no second fetch, no client-side waterfall, no new `useEffect`.

Endpoint naming flag for future PR: post-extension, `validate` is mildly misleading. If a third concern lands here (recommended bundle pricing, cross-seller bundling), rename to `/api/cart/state` or `/api/cart/load` at that point. Not worth the churn now.

### Types

Extend `CartValidationResult` in `src/lib/checkout/cart-types.ts`:

```ts
export interface CartSuggestion {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
  expansionCount: number;
}

export interface CartValidationResult {
  // ... existing fields ...
  suggestions: Record<string, CartSuggestion[]>;  // keyed by sellerId
}
```

### Query per seller

```ts
.from('listings')
.select(`
  id,
  game_name,
  price_cents,
  condition,
  expansion_count,
  first_photo_url,
  games ( thumbnail_url )
`)
.eq('seller_id', sellerId)
.eq('status', 'active')
.eq('listing_type', 'regular')
.not('id', 'in', `(${cartListingIdsFromThisSeller.join(',')})`)
.order('created_at', { ascending: false })
.limit(8)
```

(Column names above are illustrative — confirm against current listings schema before implementation.)

**Load-bearing comment.** The `.not('id', 'in', ...)` clause is **not** defensive. Cart items keep `status = 'active'` until the cart-create payment-intent route flips them to `reserved` at checkout-create (see `src/app/api/payments/cart-create/route.ts:254`). Without the explicit exclusion, a user's own cart items would surface in their suggestion strip. Inline comment in the query body must say this, so a future "drop the redundant filter" cleanup doesn't silently regress.

**Empty-array guard.** PostgREST rejects `not.in.()`. Apply the filter conditionally — every seller in the cart has ≥1 cart item, so this is purely defensive against a malformed call path.

### Fan-out cap

First **5 sellers** in cart-display order get suggestion queries. Sellers ranked 6+ render their card normally but with no suggestion strip. Cart-display order = the order `listingIds` arrives in (mirrors cart insertion order). Predictable, explainable — no ranking-by-group-size tiebreaker.

Cap is a DoS guard, not a UX feature. v1 carts in practice have 1-2 sellers; the cap exists to bound worst-case query count from a malformed or malicious cart.

### Error isolation

In the route handler:

1. Validation block (existing) and suggestions block (new) sit in **separate try/catch frames**. Suggestions failure never leaks into validation response — the rest of cart functionality is unaffected by an upstream Postgres hiccup on the suggestions path.
2. Per-seller queries dispatch via `Promise.allSettled`, **not** `Promise.all`. Fulfilled results merge into the response map; rejected entries are dropped (that seller's strip silently omits) and logged to Sentry with `{ sellerId, error }` context.
3. Sentry context survives the project's PII scrubber — `src/lib/sentry/strip-pii.ts` only touches `event.user` and `event.request`. UUIDs in `extra` are intact.

### RLS

`listings` already carries a public-readable SELECT policy for `status = 'active'` rows (powers browse, listing detail, seller pages — all anon-reachable). The validate route uses the user's SSR client (which becomes the anon client when signed-out), same path the listing detail page uses. No service-role bypass needed.

**Regression-prone surface:** the `games` join. CLAUDE.md documents two prior advisor-driven RLS regressions on anon-reachable paths (games search, listing detail seller info). Before merge, run an anon smoke check (curl with no cookies) and confirm `games.thumbnail_url` comes back populated — a tightened `games` policy would null this without erroring.

### Result handling on client

Merges into the existing `setSellerProfiles` reducer in the cart page's mount-time `useEffect`. Same `validating` spinner, same `.catch(() => {})` silent-failure pattern. Strip renders only after the validate fetch resolves — no flash of empty-then-populated.

Acceptable v1 tradeoff: if validate takes 800ms, the strip waits 800ms even though its query likely resolved at 200ms. Note in PR description. If perceived-perf complaints surface, split routes.

## Implementation structure (testability)

To honor the "pure business logic, no mocking" CLAUDE.md convention without standing up an integration harness, the implementation must be split:

```
src/lib/cart/suggestions.ts          (pure, unit-testable)
  └─ buildSuggestionsMap(sellerIds, fetchOne) → Record<sellerId, CartSuggestion[]>
     Handles:
       - first-5 cap (sliceing input array)
       - Promise.allSettled dispatch
       - fulfilled/rejected partition
       - logSentry on each rejection
       - shape final map

src/app/api/cart/validate/route.ts   (thin wrapper)
  └─ derives sellerIds from cart listings (existing logic)
  └─ injects a real-supabase-bound query fn into buildSuggestionsMap
  └─ wraps the call in its own try/catch
```

Unit tests target `buildSuggestionsMap` with a fake `fetchOne`. No supabase mocking, no integration harness. Route handler stays a thin orchestrator.

## Analytics

Both events ship in v1. Without the impression event, click-through rate can't be computed, and the deferred-ranking decision in §"Out of scope" loses its supporting signal.

Register in `AnalyticsEventMap` in `src/lib/analytics/types.ts`:

```ts
cart_suggestion_strip_viewed: { seller_id: string; count: number };
cart_suggestion_clicked: { seller_id: string; listing_id: string; position: number };
```

- **`cart_suggestion_strip_viewed`** — fires once per strip per page-load via IntersectionObserver at 0.5 threshold. `count` is the rendered thumb count (≤ 8).
- **`cart_suggestion_clicked`** — fires on thumb click, `position` is **0-indexed**, before navigation.

**Click event flush.** PostHog batches captures. A fire-and-forget call right before a Next.js client-side nav may not flush before the cart page unmounts. Pass `{ send_instantly: true }` (or the equivalent in the analytics wrapper — confirm during implementation) to force immediate send. If that option isn't available in the wrapper, accept some click-event loss as a known v1 limitation and document it in the PR body so funnel data isn't read as ground truth from day one.

## Testing

### Unit (vitest, against pure `buildSuggestionsMap`)

- `Promise.allSettled` fan-out partitions correctly: returns `suggestions = {}` when every `fetchOne` rejects.
- Per-seller rejection logged via injected logger spy.
- First-5 cap applied: 7 seller IDs in → 5 `fetchOne` invocations.
- Cap preserves input order: input `[a,b,c,d,e,f,g]` produces calls on exactly `[a,b,c,d,e]`.

### Manual verification (PR description checklist)

- **Anon smoke check (RLS).** `curl -X POST /api/cart/validate -H 'Content-Type: application/json' -d '{"listingIds":["<active-listing-id>"]}'` with no auth cookies. Assert `suggestions[<sellerId>][0].gameThumbnail` is non-null.
- **Signed-in non-Baltic user.** Buyer with `country` set to a non-Baltic value confirms the secondary "Shipping is usually included…" line is suppressed.
- **Layout matrix:** 320px, 375px, 768px, 1280px viewports × {1-item, 3-item, 8-item, 0-item} strips.
- **Cart-mutation refresh cycle:** remove the last item from a seller mid-session. Seller card *and* its suggestion strip both disappear without flicker.
- **Click-through path:** tap a suggestion, confirm `/listings/{id}` loads, click back returns to cart with state intact.
- **Stale-listing path:** open cart in tab A, sell the suggested listing from another session, click the suggestion in tab A — confirm `src/app/[locale]/listings/[id]/page.tsx`'s existing "It may have been sold or removed" rendering (line 247 onward) handles the case.
- **PostHog event capture:** verify `cart_suggestion_strip_viewed` fires on scroll-into-view and `cart_suggestion_clicked` fires + flushes before navigation.

## Out of scope (deferred)

- Ranking beyond newest-first. v2 candidate, gated on impression + click PostHog data showing scroll-depth ≥ position 4.
- "See all from seller" link below the strip. Seller name in card header already navigates to `/sellers/{id}`.
- Inline add-to-cart from the strip. v1 is "navigate to detail page" only.
- Auctions / wanted listings in suggestions. Bundling story breaks for auctions; wanted listings are inverse intent.
- Parcel-capacity gating. Listings carry no parcel-dimension data — would require schema change.
- Endpoint rename `/api/cart/validate` → `/api/cart/state`. Defer until a third concern lands on the route.

## Open notes for PR description

- `.not('id', 'in', ...)` is load-bearing — inline comment explains why so future readers don't strip it.
- Validate-route latency now gates strip render. Acceptable v1; revisit by splitting routes if perceived perf becomes a complaint.
- Endpoint naming is mildly misleading post-PR — flagged but not addressed.
- Click-event flush behavior (PostHog) — note v1 limitation if `send_instantly` isn't available.
- `scrollbar-hide` utility added as part of this PR (project Tailwind had no plugin for it).
