<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. Five new analytics events were added to fill critical gaps in the existing PostHog instrumentation. The existing setup (PostHog EU, cookieless mode, `/ingest` reverse proxy, `trackClient`/`trackServer` wrappers, `AnalyticsEventMap` contract) was preserved entirely — all new events follow the same patterns already in use.

## New events added

| Event | Description | File | Side |
|-------|-------------|------|------|
| `cart_item_added` | Fires when a user adds a listing to their cart. Fills the gap between `listing_viewed` and `checkout_started` in the purchase funnel. | `src/lib/hooks/useAddToCart.ts` | Client |
| `seller_profile_viewed` | Fires when a buyer lands on a seller's profile page. Discovery signal for the browse → seller → listing path. | `src/components/analytics/SellerProfileAnalytics.tsx` (new), `src/app/[locale]/sellers/[id]/page.tsx` | Client |
| `auction_bid_placed` | Fires when a user places a bid on an auction listing. Key engagement metric for the auction feature. | `src/lib/auctions/bid-actions.ts` | Server |
| `wanted_listing_created` | Fires when a buyer creates a wanted listing. Demand-side signal for unmet supply. | `src/lib/wanted/actions.ts` | Server |
| `newsletter_subscribed` | Fires when a visitor subscribes to launch notifications. | `src/app/api/newsletter/subscribe/route.ts` | Server |

## Files modified

- `src/lib/analytics/types.ts` — extended `AnalyticsEventMap` with 5 new event types
- `src/lib/hooks/useAddToCart.ts` — `trackClient('cart_item_added', ...)` inside the `!isInCart` guard
- `src/components/analytics/SellerProfileAnalytics.tsx` — new client component (mirrors `ListingViewAnalytics` pattern)
- `src/app/[locale]/sellers/[id]/page.tsx` — renders `SellerProfileAnalytics` with seller ID and listing count
- `src/lib/auctions/bid-actions.ts` — `void trackServer('auction_bid_placed', ...)` after successful bid RPC
- `src/lib/wanted/actions.ts` — `void trackServer('wanted_listing_created', ...)` after successful insert
- `src/app/api/newsletter/subscribe/route.ts` — `void trackServer('newsletter_subscribed', ...)` after Resend contact creation

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/161634/dashboard/651158
- **Purchase funnel: Discovery → Checkout** (4-step funnel): https://eu.posthog.com/project/161634/insights/6ajYqQY4
- **Seller profile views (daily)**: https://eu.posthog.com/project/161634/insights/V79cnYU1
- **Auction engagement: bids placed (daily)**: https://eu.posthog.com/project/161634/insights/sfSFHocY
- **Supply vs demand: listings created vs wanted listings**: https://eu.posthog.com/project/161634/insights/J5Gw4qUB
- **New user acquisition: signups vs newsletter subscriptions**: https://eu.posthog.com/project/161634/insights/AW0NplcI

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
