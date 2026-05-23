# Auction soft close — design

Status: brainstorm output, not yet an approved implementation plan. Implementation plan to follow.

## Context

Second Turn Games launched 16 May 2026 as a thin Baltic marketplace. Sellers using auctions have reported they want more time for buyers to discover an auction before it closes, and have asked for a mechanic that gives auctions a grace period when bidding momentum exists.

Today's auction mechanic (`supabase/migrations/032_auctions.sql`) has a 5-minute snipe-protection window: a bid placed in the final 5 minutes pushes the deadline to `now + 5 min`. This solves last-second sniping but doesn't address the underlying thin-marketplace problem — auctions can close with one or zero bids because not enough buyers found them in time.

## Problem statement

In a thin marketplace, an auction's scheduled end can arrive before enough discovery has happened. Sellers want bidding to be cut off only when momentum genuinely stops, not when the clock happens to hit.

## Decisions

Locked in during the 2026-05-23 brainstorm:

1. **Mechanic: soft close on late bids.** Any bid in the final 24 hours of an auction pushes `auction_end_at` to `now + 24h`. The auction ends when 24 hours pass with no qualifying bid.
2. **Always-on for every auction.** No per-listing seller toggle. One uniform rule, one buyer mental model.
3. **No hard cap on total duration.** The 24h-silence stop is the only end condition. Risk: motivated bidders can drag an auction out for weeks; accepted at launch volumes, watch in operation (see "Operational watch list" below).
4. **Duration options reduced to 7 and 14 days.** Drop 1-, 3-, 5-day options. Default = 7 days. Under a 24h soft-close rule, a 1-day auction would enter soft-close mode the moment bidding starts; longer base durations keep the 24h window as a small final slice. Fewer clear options also pair better with a button-group UI than a four-item dropdown.
5. **Existing 5-min snipe rule is replaced, not stacked.** A bid in the final 5 min is also a bid in the final 24h; the new rule extends by 24h, which is strictly stronger than the current +5min behavior. The `SNIPE_WINDOW_MINUTES` constant is removed.

## Design

### Seller-facing: review-and-publish step

The auction-specific block on `src/app/[locale]/sell/_components/ReviewPriceStep.tsx` gets its own subsection inside the price-guide card, separated from the market-context block with a divider and an "Auction settings" subheading (`text-base font-semibold`, the standard card-subsection treatment per the design system rules).

Contents, in order:

- **Suggested starting bid + "Use price" button** — moved into the auction subsection. It's auction-only logic; currently it renders above the divider. Moving it inside the subsection makes the subsection self-contained.
- **Starting price input** — unchanged.
- **Auction duration** — `<Select>` dropdown replaced with a two-tile button group: `[7 days] [14 days]`, default 7. Styled like existing condition tiles (border-2 + brand-teal background on active, border-1 on inactive). Tap-friendly on mobile, both options visible at once.
- **Soft-close info row** — small muted-background box directly under the duration buttons:

  > Bids in the final 24 hours extend the auction by another 24 hours. The auction ends after 24 hours of no new bids. This gives your listing more time to find buyers.

The market-context block (New retail price + BoardGamePrices link) stays above the divider — it's price-discovery data, not an auction setting.

The bottom info box ("Bids are final and cannot be withdrawn. 10% commission applies to the winning bid.") stays as-is — it's a terms reminder, separate from how-extension-works.

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

When the `IF` passes, `auction_end_at < NOW() + 24h`, so `v_new_end_at = NOW() + 24h` is always later than the current `auction_end_at`. This is a strict extension; the rule never shortens an auction.

`auction_original_end_at` continues to record the immutable seller-chosen end. Useful for audit, dispute resolution, and reporting ("scheduled end" vs "actual end").

Stop condition: the existing `end-auctions` cron (1-min cadence) finalizes auctions when `auction_end_at` is reached without a qualifying bid in the prior 24h. No new cron required.

### Buyer-facing display

- **Listing detail page (auction).** Existing countdown stays. Adds a one-line explainer under the countdown: "Bids in the final 24 hours extend the auction by 24 hours."
- **Listing card (browse, homepage, seller page).** `Ends in 2d 14h` continues to reflect live `auction_end_at`. No badge or label added. The detail-page explainer carries the contract. Extensions only ever delay the end, never shorten it, so buyers are never surprised by an *earlier* close than displayed.

### Notification interaction

`src/app/api/cron/auction-ending-soon/` fires 30 min before `auction_end_at`. With a dynamic `auction_end_at`, the same auction can have multiple "30 min before" events — once for the original deadline, then once for each extended deadline.

This is the right behavior: bidders want to know "the new deadline is approaching." Implementation: the notification's dedup key includes a bucket of `auction_end_at` (e.g., the truncated ISO timestamp), so a previously-notified buyer gets a fresh notification before each new deadline without double-firing for the same deadline.

## Files to touch

- **New migration** replacing the snipe block in `place_bid` RPC. Sequential number from the current migrations head.
- **`src/lib/auctions/types.ts`**
  - `AuctionDuration` → `7 | 14`
  - `AUCTION_DURATIONS` → `[7, 14]`
  - `AUCTION_DURATION_OPTIONS` → `[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }]`
  - Remove `SNIPE_WINDOW_MINUTES`
  - Add `SOFT_CLOSE_WINDOW_HOURS = 24` (UI-copy export; the RPC is server-authoritative for the actual value)
- **`src/app/[locale]/sell/_components/ReviewPriceStep.tsx`**
  - Restructure auction block per "Seller-facing" section above
  - Replace `<Select>` with a button-group (small new atom or inline)
  - Move suggested-starting-bid inside the auction subsection
  - Add the soft-close info row
- **`src/lib/listings/actions.ts`**
  - Zod schema for `auction_duration_days` becomes `z.union([z.literal(7), z.literal(14)])`
  - Server validation rejects 1/3/5 even if the UI is bypassed
- **Listing detail page** — add the one-line soft-close explainer under the countdown for auction listings only
- **`src/app/api/cron/auction-ending-soon/`** — dedup key includes `auction_end_at` time bucket so extensions trigger fresh notifications without duplicates per deadline

## In-flight auction handling

Not applicable at the time of this design — there are no active auctions on the platform and no new auctions planned today. The migration ships into a clean slate.

If this design lands after auctions have been created, the duration-restriction change (1/3/5 dropped) applies to *creation only*; auctions already running with 1/3/5-day durations would keep their scheduled end and finalize normally under the new soft-close rule (which is strictly stronger than the old 5-min rule, so no seller is worse off).

## Test surface

- **RPC unit:** bid at `T-23h59m` extends `auction_end_at` to `NOW()+24h`; bid at `T-24h01m` does not extend.
- **Zod schema:** posting `auction_duration_days: 3` is rejected by the server action.
- **UI:** button-group renders with correct selection state; 7 days is selected by default; clicking 14 days updates the form state.
- **Notification dedup:** two extensions on a single auction produce two ending-soon fires, each tied to a distinct `auction_end_at` bucket, no duplicates per deadline.

## Out of scope / future work

- **Per-listing seller opt-out.** If sellers complain about runaway extensions, consider adding an opt-out toggle. Adding an opt-out later is simpler than retrofitting an opt-in.
- **Hard cap on total duration.** Watch operationally; if two-bidder tug-of-war extends auctions into multi-week ordeals, add a "+N days max" cap. Cleanest framing: "Auction cannot exceed original deadline + 7 days."
- **Variable soft-close window per duration.** Today every auction uses 24h. If 14-day auctions develop different bidder dynamics than 7-day, revisit.
- **Buyer-side "watch this auction" reminder.** Independent of soft close; if soft close lengthens auctions enough that buyers lose track, a watch-and-remind feature would help.

## Operational watch list (post-launch)

- Median total auction duration vs. scheduled duration (drift over time = soft close is firing meaningfully).
- Auctions running ≥2× their scheduled duration (signal that runaway-bid case is real, may warrant a cap).
- Seller complaints about payment-timing tied to specific extended auctions.
- Number of `auction.ending_soon` notifications fired per auction (a single auction generating many "ending soon" pings may degrade the signal).
