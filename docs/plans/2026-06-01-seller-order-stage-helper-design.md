# Seller order-stage helper — design

**Date:** 2026-06-01
**Status:** Approved, ready for implementation
**Scope:** Seller-facing order detail page (`/orders/[id]`)

## Goal

Give sellers actionable, stage-specific help directly on the order detail page. The
order-progress timeline tells a seller *what state* the order is in; it doesn't tell them
*what to do now*. This adds a per-stage "next steps" helper, starting with the **Accepted**
stage (the moment the seller needs to package and ship).

Reusable structure now, Accepted content now; other stages render nothing until their
content is designed (clean extension point).

## What the seller sees (Accepted stage)

A single `Card` titled **"Ship your parcel"**, placed in the existing Accepted-stage seller
cluster (status banner → barcode → **this card** → "Mark as shipped" → timeline). Two parts:

1. **Packaging** — one encouraging line + an `InlineArrowLink` to the existing guide at
   `/help/packing`. No inline duplication of the guide, just the doorway.
   - Copy: *"New to shipping board games? A few minutes of padding saves a
     damaged-in-transit dispute."* + link **"Read the packing guide"**.

2. **Find a drop-off locker** — collapsed by default behind a **"Find a drop-off locker"**
   button (`Button variant="secondary"`, `MapPin` icon). On click it expands an inline
   locker finder (map + search + "locate me"), scoped to the seller's country.
   - Subtitle once expanded: *"Drop at whichever compatible locker is closest to you."*

The Unisend terminal list (`/api/v2/terminal?receiverCountryCode=…`) is the full set of
network lockers in a country — the same lockers a seller can drop into — so "pick the
closest one" is accurate. No buyer-terminal matching; the seller is not constrained to the
buyer's choice.

## Components

### 1. `OrderStageHelper` (new client component)

The reusable per-stage structure. Seller-only, rendered inside `OrderDetailClient`. Pure
`switch (status)`:

- `accepted` → renders the Accepted helper (packaging + `LockerFinder`)
- every other status → returns `null` (extension point — fill in later)

Buyer never sees it. Render-tested.

### 2. `LockerFinder` (new client component)

Read-only wrapper around the **existing** `TerminalMap` — no selection commit.

- Reuses `TerminalMap` + a search box (name/city/address), scoped to `order.seller_country`.
- Geolocation: the map's existing `showLocate`/`onLocate` button drops the "you are here"
  marker. No new geolocation code.
- Popup: locker details + a **"Get directions"** link
  (`https://www.google.com/maps/search/?api=1&query={lat},{lng}`, opens in new tab),
  instead of checkout's "Select terminal" button.
- `TerminalMap` is already `dynamic`/`ssr:false`, and only mounts on expand, so the
  collapsed default costs nothing.

### 3. `TerminalMap` (existing — one small change)

Add one optional prop to swap the popup's "Select terminal" button for the finder's
"Get directions" link. Checkout keeps current behavior by default (prop unset).

### 4. `orders/[id]/page.tsx` (existing — data fetch)

Fetch `getAllTerminals()` **only** when `userRole === 'seller' && status === 'accepted'`,
filter to `seller_country`, pass terminals to `OrderDetailClient`. Wrap in `.catch(() => [])`
exactly like checkout. No extra Unisend call on any other order view.

## Edge cases

- **Terminals fetch fails / empty** → finder still expands but shows
  *"Locker map is unavailable right now — drop at any compatible parcel locker."* The
  existing status banner already carries the fallback instruction.
- **`seller_country` missing** (rare) → hide the finder, keep the packaging link. (Default
  to `LV` only if we decide a default is better than hiding.)

## Testing

- `OrderStageHelper`: render test — accepted shows helper; other statuses render `null`;
  buyer role never sees it.
- Map / geolocation / "Get directions": manual verify (Mapbox, browser geolocation).

## Brand-voice notes

- No exclamation marks; "pre-loved" where relevant.
- Packaging line is encouraging, not a blocked/error/payment path, so the friction rule
  (no wit on blocked paths) doesn't apply here.

## Out of scope (deferred)

- Content for pending_seller / shipped / delivered / completed stages — the structure
  supports them; content is a later pass once we know what's genuinely useful per stage.
- Buyer-side per-stage helpers.
