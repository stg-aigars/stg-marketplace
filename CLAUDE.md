# Project Context

## Overview
Second Turn Games - Nordic-minimalist peer-to-peer board game marketplace for the Baltic region (Latvia, Lithuania, Estonia). "Every game deserves a second turn."

Launch philosophy: Start with basics across all three markets. Users grow with the platform. The marketplace is only as good as its community, and the community builds alongside the product.

## Tech Stack
- Next.js 14 App Router with TypeScript
- Supabase for database, auth, and storage
- EveryPay (Swedbank) for payments + platform wallet system
- BoardGameGeek (BGG) XML API for game search, metadata, and images (day-zero cornerstone)
- Unisend for parcel locker shipping (Baltic cross-border)
- Resend for transactional emails
- Tailwind CSS with custom design tokens (Nordic minimalist)
- Deployed on Hetzner VPS (Helsinki) with Coolify (Docker-based)
- pnpm (single package, not a monorepo)

## Commands
- `pnpm dev` - Start dev server (localhost:3000)
- `pnpm build` - Production build (THE pre-deploy gate, catches ESLint + type errors)
- `pnpm test` - Run Vitest test suite
- `pnpm lint` - Run ESLint
- `pnpm type-check` - TypeScript validation (not sufficient alone for deploy)

## Code Style
- Use ES modules (import/export)
- Prefer Server Components; use 'use client' only when needed (interactivity, hooks, browser APIs)
- Path alias: `@/*` maps to `src/`
- Phosphor Icons: always import from `@phosphor-icons/react/ssr` (even in client components). The base path has a double-barrel import that defeats tree-shaking.
- Follow existing patterns in codebase
- All monetary values as INTEGER CENTS (never floats). 1299 not 12.99

## Date & Time Formatting
Always use centralized utilities from `@/lib/date-utils`:
- `formatDate(date)` → `31.08.2026` (dd.MM.yyyy)
- `formatDateShort(date)` → `31.08` (dd.MM)
- `formatTime(date, locale?)` → `14:30` (en) / `14.30` (lv) — locale-aware separator
- `formatDateTime(date, locale?)` → `31.08.2026 14:30`
- `formatMessageTime(date, locale?)` → smart relative time

Never use `toLocaleDateString()`, `toLocaleTimeString()`, or `toLocaleString()` directly.
Never use 12-hour time format (AM/PM).

## Layout Standards
- Page containers: `max-w-7xl mx-auto px-4 sm:px-6`
- Focused/form pages: `max-w-4xl mx-auto px-4 sm:px-6`
- Page vertical padding: `py-6`
- Homepage sections: `py-8 sm:py-10 lg:py-12`
- Card image containers: `aspect-square` (not fixed heights)
- H1 page headings: `text-2xl sm:text-3xl font-bold font-display tracking-tight`
- H2 section headings: `text-xl sm:text-2xl font-semibold font-display tracking-tight`
- H2 card subsections: `text-base font-semibold` (stays Inter, no `font-display`)
- Borders: `border` (1px default); `border-2` only for selected/active states
- Shadows: `shadow-sm` (resting) → `shadow-md` (hover) → `shadow-lg` (dropdowns) → `shadow-xl` (modals)
- Colors: Never hardcode hex values — use Tailwind design token classes
- Transitions: Always use branded timing — `duration-250 ease-out-custom` or `duration-350 ease-out-custom`

## Brand Voice
- Welcoming, straightforward, playful, trustworthy
- "Pre-loved" not "used" or "secondhand"
- No exclamation marks in UI copy

## Payment Model
- **Buyer pays**: item price + shipping only (no service fee)
- **Seller commission**: 10% flat on item price (not shipping)
- **Seller receives**: 90% of item price, credited to platform wallet
- **Wallet uses INTEGER cents** for precision
- **Orders only created AFTER payment confirmed** (no pending_payment status)

### Order Status State Machine
```
pending_seller → accepted → shipped → delivered → completed
                    ↓           ↓         ↓
                cancelled   cancelled   disputed → resolved
```

### Cancellation Reasons
Orders store `cancellation_reason` (nullable): `'declined'` (seller), `'response_timeout'` (48h auto), `'shipping_timeout'` (5d auto), `'system'` (cart rollback). Type: `CancellationReason` in `src/lib/orders/types.ts`.

### Order Deadlines
- `pending_seller`: 24h reminder, 48h auto-decline + refund
- `accepted`: day 3 reminder, day 5 auto-cancel + refund
- `shipped`: day 14 delivery reminder, day 21 auto-escalate (creates dispute)

## Invoicing Model
- Shipping = logistics service provided TO the seller (funded by buyer at checkout)
- Platform services invoice to seller: commission + shipping as 2 separate line items
- VAT follows seller's country for BOTH lines (Article 46 for commission, Article 50 for shipping)
- STG acts as commercial agent under PSD2 Article 3(b)

## Supported Markets
Latvia (LV), Lithuania (LT), Estonia (EE) — all from launch.
English UI only initially. Latvian locale added later.

## Testing
- Framework: Vitest with React Testing Library
- Test files co-located: `pricing.ts` → `pricing.test.ts`
- Convention: `describe` per function, `it` per behavior
- Test pure business logic, no mocking
- Use `vi.useFakeTimers()` for time tests; always `vi.useRealTimers()` in `afterEach`

## Shared Components
Always use these — do not write inline equivalents:

| Pattern | Component | Location |
|---------|-----------|----------|
| All buttons | `Button` (variants: primary, secondary, ghost, danger; sizes: sm, md, lg) | `@/components/ui` |
| Card wrappers | `Card`, `CardHeader`, `CardBody`, `CardFooter` | `@/components/ui` |
| Form inputs | `Input` (prefix, suffix, error), `Select` | `@/components/ui` |
| Modals / bottom sheets | `Modal` | `@/components/ui` |
| Condition & status badges | `Badge` (variants: default, success, warning, error, trust, auction; condition keys; `dot` prop for status dots) | `@/components/ui` |
| Category & mechanic tags | `Badge variant="default"` | `@/components/ui` |
| Alerts & banners | `Alert` (variants: error, success, warning, info; dismissible; optional icon + title) | `@/components/ui` |
| User avatars / initials | `Avatar` (sizes: sm, md) | `@/components/ui` |
| Loading placeholders | `Skeleton` | `@/components/ui` |
| Loading spinners | `Spinner` (sizes: sm, md, lg) | `@/components/ui` |
| Empty / no-results states | `EmptyState` (icon, title, description, action, secondaryAction) | `@/components/ui` |
| Back navigation | `BackLink` (href, label; arrow + text, muted with brand hover) | `@/components/ui` |
| Breadcrumb navigation | `Breadcrumb` (items: { label, href? }[]) | `@/components/ui` |
| Pagination | `Pagination` (currentPage, totalPages, totalItems, pageSize, buildUrl) | `@/components/ui` |
| State-based tabs | `Tabs` (tabs, activeTab, onTabChange; underline style with counts) | `@/components/ui` |
| Link-based tabs | `NavTabs` (tabs with href, variant: underline/pill; auto-detects active from pathname) | `@/components/ui` |
| Step progress | `Stepper` (steps with id/label, currentStep; progress bar + labels, mobile compact) | `@/components/ui` |
| Price formatting | `formatPrice()` / `formatCentsToCurrency()` | `@/lib/services/pricing` |
| Date formatting | `formatDate()` etc. | `@/lib/date-utils` |
| Country display | Country utilities | `@/lib/country-utils` |
| Bot protection | `TurnstileWidget` (invisible; auto-resets on expiry; graceful skip when unconfigured) | `@/components/ui` |
| Social sharing | `ShareButtons` (copy link + native share; pass full URL from server component) | `@/components/ui` |
| Phone number input | `PhoneInput` (label, value, onChange, defaultCountry, error; Baltic flag+prefix selector) | `@/components/ui` |
| Game thumbnail | `GameThumb` (src, alt, size: sm/md/lg/xl; BGG-aware) | `@/components/listings/atoms` |
| Game title | `GameTitle` (name, size, serif; display font by default) | `@/components/listings/atoms` |
| Game metadata | `GameMeta` (year, publisher; middot-separated) | `@/components/listings/atoms` |
| Price display | `Price` (cents, size; always Inter, never display font) | `@/components/listings/atoms` |
| Game identity row | `GameIdentityRow` (thumbnail + name + edition metadata icons; bare row, caller wraps in Card; size, href, action slot) | `@/components/listings/atoms` |
| Compact listing row | `ListingRow` (horizontal; uses atoms) | `@/components/listings` |
| Mobile listing card | `ListingCardMini` (compressed for 2-col mobile grid) | `@/components/listings` |
| Truncated text | `ShowMoreText` (lines, children, className; line-clamp with "Show more/less" toggle; auto-detects if truncation needed) | `@/components/ui` |
| Truncated list | `ShowMoreList` (maxItems, label, children; shows first N items with "Show all N {label}" toggle) | `@/components/ui` |
| Auction bid guard | `isAuctionWithBids(listingType, bidCount)` — use instead of inline `=== 'auction' && > 0` | `@/lib/listings/types` |
| Enriched game builder | `buildEnrichedGame(bggGameId, gameName, gameYear, games)` — builds `EnrichedGame` from DB row with games join | `@/app/[locale]/sell/_components/GameSearchStep` |

## Design System Rules
- **Use existing components first.** Before writing any UI element, check if a shared component exists in `@/components/ui`. If it does, use it. If it doesn't and the pattern appears in 2+ places, create a new shared component.
- **No hardcoded colors.** Never use raw Tailwind color classes (`red-600`, `amber-500`, `blue-100`). Always use semantic tokens (`semantic-error`, `semantic-warning`, `semantic-primary`) or design palette tokens (`aurora-*`, `frost-*`, `condition-*`).
- **No inline button/card/input styling.** If it looks like a button, use `<Button>`. If it's a bordered content area, use `<Card>`. If it's a text field, use `<Input>` or `<Select>`.
- **Heading hierarchy:** Page-section H2 = `text-xl sm:text-2xl font-semibold font-display tracking-tight`. Card-subsection H2 = `text-base font-semibold` (Inter, no `font-display`).
- **Typography:** `font-display` (Fraunces) is for headings and game identity text only. Never for body, labels, buttons, prices, badges, or UI chrome. Prices always use `font-sans` (Inter).
- **Brand colors:** Interactive elements (links, focus rings, active states) use `semantic-brand` (teal). Purchase-intent CTAs (Buy, Checkout, Sell) use `semantic-primary` (orange).
- **Badge shape:** `rounded-md` (squared), not pills. Condition badges include a Phosphor tier icon.
- **Image containers:** Game art uses `aspect-square`, not fixed heights.
- **Transitions:** All transitions use branded easing — `duration-250 ease-out-custom` or `duration-350 ease-out-custom`.
- **When adding a new UI component:** Add it to `@/components/ui/index.ts`, update the Shared Components table above, and flag in PR description that a new design system component was introduced.

## BGG Integration
- BGG is the cornerstone of listing identity — game search, metadata, images, player count
- Listing creation flow: search BGG → select game → auto-fill title, image, player count → add photos → set condition/price
- Server-side only: BGG API calls go through API routes, never from client
- XML API v2 with `fast-xml-parser` for parsing
- HTML entity decoding with `he` library (BGG data contains entities like `&#039;`)
- Expansion filtering: classify games via inbound/outbound links to show only base games in search
- Key files: `src/lib/bgg/` (types, API client, config, utils, errors, classifier)

## Games Table Architecture
- `games` table is the central game catalog — populated via BGG CSV import (~170k games)
- Uses BGG ID as INTEGER primary key (not UUID)
- Listings reference games via `bgg_game_id` FK (ON DELETE RESTRICT) — only real BGG games can be listed
- Metadata (images, descriptions, player count) lazily enriched via `ensureGameMetadata()` on first listing
- Game search for listing creation hits the local database, not BGG API directly
- CSV import: `scripts/import-bgg-csv.ts` reads `boardgames_ranks.csv`
- RLS: public read-only, writes via service role only

## Edition/Version Tracking
- Every listing has `version_source`: 'bgg' (from BGG versions API) or 'manual' (user-entered)
- BGG versions provide: publisher, language, edition year, BGG version ID
- Manual fallback: user enters publisher/language/year when BGG API unavailable or version not found
- `language` field is critical — determines which edition the buyer receives (essential for Baltic market)
- Types: `ManualVersion` (id: 0 sentinel, isManual: true), `VersionSelection` union, `isManualVersion()` guard

## Seller Shelves
Sellers showcase their board game collection publicly. Each shelf item can be:
- **not_for_sale** — display only
- **open_to_offers** — buyers propose prices via structured offers
- **listed** — linked to an active listing

### Offer Flow
Buyer makes offer → seller accepts/counters/declines → if accepted, seller creates listing (game + price locked) → standard checkout. Single-round counters (no ping-pong). 7-day offer expiry, 3-day listing deadline after acceptance.

### Key Files
- `src/lib/shelves/` — types, constants (visibility, offer status badges, TTLs)
- `src/lib/shelves/actions.ts` — shelf CRUD (add/remove/update items, BGG import)
- `src/lib/offers/actions.ts` — offer lifecycle (make, counter, accept, decline, cancel)
- `src/components/offers/` — OfferCard, MakeOfferModal

### Shelf ↔ Listing Sync
- Regular listing created → auto-links to shelf item, declines stale offers, emails buyers
- Listing from offer → completes offer, links shelf item, emails buyer
- Listing cancelled → shelf item reverts to open_to_offers
- Order completed → shelf item set to not_for_sale

## Key Files
- `src/middleware.ts` - Auth and i18n routing
- `src/lib/supabase/` - Database clients
- `src/lib/services/` - Business logic (pricing, checkout, wallet)
- `src/lib/bgg/` - BoardGameGeek API integration
- `src/lib/env.ts` - Typed environment variables
- `src/styles/tokens.ts` - Design system tokens

## Supported Languages
English (default). Latvian (lv) added ~Week 3-4.

## Cron Routes
All `/api/cron/*` routes follow the same pattern:
- **Method**: `POST` (not GET)
- **Auth**: `Authorization: Bearer ${CRON_SECRET}` header (not query params)
- **Coolify command**: `curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/<name>`
- **Auth check**: `request.headers.get('authorization') !== \`Bearer ${env.cron.secret}\`` → 401

Existing cron routes: `expire-reservations` (5min), `reconcile-payments` (5min, reconciles orphaned checkout sessions + retries failed wallet debits), `end-auctions` (1min), `cleanup-sessions` (10min, skips sessions with payment references), `sync-tracking` (15min), `auction-payment-deadline` (30min), `enforce-deadlines` (2h), `auto-complete` (6h), `expire-offers` (6h, handles both shelf + wanted offers), `cleanup-notifications` (weekly). See `src/app/api/cron/` for implementations.

## Branching Workflow
- Multi-file features: always use `feature/<name>` branch + PR to main
- Trivial single-file fixes: direct commits to main are acceptable
- Always delete feature branches (local + remote) after merging

## In-App Notifications
- Every email event also creates an in-app notification via `notify(userId, type, context)` from `@/lib/notifications`
- Fire-and-forget pattern (same as `logAuditEvent`) — never blocks the main operation
- 38 notification types with prefixes: `order.`, `comment.`, `offer.`, `dispute.`, `shipping.`, `auction.`, `wanted.`
- Copy centralized in `src/lib/notifications/templates.ts` — integration sites pass type + context, not strings
- Bell icon in header (desktop dropdown, mobile link to `/account/notifications`)
- Polling on pathname change for unread count (consistent with message unread badge)

## Server Action Error Handling
- Server actions return `{ success: true }` or `{ error: string }` — never throw to the client
- API routes return `NextResponse.json({ error: string }, { status: 4xx/5xx })`
- Validation errors return early with descriptive messages
- Internal errors: `console.error` + generic user-facing message
- Non-blocking side effects (emails, notifications, audit): use `void fn().catch(...)` pattern

## Important Notes
- `pnpm build` is the real deploy gate, not `pnpm type-check` alone
- Supabase RLS policies control data access — never skip them
- Supabase SSR cookies: use `getAll()`/`setAll()`, never `get()`/`set()`
- VAT rates by seller's country: LV=21%, LT=21%, EE=24%
