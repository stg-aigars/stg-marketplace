# Project Context

## Overview
Second Turn Games - Nordic-minimalist peer-to-peer board game marketplace for the Baltic region (Latvia, Lithuania, Estonia). "Every game deserves a second turn."

Launch philosophy: Start with basics across all three markets. Users grow with the platform. The marketplace is only as good as its community, and the community builds alongside the product.

## Tech Stack
- Next.js 16 (App Router, Turbopack build) with TypeScript, React 19
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
- `pnpm build` - Production Next.js build only. NOT a sufficient pre-deploy gate on its own — `next build` only type-checks code reachable from the app graph, so test files, scripts, and other auxiliary TS can drift unseen. Use `pnpm verify` before pushing.
- `pnpm verify` - **Pre-deploy gate.** Runs `pnpm type-check && pnpm lint && pnpm test && pnpm build`. Covers everything in `tsconfig.json`'s include set (including test files), all lint rules, the full test suite, and the production build. Run before pushing or merging.
- `pnpm test` - Run Vitest test suite
- `pnpm lint` - Run ESLint
- `pnpm type-check` - TypeScript validation across the full `tsconfig.json` include set (test files, scripts, etc. that `next build` skips)

## Safety
- Before executing any database migration, SQL command, or deployment operation, verify you are operating on the correct environment (correct Supabase project, correct database, correct branch)
- If changes were made to files, commit and push to the current branch before reporting the task complete. Never report "done" with uncommitted or unpushed changes in the working tree
- For any change spanning 3+ files, state the approach and the files you've read before writing code. For changes touching database schema, auth flows, or payment flows, additionally wait for confirmation before implementing

## Code Style
- Use ES modules (import/export)
- Prefer Server Components; use 'use client' only when needed (interactivity, hooks, browser APIs)
- Path alias: `@/*` maps to `src/`
- Phosphor Icons: always import **runtime values** (icon components like `Package`, `Wallet`) from `@phosphor-icons/react/ssr` (even in client components). The base path has a double-barrel import that defeats tree-shaking. **Type-only imports** are exempt: `import type { Icon } from '@phosphor-icons/react'` is fine — type imports are erased at compile time, so tree-shaking doesn't apply, and `Icon` / `IconProps` / `IconWeight` are only exported from the base path anyway.
- Follow existing patterns in codebase
- All monetary values as INTEGER CENTS (never floats). 1299 not 12.99
- Be careful with Server Component / Client Component boundaries. Never pass React component functions as props from Server Components to Client Components. Never call hooks unconditionally where refs may be null
- When refactoring or simplifying code, do not remove imports, guards, or behavioral logic without verifying they are truly unused. Run `pnpm verify` after any simplification pass

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
- H1 page headings: `text-2xl sm:text-3xl font-black tracking-tight` (Rubik @ 900 — heaviest weight carries platform voice)
- H2 section headings: `text-xl sm:text-2xl font-bold tracking-tight` (Rubik @ 700)
- H2 card subsections: `text-base font-semibold` (Rubik @ 600)
- Game identity (game titles, listing detail H1, wanted detail H1, GameTitle atom): `font-display` (Fraunces) — see "Typography" rule below
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
- VAT follows seller's country for BOTH lines (confirmed by accountant in `docs/legal_audit/accountant-vat-confirmation.md`). Commission is an electronically supplied service under Article 7 of Implementing Regulation (EU) 282/2011; place of supply per Article 58 of Directive 2006/112/EC. Shipping re-supply falls under Articles 49 (domestic) and 50 (cross-border) of the same Directive — rate outcome identical (seller's country) but article reference varies by scenario; public disclosure cites both
- Fund flow through EveryPay (Maksekeskus AS, licensed Estonian PI). STG relies on the Art. 3(b) commercial-agent exemption of Directive (EU) 2015/2366 (PSD2) as a transitional framing, with `PSD2_TRANSITIONAL_SUNSET = 2026-10-26` enforced by `src/lib/legal/constants.test.ts`. Option 1 scoping with Maksekeskus (collecting-account model) is the target architecture before sunset; see `docs/legal_audit/lawyer-response.md` §A.2

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
| All buttons | `Button` (variants: primary, brand, secondary, ghost, danger; sizes: sm, md, lg; `asChild` renders styling on child element — use with `<Link>`) | `@/components/ui` |
| Card wrappers | `Card`, `CardHeader`, `CardBody`, `CardFooter` | `@/components/ui` |
| Form inputs | `Input` (prefix, suffix, error), `Select` | `@/components/ui` |
| Modals / bottom sheets | `Modal` | `@/components/ui` |
| Condition & status badges | `Badge` (variants: default, success, warning, error, trust, auction, wanted; condition keys; `dot` prop for status dots) | `@/components/ui` |
| Condition badge (from DB) | `ConditionBadge` (takes raw `ListingCondition` string, renders Badge with icon + label; use instead of manual `conditionToBadgeKey` + `conditionConfig` lookup) | `@/components/ui` |
| Category & mechanic tags | `Badge variant="default"` | `@/components/ui` |
| Alerts & banners | `Alert` (variants: error, success, warning, info; dismissible; optional icon + title) | `@/components/ui` |
| User avatars / initials | `Avatar` (sizes: xs, sm, md; optional `src` for image with initials fallback) | `@/components/ui` |
| User identity row | `UserIdentity` (avatar + name + flag inline; `href` for linked name, `children` for badges) | `@/components/ui` |
| Loading placeholders | `Skeleton` | `@/components/ui` |
| Loading spinners | `Spinner` (sizes: sm, md, lg) | `@/components/ui` |
| Empty / no-results states | `EmptyState` (icon, title, description, action, secondaryAction) | `@/components/ui` |
| Back navigation | `BackLink` (href, label; arrow + text, muted with brand hover) | `@/components/ui` |
| Section nav link | `SectionLink` (href, children, optional `color` override; brand teal + right arrow; use next to section headings — "Browse all", "Read more") | `@/components/ui` |
| Breadcrumb navigation | `Breadcrumb` (items: { label, href? }[]) | `@/components/ui` |
| Pagination | `Pagination` (currentPage, totalPages, totalItems, pageSize, buildUrl) | `@/components/ui` |
| State-based tabs | `Tabs` (tabs, activeTab, onTabChange; underline style with counts) | `@/components/ui` |
| Link-based tabs | `NavTabs` (tabs with href, variant: underline/pill; auto-detects active from pathname) | `@/components/ui` |
| Step progress | `Stepper` (steps with id/label, currentStep; progress bar + labels, mobile compact) | `@/components/ui` |
| Price formatting | `formatPrice()` / `formatCentsToCurrency()` | `@/lib/services/pricing` |
| Date formatting | `formatDate()` etc. | `@/lib/date-utils` |
| Country display | Country utilities | `@/lib/country-utils` |
| Checkbox with label | `Checkbox` (checked, onChange, children, disabled; label-wrapping layout) | `@/components/ui` |
| Bot protection | `TurnstileWidget` (invisible; auto-resets on expiry; graceful skip when unconfigured) | `@/components/ui` |
| Brand inline links | `.link-brand` CSS class (teal, underline, branded hover transition) | `globals.css` |
| Safe redirect URL | `safeReturnUrl(url)` — prevents open redirects, allows relative paths only | `@/lib/auth/safe-return-url` |
| Social sharing | `ShareButtons` (copy link + native share; pass full URL from server component) | `@/components/ui` |
| Phone number input | `PhoneInput` (label, value, onChange, defaultCountry, error; Baltic flag+prefix selector) | `@/components/ui` |
| Game thumbnail | `GameThumb` (src, alt, size: sm/md/lg/xl; BGG-aware) | `@/components/listings/atoms` |
| Game title | `GameTitle` (name, size, serif; display font by default) | `@/components/listings/atoms` |
| Game metadata | `GameMeta` (year, publisher; middot-separated) | `@/components/listings/atoms` |
| Price display | `Price` (cents, size; always Rubik, never display font) | `@/components/listings/atoms` |
| Game identity row | `GameIdentityRow` (thumbnail + name + edition metadata icons; bare row, caller wraps in Card; size, href, action slot) | `@/components/listings/atoms` |
| Listing identity | `ListingIdentity` (compact horizontal row: linked thumb + title + expansion count + price slot + action slot; `disableLink` for parent-linked contexts; `disabled` for unavailable items) | `@/components/listings/atoms` |
| Compact listing row | `ListingRow` (horizontal; wraps `ListingIdentity` in bordered container with condition label) | `@/components/listings` |
| Mobile listing card | `ListingCardMini` (compressed for 2-col mobile grid) | `@/components/listings` |
| Listing card grid | `ListingSection` (heading, optional link, responsive grid of `ListingCard`; `emptyState`, `className`, `linkClassName` overrides) | `@/components/listings` |
| Truncated text | `ShowMoreText` (lines, children, className; line-clamp with "Show more/less" toggle; auto-detects if truncation needed) | `@/components/ui` |
| Truncated list | `ShowMoreList` (maxItems, label, children; shows first N items with "Show all N {label}" toggle) | `@/components/ui` |
| Staff delete button | `DeleteItemButton` (onDelete callback, title; icon trigger + confirm/cancel flow) | `@/components/ui` |
| Icon count badge | `CountBadge` (count, className; 0 hides) | `@/components/ui` |
| Auction bid guard | `isAuctionWithBids(listingType, bidCount)` — use instead of inline `=== 'auction' && > 0` | `@/lib/listings/types` |
| Enriched game builder | `buildEnrichedGame(bggGameId, gameName, gameYear, games)` — builds `EnrichedGame` from DB row with games join | `@/app/[locale]/sell/_components/GameSearchStep` |
| DAC7 blocked banner | `Dac7BlockedAlert` (error alert with link to tax settings; used on all sell-flow entry points) | `@/components/dac7` |

## Design System Rules
- **Use existing components first.** Before writing any UI element, check if a shared component exists in `@/components/ui`. If it does, use it. If it doesn't and the pattern appears in 2+ places, create a new shared component.
- **No hardcoded colors.** Never use raw Tailwind color classes (`red-600`, `amber-500`, `blue-100`). Always use semantic tokens (`semantic-error`, `semantic-warning`, `semantic-primary`) or design palette tokens (`aurora-*`, `frost-*`, `condition-*`).
- **No inline button/card/input styling.** If it looks like a button, use `<Button>`. If it's a bordered content area, use `<Card>`. If it's a text field, use `<Input>` or `<Select>`.
- **Button + Link:** Never nest `<Link>` inside `<Button>` (invalid `<a>` inside `<button>`). Use `<Button asChild><Link href="...">text</Link></Button>` — `asChild` renders Button styling on the Link element directly.
- **Heading hierarchy:** Page H1 = `text-2xl sm:text-3xl font-black tracking-tight`. Page-section H2 = `text-xl sm:text-2xl font-bold tracking-tight`. Card-subsection H2 = `text-base font-semibold` (all Rubik, weight is the contrast lever).
- **Typography (one display register + weight hierarchy):** Two fonts map to two semantic registers. Pick by *what the text represents*, not by visual weight.
  - **Rubik (default `font-sans`)** — platform voice and body. Variable weight 300–900 carries the entire UI. Heaviest weights (`font-black` 900, `font-bold` 700) signal platform chrome (wordmark, page H1s, section H2s, modal titles, marketing hero, empty-state titles, error fallbacks); medium weights (`font-medium` 500, `font-semibold` 600) carry interactive labels and card subsections; default (400) carries body. No `font-platform` Tailwind key — chrome and body share the same family, contrast is *weight*. Has no italic in our setup — never apply `italic` to chrome (browsers synthesize fake italic via skew, which looks bad at heavy weights).
  - **`font-display` (Fraunces)** — game / product voice. Use for: game titles (always via the `GameTitle` atom when possible), listing detail page H1 (`{listing.game_name}`), wanted listing detail H1, anywhere "this is a specific game" semantics. Variable weight + true italic available.
  - **Never** use `font-display` for body, labels, buttons, prices, badges, or UI chrome. Prices always use `font-sans` (Rubik).
  - **Failure mode discipline:** `font-display` falls back to Georgia, serif (so game identity stays serif if Fraunces fails). `font-sans` falls back to a system sans stack (so chrome and body stay legible if Rubik fails). Don't change either fallback chain casually.
- **Brand colors:** Interactive elements (links, focus rings, active states) use `semantic-brand` (teal). Purchase-intent CTAs (Buy, Checkout, Add to Cart) use `semantic-primary` (orange). Platform-action CTAs (Sell a game, seller dashboard entry points) use `Button variant="brand"` (teal, filled).
- **Badge shape:** `rounded-md` (squared), not pills. Condition badges include a Phosphor tier icon.
- **Image containers:** Game art uses `aspect-square`, not fixed heights.
- **Transitions:** All transitions use branded easing — `duration-250 ease-out-custom` or `duration-350 ease-out-custom`.
- **Class merging:** Shared UI components that accept `className` must merge classes via `cn()` from `@/lib/cn` — never via plain template literals (`` `${base} ${className}` ``). `cn()` wraps `tailwind-merge` + `clsx`, so caller overrides correctly win against component defaults regardless of CSS cascade order. Without it, `className` props silently lose to internal size/variant classes, and the only workaround is `!important` prefixes. Accepts strings, conditionals (`cond && 'class'`), arrays, and objects.
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

## Listing Comments
Public Q&A on listing detail pages. Flat thread, oldest first, no editing, max 1000 chars.
- `listing_comments` table: `user_id` FK `ON DELETE SET NULL` (anonymize, don't cascade)
- RLS: public SELECT (non-deleted), authenticated INSERT, no UPDATE (staff soft-delete via service role)
- Notifications: seller on new comment, previous commenters on seller reply (`comment.received`)
- Moderation: staff soft-delete via `deleteComment` → `logAuditEvent`
- Collapse: shows first 5 comments, "Show all N comments" toggle
- Key files: `src/lib/comments/`, `src/components/comments/`

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

Existing cron routes: `expire-reservations` (5min), `reconcile-payments` (5min, reconciles orphaned cart checkout groups + retries failed wallet debits), `auction-ending-soon` (5min, sends ending-soon notifications to bidders + seller 30min before auction end), `end-auctions` (1min), `cleanup-sessions` (10min, expires orphan cart checkout groups + unreserves their listings), `sync-tracking` (15min), `auction-payment-deadline` (30min), `enforce-deadlines` (2h), `auto-complete` (6h), `cleanup-photos` (6h, removes orphaned listing photos from storage), `dac7-reconcile` (daily, reconciles seller stats from completed orders + escalates DAC7 reminder/blocked statuses + year-start resets in January), `trader-signals` (daily, writes rolling 12-month sales/revenue counters to user_profiles + fires `seller.trader_signal_crossed` on first crossing of the 25-sales / €1,800-revenue verification trigger; advisory only — never auto-mutates `seller_status`), `verification-escalation` (daily, flips `verification_response` to `'unresponsive'` for sellers who haven't responded within 14d + fires `seller.verification_unresponsive`), `cleanup-notifications` (weekly), `cleanup-audit-log` (weekly, deletes `retention_class = 'operational'` audit log entries older than 30 days; `regulatory` entries are retained for 10 years per their originating obligations), `cleanup-login-activity` (daily, deletes `login_activity` rows older than 30 days per the lawyer-cleared GDPR Art. 6(1)(f) balancing test for fraud-prevention security logs — see `docs/legal_audit/ropa-login-activity.md`). See `src/app/api/cron/` for implementations.

## Branching Workflow
- Multi-file features: always use `feature/<name>` branch + PR to main
- Trivial single-file fixes: direct commits to main are acceptable
- Always delete feature branches (local + remote) after merging

## In-App Notifications
- Every email event also creates an in-app notification via `notify(userId, type, context)` from `@/lib/notifications`
- Fire-and-forget pattern (same as `logAuditEvent`) — never blocks the main operation
- 39 notification types with prefixes: `order.`, `comment.`, `dispute.`, `shipping.`, `auction.`, `wanted.`, `dac7.`
- Copy centralized in `src/lib/notifications/templates.ts` — integration sites pass type + context, not strings
- Bell icon in header (desktop dropdown, mobile link to `/account/notifications`)
- Polling on pathname change for unread count

## Analytics
- PostHog Cloud **EU** (Frankfurt), cookieless-always mode, reverse-proxied via `/ingest` to defeat ad blockers. Client config in `src/lib/analytics/posthog-client.ts`; server client in `src/lib/analytics/posthog-server.ts`
- Event types live in `src/lib/analytics/types.ts`. Extend `AnalyticsEventMap` to add a new event — never pass raw strings to the track wrappers
- Import: `import { trackClient } from '@/lib/analytics'` (client-safe barrel). Server callers import `trackServer` directly from `@/lib/analytics/track-server` — that file is marked `'server-only'` and pulls in `next/headers`, so it would poison any client bundle it touched
- Contract: fire-and-forget only. `trackServer` is called via `void trackServer(...)` and never blocks the main operation (same pattern as `logAuditEvent`). The wrapper awaits `client.shutdown()` internally so events flush before the request returns
- `identify()` is not available in cookieless mode. For authenticated flows pass Supabase `user.id` as `distinctId` on server-side captures
- Cookieless mode rotates its internal salt daily — weekly/monthly unique counts are inflated until ~60 days of baseline accrues. Do not compare uniques across weeks in the first two months
- `$pageview` captures locale-prefixed URLs (`/en/browse`). When Latvian lands, either strip the locale prefix before capture in `PostHogPageView` or group by a separate `$locale` property in dashboards
- `listing_viewed` and `search_performed` fire client-side; `checkout_started`, `order_completed`, `listing_created`, `signup_completed` fire server-side. Server events rely on dynamic rendering — if a future PPR/ISR migration touches checkout, listing creation, or the auth callback, event firing needs re-verification
- `signup_completed` uses a hybrid detection split by provider: email relies on `?signup=true` threaded through `emailRedirectTo` in `signUpWithEmail`; OAuth (Google, Facebook) relies on a 30s `created_at` freshness check in the auth callback. If you add a new auth provider, decide which pattern applies and wire it explicitly
- **If account-linking UX is added** (signed-in user links a second provider from account settings), revisit the auth-callback detection. Link events also land on `/auth/callback` and can update `app_metadata.provider` on an existing user — the freshness check correctly won't false-fire (ancient `created_at`), but link flows become a separate analytics question worth its own event (`identity_linked`) rather than being conflated with signup
- CSP: PostHog origins (`eu.i.posthog.com`, `eu-assets.i.posthog.com`) are in `connect-src` in `src/lib/csp.ts` defensively. The middleware `config.matcher` excludes `/ingest/` — there's a protective comment there explaining why; do not remove it
- Session replay, feature flags, A/B testing, surveys: deferred until post-launch baseline accrues

## Audit Events
- Persistent audit trail for compliance-relevant and financial actions. Table: `audit_log` (migration `020_audit_log.sql`, `retention_class` column added in migration 084 + tightened in 085). Helper: `logAuditEvent({ actorId, actorType, action, resourceType, resourceId, metadata, retentionClass })` in `src/lib/services/audit.ts`
- Fire-and-forget: `void logAuditEvent(...)` — never blocks the main operation, errors logged but never thrown
- `action` is freeform TEXT (no CHECK constraint); convention is `resource.verb_past_tense` (e.g. `order.status_changed`, `dispute.opened`, `shipment.cancelled`, `terms.accepted`). `actor_type` has a CHECK — must be `'user' | 'system' | 'cron'`. `retention_class` is `'operational'` (30-day cleanup) or `'regulatory'` (10-year retention) — required, no default; the cleanup-audit-log cron only deletes `retention_class = 'operational'` rows.
- `resourceType` + `resourceId` feed the `idx_audit_log_resource` index; prefer a shape that makes future compliance queries cheap (e.g. `resourceType: 'terms', resourceId: TERMS_VERSION` lets you ask "who accepted version X?" with an index scan)
- **Canonical register discipline**: this file is the source of truth for which events are regulatory vs operational. Every new event type added to a `logAuditEvent` call site must be registered here with its retention class **before or with** the emission site's PR. PRs that add a new event without the register entry get bounced — without this, the regulatory bucket silently leaks events as the codebase evolves.
- **Registered events** (each entry annotated with `retention_class`):
  - `terms.accepted` (retention: regulatory) — fires at email signup (`source: 'signup'` in metadata) and at OAuth onboarding when the user completes `CompleteProfileForm` (`source: 'oauth_onboarding'`). The OAuth path is gated by `.select('id')` on the profile update so the event only fires when `terms_accepted_at` actually flips from null — no duplicate events on repeat calls. `resourceId` is `TERMS_VERSION` captured at the moment of acceptance; the constant import resolves to a literal at call time, so the historical version is preserved even if we later bump `TERMS_VERSION`
  - `dsa_notice.received` (retention: regulatory; renamed from `illegal_content.reported` in migration 079_dsa_notices) — fires from `/api/report-illegal-content` when a DSA Art. 16 notice lands. `actorType: 'system'` (external inbound submission, not a platform-initiated user action — even named notifiers are unauthenticated visitors). `resourceType: 'dsa_notice'`, `resourceId` = the persisted `dsa_notices.id` row (Phase 5 added the queue; pre-Phase-5 rows have `resourceId IS NULL`). Metadata carries `category` (now includes `misleading_listing` for marketplace-specific harm), `anonymous: boolean`, `notifierEmail`, a truncated `contentReferencePreview` for triage visibility, and `listingId` (nullable — staff dashboard treats `metadata->>'listingId' IS NULL` as a valid "non-listing-bound" case, not a data bug). Companion email forwarded to `LEGAL_ENTITY_EMAIL` via Resend, plus a `notifyStaff('moderation.notice_received', ...)` fan-out so staff sees the queue without polling
  - `listing.actioned_by_staff` (retention: regulatory) — fires from the staff dashboard "Action listing" handler at `/staff/notices` when staff resolves a notice by cancelling the bound listing. `actorType: 'user'`, `actorId` = staff user. `resourceType: 'listing'`, `resourceId` = the actioned listing. Metadata: `{ noticeId, action: 'soft_delete'|'edit'|'flag_only', reasonCategory, reasonText, statementOfReasonsSentAt }`. Companion `notify(sellerId, 'listing.actioned', ...)` delivers the DSA Art. 17 statement of reasons to the affected seller. The `dsa_notice.received` + `listing.actioned_by_staff` pair is the defensible audit record of "received notice → made decision → reasons given."
  - `seller.status_changed` (retention: regulatory) — fires from staff suspension UI at `/staff/users/[id]` when staff transitions `seller_status`. `actorType: 'user'`, `actorId` = staff user. `resourceType: 'user'`, `resourceId` = sellerId. Metadata: `{ from, to, reason, actorStaffId, inFlightReservedCount, inFlightAuctionEndedCount }` — the in-flight counts capture what was deliberately not paused per the trigger asymmetry (reserved/auction_ended listings keep transacting on suspension)
  - `seller.trader_signal_crossed` (retention: regulatory) — fires from the daily `trader-signals` cron when a seller's rolling 12-month counters first cross the verification trigger (25 sales OR €1,800 revenue per `TRADER_THRESHOLDS`). `actorType: 'cron'`. `resourceType: 'user'`, `resourceId` = sellerId. Metadata: `{ count, revenue_cents, threshold_version, enforcement: 'advisory'|'automatic', triggered_by: 'sales'|'revenue'|'both' }`. Advisory at launch — does not mutate `seller_status` and does not notify the seller. See `docs/legal_audit/trader-detection-deferral.md` for the lawyer's framework
  - `seller.verification_requested` (retention: regulatory) — fires from staff dashboard "Send verification request" action when staff dispatches the soft-touch verification email to a seller whose signal has crossed. `actorType: 'user'`, `actorId` = staff user. `resourceType: 'user'`, `resourceId` = sellerId. Metadata: `{ staff_id, sales_count, revenue_cents }`
  - `seller.verification_responded` (retention: regulatory) — fires from `/account/seller-verification` when the seller submits their self-classification. `actorType: 'user'`, `actorId` = sellerId. `resourceType: 'user'`, `resourceId` = sellerId. Metadata: `{ response: 'collector'|'unresponsive', responded_within_days }`. The form is **binary** by design (lawyer 2026-04-28, Option B): a structured "I'm a trader" radio would create a DSA Art. 30 trap (knowing = liability on a private-only platform). Commercial sellers reply to the verification email and the support team handles wind-down — no `verification_response='trader'` is written by the user-facing form. The `'trader'` value remains valid in the DB CHECK constraint for staff-side annotation if needed; see `docs/legal_audit/trader-detection-deferral.md`
  - `seller.verification_unresponsive` (retention: regulatory) — fires from the daily `verification-escalation` cron after `TRADER_THRESHOLDS.verificationResponseDeadlineDays` (14d) without a response. `actorType: 'cron'`. `resourceType: 'user'`, `resourceId` = sellerId. Metadata: `{ requested_at, escalation_days: 14 }`. Idempotent — re-running the cron does not double-set `verification_response`
  - `seller.trader_signal_dismissed` (retention: regulatory) — fires from staff "Dismiss signal" with rationale modal at `/staff/users/[id]`. **Mandatory per lawyer 2026-04-28** — without this, "why didn't you act on the 45-sale seller" has no defensible answer. `actorType: 'user'`, `actorId` = staff user. `resourceType: 'user'`, `resourceId` = sellerId. Metadata: `{ rationale: { category: 'verified_collector'|'low_engagement_pattern'|'marketplace_norm'|'other', justification, evidenceUrl? }, sellerCountAtDismissal, sellerRevenueAtDismissal, verificationResponse, signalThresholdVersion }`. **Dismissal persistence** uses a sentinel column pattern: dismissal stamps `user_profiles.trader_signal_dismissed_at` + `trader_signal_dismissed_threshold_version` (added in migration 083). The `trader-signals` cron's first-crossing guard requires `trader_signal_dismissed_threshold_version` to be either null or different from `TRADER_THRESHOLDS.version`, so a dismissal at one threshold version doesn't suppress signals after the threshold is bumped. Do NOT clear `trader_signal_first_crossed_at` to mark dismissal — the rolling 12-month counters don't reset, so the cron would re-fire the signal next day (this exact bug was caught in the post-implementation-review of PR #214)
  - `oss.submission_recorded` (retention: regulatory) — fires from `recordOssSubmission` server action at `/staff/oss` when staff "Mark filed" a quarterly OSS declaration. `actorType: 'user'`, `actorId` = staff user. `resourceType: 'oss_submission'`, `resourceId` = the new `oss_submissions.id` row. Metadata: `{ quarter_start, quarter_end, declared_amounts: { LT?: { net_cents, vat_cents, order_count }, EE?: ... }, payment_reference, source: 'mark_filed' }`. The `oss_submissions` table is append-only (DB-trigger enforced); amendments insert a new row pointing at the superseded one via `supersedes_submission_id`. 10-year retention per Article 369k of Directive 2006/112/EC. Migration 087.
  - `oss.submission_amended` (retention: regulatory) — fires when an amendment row is inserted with non-null `supersedes_submission_id`. Same shape as `oss.submission_recorded` plus `metadata.supersedes_submission_id` and `metadata.amendment_reason`. (Future PR — flow not yet implemented; event registered here so the canonical-register discipline holds.)
  - `oss.payment_recorded` (retention: regulatory) — fires when `oss_submissions.payment_cleared_at` and/or `confirmation_url` are set via the narrow UPDATE policy. Metadata: `{ payment_cleared_at, confirmation_url, payment_reference }`. (Future PR — payment-recording flow not yet implemented; event registered here so the canonical-register discipline holds.)
  - `seller_terms.accepted` (retention: regulatory) — fires from the Seller Terms acceptance gate at `/sell` (Phase 2 PR 2B-3) when a would-be seller accepts the Seller Agreement. `resourceId` captures `SELLER_TERMS_VERSION` at the moment of acceptance so the historical version is preserved across future bumps. Metadata: `{ source: 'sell_gate', previous_version: string | null }` — `previous_version` is `null` on first acceptance and the prior version string on re-acceptance after a `SELLER_TERMS_VERSION` bump. Always-present key convention: the `previous_version` key is always set (never omitted), so filters read cleanly as `metadata->>'previous_version' IS NOT NULL` for re-accept queries
  - Additional registered events (financial / dispute / lifecycle / moderation), each with their `retention_class`:
    - `order.refunded` (regulatory) — fires from `processRefund` in `order-refund.ts`. Source for OSS prior-period adjustments.
    - `payment.refunded` (regulatory) — fires from `attemptAutoRefund` in `payment-fulfillment.ts`. EveryPay-side refund record.
    - `payment.cart_completed` (regulatory) — fires when an EveryPay cart payment lands and orders are created in `payment-fulfillment.ts`.
    - `payment.cart_wallet_completed` (regulatory) — fires when a wallet-funded cart payment completes in `cart-wallet-pay/route.ts`.
    - `payment.cart_created` (regulatory) — fires when a cart payment intent is created in `cart-create/route.ts`.
    - `wallet.credit` / `wallet.debit` / `wallet.refund` / `wallet.withdrawal_requested` (all regulatory) — fire from `src/lib/services/wallet.ts`. Financial ledger; accountant retention applies.
    - `dispute.opened` / `dispute.escalated` / `dispute.staff_resolved` / `dispute.seller_accepted_refund` / `dispute.withdrawn` (all regulatory) — fire from `src/lib/services/dispute.ts`. Multi-year contract-resolution audit chain.
    - `order.delivery_escalated` (regulatory) — fires from the deadlines cron in `order-deadlines.ts` when a 21-day no-delivery window auto-creates a dispute. The cron also fires a regulatory `dispute.opened` companion against the inserted dispute row, so the contract-resolution audit chain is symmetric with manual `openDispute()` calls.
    - `order.auto_cancelled.{reason}` (regulatory) — fires from the deadlines cron when a deadline expires (e.g. `response_timeout`, `shipping_timeout`). Action string is dynamic; the migration 084 backfill matches via `LIKE 'order.auto_cancelled.%'`. Triggers a refund chain.
    - `order.status_changed` (operational) — derivative of `orders.status` column. Fires from order-transitions, tracking-service. 30-day retention is sufficient because the canonical state is on the orders table.
    - `order.parcel_returning` (operational) — fires from the tracking sync when a parcel is returning to sender and triggers an auto-escalation. The auto-escalation also inserts a dispute row and fires a regulatory `dispute.opened` companion; the operational row here is the tracking-side trigger record.
    - `shipment.cancelled` (operational) — fires from `unisend/shipping.ts` when a parcel is cancelled. Pure shipping operational signal.
    - `comment.deleted` (operational) — fires from `comments/actions.ts` when staff soft-deletes a listing comment. If the deletion is bound to a DSA notice, the regulatory `listing.actioned_by_staff` companion event fires alongside.
    - `order_message.deleted` (operational) — fires from `order-messages/actions.ts` when staff soft-deletes an order-message. Same companion-event pattern as `comment.deleted`.
    - `login_activity.staff_viewed` (operational) — fires from `/staff/audit/security` when staff drills into a specific user's login history. `actorType: 'user'`, `actorId` = staff user. `resourceType: 'user'`, `resourceId` = the inspected user's id. Backs the ROPA balancing-test claim that staff reads of the security log are themselves audit-trailed (see `docs/legal_audit/ropa-login-activity.md`).

## Server Action Error Handling
- Server actions return `{ success: true }` or `{ error: string }` — never throw to the client
- API routes return `NextResponse.json({ error: string }, { status: 4xx/5xx })`
- Validation errors return early with descriptive messages
- Internal errors: `console.error` + generic user-facing message
- Non-blocking side effects (emails, notifications, audit): use `void fn().catch(...)` pattern

## Important Notes
- `pnpm verify` is the real deploy gate (`type-check && lint && test && build`). `pnpm build` alone only type-checks app-graph code, so test files / scripts can drift unseen — that's how 24 type errors accumulated invisibly before the gate was added
- Supabase RLS policies control data access — never skip them
- Supabase SSR cookies: use `getAll()`/`setAll()`, never `get()`/`set()`
- VAT rates by seller's country: LV=21%, LT=21%, EE=24%
- Supabase advisor recommendations are starting points, not blanket fixes. Always cross-check with the unauthenticated route list before applying. We've already had two regressions of this shape — games search and listing detail seller info.
- Check existing database columns and schema before suggesting joins or workarounds — the column may already exist
- In RPC functions using raw SQL ILIKE: use `!` as the ESCAPE character, not backslash (`standard_conforming_strings` makes `\` literal). See `046_alternate_name_search.sql` for the canonical escape pattern. For PostgREST `.ilike()` calls: the wildcard is `%` (standard SQL) and user input containing literal `%` or `_` should be escaped before interpolation

## RLS Policies and Anonymous Access
Supabase security advisors recommend tightening RLS, but they don't know which routes are public. Every SELECT policy that adds an `auth.uid() IS NOT NULL` predicate must be evaluated against the unauthenticated route list (homepage, browse, listing detail, seller pages, sitemap, JSON-LD, robots). If any anon-reachable route reads the table:
- **If the table contains any sensitive columns:** create or use a `public_<thing>` view exposing only safe columns, run it in definer mode (`security_invoker = false`), and grant SELECT only to `anon, authenticated`. The `public_profiles` view is the canonical example.
- **If every column is genuinely public:** add an anon-permissive SELECT policy directly on the table.

Never expose `user_profiles`, `orders`, `wallet_*`, `dac7_*`, or any PII/payout/tax table directly to the `anon` role. Never use the service role from an anon-reachable API route as a workaround for missing RLS.

### Known Advisor False-Positives
- `public_profiles` view: Supabase advisor will flag this as "defined with SECURITY DEFINER property" and recommend adding `security_invoker = true`. **Do not apply this recommendation.** The view must remain in definer mode to read through `user_profiles` RLS for anonymous visitors. See `COMMENT ON VIEW public.public_profiles` in migration 062 for full rationale.

## Test Infrastructure Gaps
- **Anon RLS regression tests:** No integration test harness exists to verify that anon-reachable routes (listing detail, browse, seller pages, sitemap) return correct data through RLS-gated views like `public_profiles`. Two regressions of this shape so far (games search, listing detail seller info). Needs: a test Supabase project or local Supabase instance, an anon client fixture, and assertions on returned data shape.
