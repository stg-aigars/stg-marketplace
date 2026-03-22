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
- Card image heights: `h-40 sm:h-44 lg:h-48`
- H1 page headings: `text-2xl sm:text-3xl font-bold`
- H2 section headings: `text-xl sm:text-2xl font-semibold`
- Borders: `border` (1px default); `border-2` only for selected/active states
- Shadows: `shadow-sm` (resting) → `shadow-md` (hover) → `shadow-lg` (dropdowns) → `shadow-xl` (modals)
- Colors: Never hardcode hex values — use Tailwind design token classes

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
                    ↓           ↓          ↓
                cancelled   cancelled   disputed → resolved
```

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
| Form inputs | `Input`, `Select` | `@/components/ui` |
| Modals / bottom sheets | `Modal` | `@/components/ui` |
| Condition & status badges | `Badge` (variants: default, success, warning, error, trust; condition keys) | `@/components/ui` |
| Category & mechanic tags | `Badge variant="default"` | `@/components/ui` |
| Alerts & banners | `Alert` (variants: error, success, warning, info; dismissible) | `@/components/ui` |
| User avatars / initials | `Avatar` (sizes: sm, md) | `@/components/ui` |
| Loading placeholders | `Skeleton` | `@/components/ui` |
| Price formatting | `formatPrice()` / `formatCentsToCurrency()` | `@/lib/services/pricing` |
| Date formatting | `formatDate()` etc. | `@/lib/date-utils` |
| Country display | Country utilities | `@/lib/country-utils` |
| Bot protection | `TurnstileWidget` (invisible; auto-resets on expiry; graceful skip when unconfigured) | `@/components/ui` |

## Design System Rules
- **Use existing components first.** Before writing any UI element, check if a shared component exists in `@/components/ui`. If it does, use it. If it doesn't and the pattern appears in 2+ places, create a new shared component.
- **No hardcoded colors.** Never use raw Tailwind color classes (`red-600`, `amber-500`, `blue-100`). Always use semantic tokens (`semantic-error`, `semantic-warning`, `semantic-primary`) or design palette tokens (`aurora-*`, `frost-*`, `condition-*`).
- **No inline button/card/input styling.** If it looks like a button, use `<Button>`. If it's a bordered content area, use `<Card>`. If it's a text field, use `<Input>` or `<Select>`.
- **Heading hierarchy:** Page-section H2 = `text-xl sm:text-2xl font-semibold`. Card-subsection H2 = `text-base font-semibold`.
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

Existing cron routes:
| Route | Frequency | Purpose |
|-------|-----------|---------|
| `/api/cron/expire-reservations` | Every 5 min | Release stale listing reservations |
| `/api/cron/cleanup-sessions` | Every 10 min | Clean up expired checkout sessions |
| `/api/cron/sync-tracking` | Every 15 min | Sync Unisend tracking events, auto-deliver on PARCEL_DELIVERED |
| `/api/cron/auto-complete` | Every 6 hours | Auto-complete delivered orders past 2-day dispute window |

## Important Notes
- `pnpm build` is the real deploy gate, not `pnpm type-check` alone
- Supabase RLS policies control data access — never skip them
- Supabase SSR cookies: use `getAll()`/`setAll()`, never `get()`/`set()`
- VAT rates by seller's country: LV=21%, LT=21%, EE=24%
