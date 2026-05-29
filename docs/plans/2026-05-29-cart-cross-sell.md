# Cart cross-sell ("More from {seller}") Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "More from {seller}" horizontal strip inside each seller card on the cart page, surfacing that seller's other active fixed-price listings with copy framing shipping consolidation.

**Architecture:** Extend the existing `POST /api/cart/validate` endpoint to also return per-seller suggestions. The fan-out across sellers is extracted into a pure `buildSuggestionsMap` function (testable without supabase mocking, per CLAUDE.md "no mocking" convention). The route handler is a thin wrapper that injects a real-supabase-bound query function. Strip renders below the seller card's Checkout footer, uses `ListingCardMini`, fires two PostHog events (impression + click), gracefully degrades when buyer country is non-Baltic or signed-out.

**Tech Stack:** Next.js App Router, React 19, Supabase (postgrest), Tailwind, PostHog Cloud EU, Sentry, vitest.

**Design reference:** `docs/plans/2026-05-29-cart-cross-sell-design.md` (full design with rationale).

---

## Pre-flight

Before starting, confirm you're on `feature/cart-cross-sell` (branched from main) and the design doc commit is present:

```bash
git branch --show-current
# Expected: feature/cart-cross-sell

git log --oneline -1
# Expected: a7727d2 docs(cart): cross-sell design — 'More from {seller}' strip
```

If anything is off, stop and ask.

---

### Task 1: Add `scrollbar-hide` utility to globals.css

**Why first:** Trivial, no dependencies, lets the layout work end-to-end without surprise scroll bars in the strip. Land it as scaffolding so later tasks can assume it exists.

**Files:**
- Modify: `src/styles/globals.css` (or wherever the project's global stylesheet lives — confirm by inspection)

**Step 1: Locate the global stylesheet**

```bash
find src -name 'globals.css' -o -name 'global.css' | head -3
```

Expected: one file path (likely `src/app/globals.css` or `src/styles/globals.css`).

**Step 2: Add the utility**

At the bottom of the file, add:

```css
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

**Step 3: Verify it compiles**

```bash
pnpm dev
```

Open any page, check the dev server logs for CSS errors. Stop the server (Ctrl-C).

**Step 4: Commit**

```bash
git add src/styles/globals.css   # or actual path
git commit -m "feat(ui): add scrollbar-hide utility"
```

---

### Task 2: Extend cart types with `CartSuggestion` and `suggestions` map

**Files:**
- Modify: `src/lib/checkout/cart-types.ts`

**Step 1: Read the existing file**

```bash
# (read with the Read tool — already in context)
```

`ListingCondition` is already imported at line 1. `CartValidationResult` is at lines 66-70.

**Step 2: Add `CartSuggestion` interface and extend `CartValidationResult`**

Add after the existing `CartSellerProfile` interface, before `CartValidationResult`:

```ts
/** A single cross-sell suggestion surfaced under a seller card */
export interface CartSuggestion {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
  expansionCount: number;
}
```

Then extend `CartValidationResult`:

```ts
export interface CartValidationResult {
  available: string[];
  unavailable: UnavailableItem[];
  sellers: Record<string, CartSellerProfile>;
  /** Keyed by sellerId. Sellers with no eligible other listings or beyond the fan-out cap are absent from the map. */
  suggestions: Record<string, CartSuggestion[]>;
}
```

**Step 3: Run type-check to confirm nothing downstream breaks yet**

```bash
pnpm type-check
```

Expected: PASS. (Callers haven't been updated to consume `suggestions` yet, but the field is optional-in-practice — readers only break if they destructure with exhaustiveness checks, which this codebase doesn't do.)

If type-check fails, stop and investigate before moving on.

**Step 4: Commit**

```bash
git add src/lib/checkout/cart-types.ts
git commit -m "feat(cart): add CartSuggestion + suggestions to CartValidationResult"
```

---

### Task 3: Register analytics events in `AnalyticsEventMap`

**Files:**
- Modify: `src/lib/analytics/types.ts`

**Step 1: Locate the map**

`AnalyticsEventMap` starts on line 5 of `src/lib/analytics/types.ts`. Add the new events alongside the existing entries (placement doesn't matter — group near `cart_item_added` for readability).

**Step 2: Add the two events**

```ts
cart_suggestion_strip_viewed: {
  seller_id: string;
  count: number;
};
cart_suggestion_clicked: {
  seller_id: string;
  listing_id: string;
  /** 0-indexed position within the seller's suggestion strip */
  position: number;
};
```

**Step 3: Type-check**

```bash
pnpm type-check
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/analytics/types.ts
git commit -m "feat(analytics): register cart_suggestion_strip_viewed + cart_suggestion_clicked"
```

---

### Task 4: Extend `trackClient` to accept a `sendInstantly` option

**Why:** PostHog batches `capture` calls. The click event must flush before client-side navigation unmounts the cart page; the underlying `posthog.capture()` accepts `{ send_instantly: true }`, but the project's wrapper doesn't expose it yet.

**Files:**
- Modify: `src/lib/analytics/track-client.ts`

**Step 1: Read the existing wrapper**

It's 14 lines, no options accepted today.

**Step 2: Add an options parameter**

```ts
import type { AnalyticsEventMap, AnalyticsEventName } from './types';
import { getPostHogClient } from './posthog-client';

interface TrackClientOptions {
  /** Force immediate send instead of batching. Use before client-side navigation. */
  sendInstantly?: boolean;
}

export function trackClient<K extends AnalyticsEventName>(
  event: K,
  properties: AnalyticsEventMap[K],
  options: TrackClientOptions = {},
): void {
  try {
    const ph = getPostHogClient();
    if (!ph) return;
    if (options.sendInstantly) {
      ph.capture(event, properties, { send_instantly: true });
    } else {
      ph.capture(event, properties);
    }
  } catch (err) {
    console.error('[analytics] trackClient failed', err);
  }
}
```

**Step 3: Type-check + verify existing callers compile**

```bash
pnpm type-check
```

Expected: PASS. (The new parameter is optional, so every existing call site remains valid.)

**Step 4: Commit**

```bash
git add src/lib/analytics/track-client.ts
git commit -m "feat(analytics): add sendInstantly option to trackClient"
```

---

### Task 5a: Write failing test for `buildSuggestionsMap` — happy path

**Files:**
- Create: `src/lib/cart/suggestions.ts` (empty stub for now)
- Create: `src/lib/cart/suggestions.test.ts`

**Step 1: Create stub**

`src/lib/cart/suggestions.ts`:

```ts
/** Bare DB row shape returned by the per-seller suggestion query. Not the full CartSuggestion (expansion counts decorated later). */
export interface SuggestionListing {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable';
  priceCents: number;
}

export async function buildSuggestionsMap(
  _sellerIds: string[],
  _fetchOne: (sellerId: string) => Promise<SuggestionListing[]>,
  _logError: (sellerId: string, err: unknown) => void,
  _cap: number = 5,
): Promise<Record<string, SuggestionListing[]>> {
  throw new Error('not implemented');
}
```

Note: `condition` is typed inline here as a string union for self-containment of the test file. Reuse `ListingCondition` from `@/lib/listings/types` for the actual file — leaving the import gap to the implementation step.

**Step 2: Write the happy-path test**

`src/lib/cart/suggestions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildSuggestionsMap, type SuggestionListing } from './suggestions';

function mkListing(id: string): SuggestionListing {
  return {
    listingId: id,
    gameTitle: `Game ${id}`,
    gameThumbnail: null,
    firstPhoto: null,
    condition: 'good',
    priceCents: 1000,
  };
}

describe('buildSuggestionsMap', () => {
  it('returns each seller mapped to their fetched listings', async () => {
    const fetchOne = vi.fn(async (sellerId: string) => [
      mkListing(`${sellerId}-a`),
      mkListing(`${sellerId}-b`),
    ]);
    const logError = vi.fn();

    const result = await buildSuggestionsMap(['s1', 's2'], fetchOne, logError);

    expect(result).toEqual({
      s1: [mkListing('s1-a'), mkListing('s1-b')],
      s2: [mkListing('s2-a'), mkListing('s2-b')],
    });
    expect(fetchOne).toHaveBeenCalledTimes(2);
    expect(logError).not.toHaveBeenCalled();
  });
});
```

**Step 3: Run test to confirm it fails**

```bash
pnpm test src/lib/cart/suggestions.test.ts
```

Expected: 1 failed (throws "not implemented").

**Step 4: Commit (failing test + stub)**

```bash
git add src/lib/cart/suggestions.ts src/lib/cart/suggestions.test.ts
git commit -m "test(cart): failing happy-path test for buildSuggestionsMap"
```

---

### Task 5b: Make Task 5a pass — minimal happy-path implementation

**Files:**
- Modify: `src/lib/cart/suggestions.ts`

**Step 1: Implement the minimal logic**

Replace the stub body with:

```ts
import type { ListingCondition } from '@/lib/listings/types';

export interface SuggestionListing {
  listingId: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
}

/**
 * Pure fan-out helper for cart cross-sell suggestions.
 *
 * Dispatches one `fetchOne` call per seller (capped at `cap`), uses Promise.allSettled
 * so a single seller's failure can't tank the whole map, and logs rejections via the
 * injected `logError` callback. The route handler wraps this with a closure-bound
 * `fetchOne` that knows each seller's cart-item exclude list.
 */
export async function buildSuggestionsMap(
  sellerIds: string[],
  fetchOne: (sellerId: string) => Promise<SuggestionListing[]>,
  logError: (sellerId: string, err: unknown) => void,
  cap: number = 5,
): Promise<Record<string, SuggestionListing[]>> {
  const targets = sellerIds.slice(0, cap);
  const results = await Promise.allSettled(targets.map((sid) => fetchOne(sid)));

  const map: Record<string, SuggestionListing[]> = {};
  for (let i = 0; i < targets.length; i++) {
    const sellerId = targets[i];
    const settled = results[i];
    if (settled.status === 'fulfilled') {
      map[sellerId] = settled.value;
    } else {
      logError(sellerId, settled.reason);
    }
  }
  return map;
}
```

**Step 2: Run the test, confirm it passes**

```bash
pnpm test src/lib/cart/suggestions.test.ts
```

Expected: 1 passed.

**Step 3: Commit**

```bash
git add src/lib/cart/suggestions.ts
git commit -m "feat(cart): implement buildSuggestionsMap fan-out"
```

---

### Task 5c: Add the three remaining unit tests

**Files:**
- Modify: `src/lib/cart/suggestions.test.ts`

**Step 1: Add error-isolation, cap, and order-preservation tests**

Append inside the existing `describe`:

```ts
it('returns suggestions = {} when every fetchOne rejects, logging each', async () => {
  const fetchOne = vi.fn(async () => {
    throw new Error('db hiccup');
  });
  const logError = vi.fn();

  const result = await buildSuggestionsMap(['s1', 's2'], fetchOne, logError);

  expect(result).toEqual({});
  expect(logError).toHaveBeenCalledTimes(2);
  expect(logError).toHaveBeenCalledWith('s1', expect.any(Error));
  expect(logError).toHaveBeenCalledWith('s2', expect.any(Error));
});

it('partitions fulfilled and rejected sellers independently', async () => {
  const fetchOne = vi.fn(async (sellerId: string) => {
    if (sellerId === 'bad') throw new Error('boom');
    return [mkListing(`${sellerId}-a`)];
  });
  const logError = vi.fn();

  const result = await buildSuggestionsMap(['good1', 'bad', 'good2'], fetchOne, logError);

  expect(result).toEqual({
    good1: [mkListing('good1-a')],
    good2: [mkListing('good2-a')],
  });
  expect(logError).toHaveBeenCalledTimes(1);
  expect(logError).toHaveBeenCalledWith('bad', expect.any(Error));
});

it('caps fan-out at first N sellers in input order', async () => {
  const fetchOne = vi.fn(async (sellerId: string) => [mkListing(`${sellerId}-a`)]);
  const logError = vi.fn();

  await buildSuggestionsMap(['a', 'b', 'c', 'd', 'e', 'f', 'g'], fetchOne, logError, 5);

  expect(fetchOne).toHaveBeenCalledTimes(5);
  expect(fetchOne).toHaveBeenNthCalledWith(1, 'a');
  expect(fetchOne).toHaveBeenNthCalledWith(2, 'b');
  expect(fetchOne).toHaveBeenNthCalledWith(3, 'c');
  expect(fetchOne).toHaveBeenNthCalledWith(4, 'd');
  expect(fetchOne).toHaveBeenNthCalledWith(5, 'e');
});
```

**Step 2: Run all four tests**

```bash
pnpm test src/lib/cart/suggestions.test.ts
```

Expected: 4 passed.

**Step 3: Commit**

```bash
git add src/lib/cart/suggestions.test.ts
git commit -m "test(cart): error isolation, partition, cap behavior for buildSuggestionsMap"
```

---

### Task 6: Wire `buildSuggestionsMap` into `/api/cart/validate`

**Files:**
- Modify: `src/app/api/cart/validate/route.ts`

**Step 1: Re-read the existing route**

Note the structure: cart-validate parses body, loads listings, partitions into available/unavailable, loads seller profiles, returns. The new suggestions block sits at the end, in its own try/catch, returning empty map on any unexpected failure.

**Step 2: Add the suggestions block before the `return NextResponse.json(...)` line**

```ts
import * as Sentry from '@sentry/nextjs';
import { buildSuggestionsMap, type SuggestionListing } from '@/lib/cart/suggestions';
import { getListingCardCounts } from '@/lib/listings/queries';
import type { CartSuggestion } from '@/lib/checkout/cart-types';
```

Then, just before the existing `return NextResponse.json({ available, unavailable, sellers })` line:

```ts
// Per-seller cross-sell suggestions. Wrapped in its own try/catch so a failure
// here NEVER breaks the core validation response.
let suggestions: Record<string, CartSuggestion[]> = {};
try {
  // Group cart's listing IDs by seller so we can exclude them from their own
  // seller's suggestion strip. Cart items keep status='active' until checkout-create
  // flips them to 'reserved' (see src/app/api/payments/cart-create/route.ts:254),
  // so the explicit exclusion below is LOAD-BEARING, not defensive.
  const excludeBySeller = new Map<string, string[]>();
  for (const l of listings ?? []) {
    if (!excludeBySeller.has(l.seller_id)) excludeBySeller.set(l.seller_id, []);
    excludeBySeller.get(l.seller_id)!.push(l.id);
  }

  const orderedSellerIds = Array.from(excludeBySeller.keys());

  const fetchOne = async (sellerId: string): Promise<SuggestionListing[]> => {
    const excludeIds = excludeBySeller.get(sellerId) ?? [];
    let q = supabase
      .from('listings')
      .select('id, game_name, price_cents, condition, primary_photo_url, games(thumbnail_url)')
      .eq('seller_id', sellerId)
      .eq('status', 'active')
      .eq('listing_type', 'regular')
      .order('created_at', { ascending: false })
      .limit(8);

    if (excludeIds.length > 0) {
      // PostgREST `not.in.()` rejects empty parens; guard accordingly.
      q = q.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((row) => ({
      listingId: row.id as string,
      gameTitle: row.game_name as string,
      gameThumbnail: (row.games as { thumbnail_url: string | null } | null)?.thumbnail_url ?? null,
      firstPhoto: (row.primary_photo_url as string | null) ?? null,
      condition: row.condition as SuggestionListing['condition'],
      priceCents: row.price_cents as number,
    }));
  };

  const logError = (sellerId: string, err: unknown) => {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { surface: 'cart_suggestions' },
      extra: { sellerId },
    });
  };

  const bareMap = await buildSuggestionsMap(orderedSellerIds, fetchOne, logError);

  // Decorate with expansion counts via the existing helper.
  const allListingIds = Object.values(bareMap).flatMap((rows) => rows.map((r) => r.listingId));
  const { expansionCounts } = await getListingCardCounts(supabase, allListingIds);

  for (const [sellerId, rows] of Object.entries(bareMap)) {
    suggestions[sellerId] = rows.map((r) => ({
      listingId: r.listingId,
      gameTitle: r.gameTitle,
      gameThumbnail: r.gameThumbnail,
      firstPhoto: r.firstPhoto,
      condition: r.condition,
      priceCents: r.priceCents,
      expansionCount: expansionCounts[r.listingId] ?? 0,
    }));
  }
} catch (err) {
  Sentry.captureException(err, {
    level: 'warning',
    tags: { surface: 'cart_suggestions_outer' },
  });
  suggestions = {};
}

return NextResponse.json({ available, unavailable, sellers, suggestions });
```

**Step 3: Run type-check + build**

```bash
pnpm type-check
```

Expected: PASS. (If you see "games is null" type errors on the join, narrow with `as unknown as { games: ... }` per the cast in the mapping block.)

**Step 4: Anon smoke check (manual, local)**

Start dev server:

```bash
pnpm dev
```

In a new terminal, find a current active listing ID:

```bash
# Quick way: open /browse, click any card, copy the UUID from the URL
```

Then curl with no cookies:

```bash
curl -s -X POST http://localhost:3000/api/cart/validate \
  -H 'Content-Type: application/json' \
  -d '{"listingIds":["<paste-listing-id>"]}' | jq '.suggestions'
```

Expected: a JSON object keyed by the listing's seller ID with an array of suggestion objects, each with **non-null `gameThumbnail`** (proves the `games` join is anon-readable). If `gameThumbnail` is null across the board, the RLS regression from CLAUDE.md has bitten — stop and investigate the `games` table policy before continuing.

Stop the dev server.

**Step 5: Commit**

```bash
git add src/app/api/cart/validate/route.ts
git commit -m "feat(cart): return per-seller cross-sell suggestions from validate"
```

---

### Task 7a: Render the suggestion strip in the cart page

**Files:**
- Modify: `src/app/[locale]/cart/page.tsx`

**Step 1: Read the existing cart page**

The relevant section is the `useEffect` validate fetch (lines 36-60) and the seller-group `.map` render (lines 155-266). The new strip will:
- Pull `suggestions: Record<string, CartSuggestion[]>` from the validation response into local state
- Render inside each seller's `<Card>`, after the existing subtotal/checkout footer block (the `<div className="mt-4 pt-3 border-t border-semantic-border">` closes at line 262 — strip goes after this `</div>`, before `</CardBody>`)

**Step 2: Add state + extend the validate handler**

In the component body, add a new state hook near the existing ones:

```ts
const [suggestionsBySeller, setSuggestionsBySeller] = useState<Record<string, CartSuggestion[]>>({});
```

Import `CartSuggestion` from `@/lib/checkout/cart-types`.

In the validate `.then((data: CartValidationResult) => { ... })` block, after `if (data.sellers) setSellerProfiles(data.sellers);`, add:

```ts
if (data.suggestions) setSuggestionsBySeller(data.suggestions);
```

**Step 3: Determine buyer Baltic-status (for the secondary copy line)**

Below the existing `const buyerCountry = profile?.country ?? null;`:

```ts
const BALTIC = new Set(['LV', 'LT', 'EE']);
const buyerIsBaltic = buyerCountry !== null && BALTIC.has(buyerCountry);
```

**Step 4: Render the strip inside each seller card**

Inside the `sellerGroups.map((group) => { ... })` block, the JSX currently ends with the subtotal/checkout `<div className="mt-4 pt-3 border-t border-semantic-border">...</div>` followed by `</CardBody></Card>`.

Insert this between the closing `</div>` of the subtotal block and `</CardBody>`:

```tsx
{suggestionsBySeller[group.sellerId]?.length ? (
  <CartSuggestionStrip
    sellerId={group.sellerId}
    sellerName={group.sellerName}
    suggestions={suggestionsBySeller[group.sellerId]}
    showShippingHint={buyerIsBaltic}
  />
) : null}
```

`CartSuggestionStrip` is a new component you'll create in Task 7b. Stub the import at the top of the file:

```ts
import { CartSuggestionStrip } from './CartSuggestionStrip';
```

**Step 5: Type-check (expected to fail until 7b lands)**

```bash
pnpm type-check
```

Expected: FAIL with "Cannot find module './CartSuggestionStrip'". This is fine — Task 7b creates it. Move to 7b without committing yet.

---

### Task 7b: Create `CartSuggestionStrip` component

**Files:**
- Create: `src/app/[locale]/cart/CartSuggestionStrip.tsx`

**Step 1: Write the component**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { ListingCardMini } from '@/components/listings/ListingCardMini';
import { trackClient } from '@/lib/analytics';
import type { CartSuggestion } from '@/lib/checkout/cart-types';

interface CartSuggestionStripProps {
  sellerId: string;
  sellerName: string;
  suggestions: CartSuggestion[];
  showShippingHint: boolean;
}

export function CartSuggestionStrip({
  sellerId,
  sellerName,
  suggestions,
  showShippingHint,
}: CartSuggestionStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const impressionFiredRef = useRef(false);

  // Fire impression event once when the strip becomes ≥50% visible.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || impressionFiredRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !impressionFiredRef.current) {
            impressionFiredRef.current = true;
            trackClient('cart_suggestion_strip_viewed', {
              seller_id: sellerId,
              count: suggestions.length,
            });
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sellerId, suggestions.length]);

  if (suggestions.length === 0) return null;

  return (
    <div ref={containerRef} className="mt-4 pt-3">
      <p className="text-sm text-semantic-text-secondary mb-1">
        More from {sellerName}
      </p>
      {showShippingHint && (
        <p className="text-xs text-semantic-text-muted mb-3">
          Shipping is usually included when sellers ship together.
        </p>
      )}
      <ul
        role="list"
        aria-label={`More from ${sellerName}`}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-1 px-1 pb-2"
      >
        {suggestions.map((s, position) => (
          <li
            key={s.listingId}
            className="snap-start shrink-0 w-[160px] sm:w-[180px]"
            onClickCapture={() => {
              trackClient(
                'cart_suggestion_clicked',
                { seller_id: sellerId, listing_id: s.listingId, position },
                { sendInstantly: true },
              );
            }}
          >
            <ListingCardMini
              id={s.listingId}
              gameTitle={s.gameTitle}
              gameThumbnail={s.gameThumbnail}
              firstPhoto={s.firstPhoto}
              condition={s.condition}
              priceCents={s.priceCents}
              expansionCount={s.expansionCount}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Two design notes baked in:
- The shipping-hint copy renders only when `showShippingHint` (buyer is Baltic). Non-Baltic and signed-out get the bare label.
- Click event uses `onClickCapture` on the `<li>` so it fires before `ListingCardMini`'s `<Link>` initiates navigation, with `sendInstantly: true` to flush before unmount.

**Step 2: Type-check**

```bash
pnpm type-check
```

Expected: PASS.

**Step 3: Lint**

```bash
pnpm lint
```

Expected: PASS (no warnings/errors on the two new files).

**Step 4: Commit both files together**

```bash
git add src/app/[locale]/cart/page.tsx src/app/[locale]/cart/CartSuggestionStrip.tsx
git commit -m "feat(cart): render More from {seller} cross-sell strip"
```

---

### Task 8: Manual verification matrix

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Sign in as a Baltic buyer (any LV/LT/EE test account)**

Add a listing from a seller who has at least 3 other active listings to your cart. Navigate to `/cart`. Verify:

- [ ] "More from {sellerName}" header renders below the Checkout button inside the seller's card
- [ ] Secondary line "Shipping is usually included when sellers ship together." renders below it
- [ ] Strip shows up to 8 thumbnails, oldest-to-newest-right (newest first)
- [ ] None of your cart's same-seller items appear in the strip
- [ ] On mobile width (resize to 375px), strip scrolls horizontally, no visible scrollbar
- [ ] On desktop, partial next thumb peeks at right edge when count ≥ 4

**Step 3: Sign out / signed-out user**

Without authentication, navigate to `/cart` with the same items (cart persists via localStorage). Verify:

- [ ] "More from {sellerName}" still renders
- [ ] Secondary "Shipping is usually included…" line is **suppressed**

**Step 4: Signed-in non-Baltic buyer**

Either change your profile country to a non-LV/LT/EE value temporarily, or use a test account with non-Baltic country. Verify:

- [ ] "More from {sellerName}" renders
- [ ] Secondary "Shipping is usually included…" line is **suppressed**

(Restore the test account's original country before moving on.)

**Step 5: Empty-suggestions seller**

Add a cart item from a seller who has no other active listings. Verify:

- [ ] No strip renders at all (entire `<CartSuggestionStrip>` block omits)
- [ ] No spacing artifact, no empty header

**Step 6: Click-through path**

Click any suggestion thumb. Verify:

- [ ] Navigates to `/listings/{id}` correctly
- [ ] Browser back button returns to `/cart` with cart contents intact

**Step 7: Stale-listing path**

Open cart in tab A. From another session/account, mark a suggested listing as sold. In tab A, click the now-stale suggestion. Verify:

- [ ] Listing detail page renders the existing "It may have been sold or removed by the seller" message (already verified during design — line 247 of `src/app/[locale]/listings/[id]/page.tsx`)

**Step 8: PostHog event capture verification**

Open PostHog Live Events (https://eu.posthog.com → Activity → Live events) in another browser window. Refresh the cart page. Scroll until the strip becomes ≥50% visible. Verify:

- [ ] `cart_suggestion_strip_viewed` event arrives with `{ seller_id, count }`

Click a suggestion. Verify:

- [ ] `cart_suggestion_clicked` event arrives with `{ seller_id, listing_id, position }` (`position` 0-indexed)
- [ ] Event appears before the `$pageview` for `/listings/{id}` (confirms `sendInstantly` flushed)

**Step 9: Cart-mutation refresh cycle**

In cart, remove the last item from a seller (using the trash icon). Verify:

- [ ] Seller's entire card disappears cleanly (including the suggestion strip)
- [ ] No flicker, no orphaned strip, no React key warnings in the console

Stop the dev server.

---

### Task 9: Pre-deploy gate + push + open PR

**Step 1: Run the full verify gate**

```bash
pnpm verify
```

Expected: PASS (`type-check` + `lint` + `test` + `build` all green).

If any step fails, fix and re-run.

**Step 2: Push the branch**

```bash
git push -u origin feature/cart-cross-sell
```

**Step 3: Open the PR**

```bash
gh pr create --title "feat(cart): More from {seller} cross-sell strip" --body "$(cat <<'EOF'
## Summary
- Adds a per-seller suggestion strip below each cart-seller card showing up to 8 of their other active fixed-price listings
- Extends `/api/cart/validate` to return suggestions; fan-out is extracted into pure `buildSuggestionsMap` for unit-testability without supabase mocking
- Fires `cart_suggestion_strip_viewed` (impression, IntersectionObserver 0.5) + `cart_suggestion_clicked` (0-indexed position, `sendInstantly` for click-before-nav flush)
- Copy gated by buyer country: Baltic buyers see "Shipping is usually included when sellers ship together"; non-Baltic and signed-out see the bare "More from {seller}" label

## Design
Full design rationale in `docs/plans/2026-05-29-cart-cross-sell-design.md`.

## Notes for review
- The `.not('id', 'in', ...)` clause in the suggestion query is **load-bearing**, not defensive. Cart items keep `status='active'` until checkout-create flips them to `reserved` (see `cart-create/route.ts:254`). Inline comment in the route handler explains this so future cleanup passes don't strip it.
- Endpoint naming (`/api/cart/validate`) is mildly misleading post-extension. Defer rename to `/api/cart/state` until a third concern lands.
- Validate-route latency now gates strip render (acceptable v1 tradeoff — avoids populated→reflow flash). Revisit by splitting routes if perceived perf becomes a complaint.
- Added a custom `.scrollbar-hide` utility to `globals.css` (project Tailwind had no plugin for it).
- Per-seller fan-out cap at 5 sellers (DoS guard, not a UX feature; cart-display order, no tiebreaker).
- New analytics events registered in `AnalyticsEventMap` per CLAUDE.md convention. Extended `trackClient` to accept `sendInstantly: true`.

## Test plan
- [x] Unit: `pnpm test src/lib/cart/suggestions.test.ts` (4 tests — happy path, error isolation, partition, cap)
- [x] Anon RLS smoke: curl validate endpoint with no cookies → confirmed `gameThumbnail` populated on join through `games`
- [x] Manual layout matrix (320 / 375 / 768 / 1280 × 1/3/8/0 items)
- [x] Buyer-country copy matrix (Baltic / non-Baltic / signed-out)
- [x] Click-through + stale-listing + cart-mutation refresh paths
- [x] PostHog Live Events confirmed both events fire with correct properties
- [x] `pnpm verify` passes
EOF
)"
```

Expected: PR URL printed.

**Step 4: Report PR URL to the user.**

---

## Out of scope (deferred — do not implement)

Explicit non-goals from the design doc:

- Ranking beyond newest-first
- "See all from seller" link below the strip
- Inline add-to-cart from suggestion thumbs
- Auctions / wanted listings in suggestions
- Parcel-capacity gating (would need listing-weight schema)
- Endpoint rename `/api/cart/validate` → `/api/cart/state`

If you find yourself wanting to add any of these mid-implementation, stop and ask — they belong in a follow-up PR.

---

## Skills required

- `superpowers:executing-plans` — step-by-step task execution
- `superpowers:test-driven-development` — Task 5a/5b/5c TDD sequence
- `superpowers:verification-before-completion` — Task 8 + Task 9 evidence gate before claiming done
