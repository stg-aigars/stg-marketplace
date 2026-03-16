---
name: Key UI Flows
description: Browse, sell/create listing, checkout, and order lifecycle flow summaries
type: project
---

## Browse

- `useBrowseFilters()` manages all filter state (condition, price range, player count, etc.)
- Two tabs: "For Sale" (aggregated by game) and "Wanted"
- Mobile: filter drawer (`MobileFilterDrawer`); Desktop: sidebar filters
- Infinite scroll with React Query

## Sell / Create Listing

- Phase-based: Research → Market → Action → Score
- BGG game search → select game → auto-fill title, image, player count
- Edition/version selection (BGG versions API or manual entry)
- Photo upload: max 8, JPEG/PNG/WebP/AVIF, 10MB limit
- Condition grading with info modal (likeNew, veryGood, good, acceptable, forParts)
- Price assistant with market suggestions
- Desktop: side-by-side preview; Mobile: modal preview

## Checkout

- Cart with reservation timer (items locked for buyer)
- Terminal/locker selection with Maplibre map
- Wallet balance applied automatically
- EveryPay redirect for card/bank payments
- Multi-item checkout from same seller

## Order Lifecycle

- Status timeline visualization
- Seller actions: accept/decline, mark shipped (with tracking)
- Buyer actions: confirm delivery, leave review, open dispute
- In-order messaging between buyer and seller
- 2-day dispute window after delivery before seller wallet credit

## Order State Machine

```
pending_seller → accepted → shipped → delivered → completed
    ↓              ↓           ↓          ↓
 cancelled     cancelled   cancelled   disputed → resolved
                                                   (completed OR refunded)
```
