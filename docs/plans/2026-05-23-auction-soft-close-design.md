# Auction soft close — design

Status: brainstorm output + post-brainstorm review pass. Not yet an approved implementation plan.

## Context

Second Turn Games launched 16 May 2026 as a thin Baltic marketplace. Sellers using auctions have reported they want more time for buyers to discover an auction before it closes, and have asked for a mechanic that gives auctions a grace period when bidding momentum exists.

Today's auction mechanic (`supabase/migrations/032_auctions.sql`) has a 5-minute snipe-protection window: a bid placed in the final 5 minutes pushes the deadline to `now + 5 min`. This solves last-second sniping but doesn't address the underlying thin-marketplace problem — auctions can close with one or zero bids because not enough buyers found them in time.

## Problem statement

In a thin marketplace, an auction's scheduled end can arrive before enough discovery has happened. Sellers want bidding to be cut off only when momentum genuinely stops, not when the clock happens to hit.

## Decisions

Locked in during the 2026-05-23 brainstorm:

1. **Mechanic: soft close on late bids.** Any bid in the final 24 hours of an auction pushes `auction_end_at` to `now + 24h`. The auction ends when 24 hours pass with no qualifying bid.
2. **Always-on for every auction.** No per-listing seller toggle.
3. **No hard cap on total duration.** The 24h-silence stop is the only end condition.
4. **Duration options reduced to 7 and 14 days.** Drop 1-, 3-, 5-day options. Default = 7 days.
5. **Existing 5-min snipe rule is replaced, not stacked.** A bid in the final 5 min would extend by 24h under the new rule — strictly stronger than the current +5min behavior.
6. **Boundary semantics.** The condition `auction_end_at - NOW() < INTERVAL '24 hours'` is strict-less-than. A bid placed at exactly T-24h does **not** extend; the boundary belongs to "not in window." This matches the existing 5-min rule's operator choice.

## Design

### Seller-facing: review-and-publish step

`src/app/[locale]/sell/_components/ReviewPriceStep.tsx` is a flat list of `<hr>`-separated sections, not a Card. Each section uses a small-caps eyebrow label (`text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide`), matching "Game & edition", "Condition", "Photos". The auction settings subsection follows the same pattern — no H2, no new heading hierarchy.

Concretely:

- The current `PriceInputSection` is split into two visual blocks (still inside the same component if it's cleaner; can be promoted to siblings if not):
  1. **Pricing block** — `PricingAssistant` (market context, suggested starting bid, Use price button) + starting price input. No eyebrow label needed; this is the leading block of the step.
  2. **Auction settings block** — eyebrow label `Auction settings`, then duration picker, then soft-close info row. Only renders when `isAuction === true`.
- A subtle visual separator between the two blocks: same `<hr className="border-semantic-border-subtle" />` pattern the rest of the file uses.
- **Duration picker:** `<Select>` replaced with an inline two-tile button group: `[7 days] [14 days]`, default 7. Styled like existing condition tiles (border-2 + brand-teal background on active, border-1 on inactive). Inline implementation (not a new shared atom) — single use today, design system rule "extract when 2+ call sites exist" applies. Flag this explicitly in the implementation PR so a reviewer doesn't suggest extraction.
- **Soft-close info row:** small muted-background box (matching the existing "Bids start at…" info-box pattern at lines 146–158), directly under the duration buttons:

  > If someone bids in the final 24 hours, the auction extends by 24 hours. It ends when 24 hours pass with no new bid.

- The existing bottom info box ("Bids are final and cannot be withdrawn. 10% commission applies to the winning bid.") stays unchanged — it's a terms reminder.

### Engine: bid RPC

The snipe-protection block in `place_bid` (lines 158–162 of `supabase/migrations/032_auctions.sql`) changes from:

```sql
IF v_listing.auction_end_at - NOW() < INTERVAL '5 minutes' THEN
  v_new_end_at := NOW() + INTERVAL '5 minutes';
END IF;
```

to:

```sql
IF v_listing.auction_end_at - NOW() < INTERVAL '24 hours' THEN
  v_new_end_at := NOW() + INTERVAL '24 hours';
END IF;
```

When the IF passes, `auction_end_at < NOW() + 24h`, so `v_new_end_at = NOW() + 24h` is always later than the current `auction_end_at`. The rule is a strict extension, never a shortening. The strict-`<` operator means a bid at exactly `NOW() + 24h = auction_end_at` does not extend (see decision 6).

When the IF passes (i.e., the RPC is about to change `auction_end_at`), the RPC also resets the ending-soon dedup column:

```sql
UPDATE public.listings
SET auction_end_at = v_new_end_at,
    auction_ending_soon_notified_at = NULL,
    ...
WHERE id = v_listing.id;
```

This atomic reset is the dedup mechanism (see "Notification interaction" below). `auction_original_end_at` is **not** touched — it is the immutable record of "what the seller originally chose," used for audit, dispute resolution, and reporting. The migration must include an explicit comment guarding against future edits ("DO NOT modify or null `auction_original_end_at`; it is the seller's original-deadline audit field").

### Buyer-facing display

- **Listing detail page (auction):** existing countdown stays. One-line explainer renders under the countdown: "Bids in the final 24 hours extend the auction by 24 hours."
- **Listing card (browse, homepage, seller page):** `Ends in 2d 14h` continues to reflect live `auction_end_at`. No badge added — the detail-page explainer carries the contract. Extensions only ever delay the end, never shorten it, so buyers are never surprised by an *earlier* close than displayed.

**Caching caveat — verify before merge.** The "ends in" labels on browse / homepage / seller-shop must reflect the live `auction_end_at`. If any of those routes are cached at the edge (Cloudflare) or via Next.js ISR, the displayed deadline can lag the actual one after an extension. No `force-dynamic` or `revalidate` exports were found in those paths, suggesting they render dynamically — but the Cloudflare cache rules need to be verified to confirm `/`, `/browse`, `/seller-shop/*` don't get cached at the edge. Add to pre-merge checklist.

### Notification interaction

**Today:** `src/app/api/cron/auction-ending-soon/route.ts` (5-min cadence) finds auctions ending within 30 minutes and not yet stamped via `listings.auction_ending_soon_notified_at`. After sending, it stamps the column. Binary mechanism — once stamped, the cron skips the auction forever.

**Under soft close** this regresses. An extended deadline would mean a buyer who got notified at T-30min of the original deadline gets *no* notification before the extended deadline.

**Fix:** the `place_bid` RPC resets `auction_ending_soon_notified_at` to `NULL` atomically whenever it extends `auction_end_at` (see RPC snippet above). The cron query in `route.ts` is **unchanged** — its semantics stay "find auctions where we haven't notified for the current deadline." The column's meaning shifts from "we have ever notified" to "we have notified for the current deadline," with the meaning carried by the atomic reset on extension.

This is the smallest change, requires no new table or new column, and produces the right behavior: each new deadline triggers a fresh ending-soon round.

Migration includes a `COMMENT ON COLUMN` documenting the new semantics so a future reader understands why the RPC resets it.

## Files to touch

1. **New migration replacing `place_bid` RPC** (sequential number from migrations head):
   - Change snipe block from 5min/5min to 24h/24h.
   - Add `auction_ending_soon_notified_at = NULL` to the UPDATE statement when extending.
   - `COMMENT ON COLUMN listings.auction_ending_soon_notified_at IS '...nulled atomically by place_bid when auction_end_at is extended; cron treats null as "ready to notify for current deadline".'`
   - Migration PR description must call out: do not modify or null `auction_original_end_at`.

2. **`src/lib/auctions/types.ts`:**
   - `AuctionDuration` → `7 | 14`
   - `AUCTION_DURATIONS` → `[7, 14]`
   - `AUCTION_DURATION_OPTIONS` → `[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }]`
   - Remove `SNIPE_WINDOW_MINUTES`
   - Remove `isInSnipeWindow()` (dead code — 0 callers as of 2026-05-23, only referenced by the constant it imports)
   - Add `SOFT_CLOSE_WINDOW_HOURS = 24` (UI-copy export; the RPC is server-authoritative for the actual value; see "TS/SQL drift" below)

3. **`src/lib/listings/actions.ts`** (lines 209–221):
   - Existing validation is imperative (`if (!validDurations.includes(...))`), not Zod. Match the existing pattern, do not introduce Zod here.
   - **Bug-adjacent cleanup:** line 213 hardcodes `const validDurations = [1, 3, 5, 7]` instead of importing `AUCTION_DURATIONS` from types. Replace with the imported constant so the same source of truth covers UI + server. The cleanup keeps the validation correct after the type change to `[7, 14]`.

4. **`src/app/[locale]/sell/_components/ReviewPriceStep.tsx`:**
   - Restructure auction block per "Seller-facing" section.
   - Replace `<Select>` (line 138) with inline two-tile button group.
   - Add eyebrow label + visual separator for the new "Auction settings" subsection.
   - Add the soft-close info row.

5. **Listing detail page** — add the one-line soft-close explainer under the countdown for auction listings only.

6. **`src/app/api/cron/auction-ending-soon/route.ts`** — no code change. The mechanism updates via the RPC's atomic reset.

## TS/SQL drift mitigation

`SOFT_CLOSE_WINDOW_HOURS` (TS, used only for UI copy) and `INTERVAL '24 hours'` (SQL, server-authoritative) describe the same business rule. If one drifts (e.g., UI copy says 12, RPC still extends 24), the contract breaks silently.

**Regression test:** Vitest spec introspects `pg_proc` for the body of `place_bid` and asserts the interval literal matches `SOFT_CLOSE_WINDOW_HOURS`. Sketch:

```ts
const { data } = await supabase.rpc('pg_get_functiondef', { funcname: 'place_bid' });
// or: select pg_get_functiondef('public.place_bid'::regprocedure) directly
const match = data.match(/INTERVAL '(\d+) hours?'/);
expect(Number(match[1])).toBe(SOFT_CLOSE_WINDOW_HOURS);
```

Cheap, catches the exact silent-failure pattern, runs as part of `pnpm test`.

## Test surface

- **RPC unit:**
  - Bid at `T-23h59m` extends `auction_end_at` to `NOW() + 24h` AND nulls `auction_ending_soon_notified_at`.
  - Bid at `T-24h00m` (exact equality) does NOT extend and does NOT null the notification column. The boundary belongs to "not in window."
  - Bid at `T-24h01m` does NOT extend.
- **TS/SQL drift:** `pg_proc` introspection test asserts the RPC's interval matches `SOFT_CLOSE_WINDOW_HOURS`.
- **Server validation:** posting `auction_duration_days: 3` is rejected. Posting 7 and 14 are accepted.
- **UI:** button-group renders with correct selection state; 7 days is selected by default; clicking 14 days updates form state.
- **Notification dedup under extension:**
  - Auction ending in 25 min, never notified → cron sends and stamps.
  - Bid lands at T-20min, extends deadline by 24h, RPC nulls stamp.
  - Cron 5min later: auction now ends in ~24h, outside the 30-min window → cron skips (correct).
  - Time passes; auction now ends in 25min again → cron finds `notified_at = null` → sends and stamps again. ✅

## Pre-merge gate

Run against production at merge time, not at design time:

```sql
SELECT count(*) AS active_auctions
FROM listings
WHERE listing_type = 'auction' AND status = 'active';
```

- **Result 0:** ship as-is; the "in-flight handling" considerations don't apply.
- **Result > 0:** reactivate the in-flight section (see below). Auctions in-flight with `duration_days IN (1, 3, 5)` keep their scheduled end; the new 24h soft-close rule applies to all bids placed after the migration runs. No backfill needed; the rule change is a strict improvement for sellers (5min → 24h protection) so no regression.

## Operational watch list (post-launch)

Each metric paired with a threshold for "raise the runbook":

| Metric | Watch threshold |
|---|---|
| % of auctions whose actual end > scheduled end | >50% sustained — soft close is firing meaningfully; likely fine, but signals the mechanic is load-bearing |
| % of auctions running ≥2× their scheduled duration | >10% sustained — runaway-bid case is real, consider adding a "+N days max" cap |
| Median number of `auction.ending_soon` notifications per auction | >3 — the signal is being eroded; consider a per-deadline minimum gap (e.g., dedup the same recipient within 6h) |
| Seller payment-timing complaints tied to extended auctions | Any pattern of ≥2 in a month — investigate specific auctions, consider cap |

Review weekly for the first month, then monthly. Threshold breaches are signals, not auto-actions — review the specific auctions before changing the rule.

## Out of scope / future work

- **Per-listing seller opt-out.** If sellers complain about runaway extensions, consider adding an opt-out toggle. Adding an opt-out later is simpler than retrofitting an opt-in.
- **Hard cap on total duration.** Watch operationally per the table above. Cleanest framing: "Auction cannot exceed original deadline + 7 days."
- **Variable soft-close window per duration.** Today every auction uses 24h. If 14-day auctions develop different bidder dynamics than 7-day, revisit.
- **Buyer-side "watch this auction" reminder.** Independent of soft close; if soft close lengthens auctions enough that buyers lose track, a watch-and-remind feature would help.
