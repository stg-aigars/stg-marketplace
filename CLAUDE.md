# Project Context

## Overview
Second Turn Games - Nordic-minimalist peer-to-peer board game marketplace for the Baltic region (Latvia, Lithuania, Estonia). "Every game deserves a second turn."

Launch philosophy: Start with basics across all three markets. Users grow with the platform. The marketplace is only as good as its community, and the community builds alongside the product.

## Tech Stack
- Next.js 16 (App Router, Turbopack build) with TypeScript, React 19
- Supabase for database, auth, and storage
- Swedbank AS for payments (EveryPay AS as technical provider; internal code is EveryPay-named) + platform wallet system
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
- H1 page headings: `text-2xl sm:text-3xl font-extrabold tracking-tight` (Plus Jakarta Sans @ 800 — heavy weight carries platform voice)
- H2 section headings: `text-xl sm:text-2xl font-bold tracking-tight` (Plus Jakarta Sans @ 700)
- H2 card subsections: `text-base font-semibold` (Plus Jakarta Sans @ 600)
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
                    ↓           ↓         ↓             ↓
                cancelled   cancelled   disputed → refunded
```

Status enum is the authoritative reference (`src/lib/orders/types.ts:OrderStatus`): 8 values — `pending_seller | accepted | shipped | delivered | completed | cancelled | disputed | refunded`. `refunded` is a terminal state written by `src/lib/services/dispute.ts` when a dispute resolves with refund OR by the refund flow on cancellation-with-refund paths (see `src/lib/services/order-refund.ts` + the parent RPC `order_refund_with_event_atomic` which sets `status = case when p_refund_status = 'completed' then 'refunded' else status end`).

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
- Fund flow through Swedbank AS (LV, contracting Service Provider) with EveryPay AS (EE, reg. 12280690 — formerly Maksekeskus AS, same legal entity, rebranded) as Technical Provider per §1 of Swedbank E-commerce Payments Platform T&Cs. STG relies on the Art. 3(b) commercial-agent exemption of Directive (EU) 2015/2366 (PSD2) as a transitional framing, with `PSD2_TRANSITIONAL_SUNSET = 2026-10-26` enforced by `src/lib/legal/constants.test.ts`. Option 1 scoping with Maksekeskus (collecting-account model) is the target architecture before sunset; see `docs/legal_audit/lawyer-response.md` §A.2

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
| Inline arrow link | `InlineArrowLink` (href, children, size: sm/md, optional `target`/`rel` — auto-applies safe `rel="noopener noreferrer"` when `target="_blank"`; brand teal + Phosphor `ArrowRight`; use inside prose or content rows for "navigate elsewhere" affordances — distinct from `SectionLink` which sits next to headings) | `@/components/ui` |
| Breadcrumb navigation | `Breadcrumb` (items: { label, href? }[]) | `@/components/ui` |
| Pagination | `Pagination` (currentPage, totalPages, totalItems, pageSize, buildUrl) | `@/components/ui` |
| State-based tabs | `Tabs` (tabs, activeTab, onTabChange; underline style with counts) | `@/components/ui` |
| Link-based tabs | `NavTabs` (tabs with href, variant: underline/pill; auto-detects active from pathname) | `@/components/ui` |
| Step progress | `Stepper` (steps with id/label, currentStep; progress bar + labels, mobile compact) | `@/components/ui` |
| Price formatting | `formatPrice()` / `formatCentsToCurrency()` | `@/lib/services/pricing` |
| Date formatting | `formatDate()` etc. | `@/lib/date-utils` |
| Country display | Country utilities | `@/lib/country-utils` |
| Checkbox with label | `Checkbox` (checked, onChange, children, disabled; label-wrapping layout) | `@/components/ui` |
| Bot protection | `TurnstileWidget` (interaction-only appearance — zero chrome for clean traffic, surfaces checkbox when Managed mode escalates risky visitors; auto-resets on expiry; graceful skip when unconfigured) | `@/components/ui` |
| Brand inline links | `.link-brand` CSS class (teal, underline, branded hover transition) | `globals.css` |
| Safe redirect URL | `safeReturnUrl(url)` — prevents open redirects, allows relative paths only | `@/lib/auth/safe-return-url` |
| Social sharing | `ShareButtons` (copy link + native share; pass full URL from server component) | `@/components/ui` |
| Phone number input | `PhoneInput` (label, value, onChange, defaultCountry, error; Baltic flag+prefix selector) | `@/components/ui` |
| Password requirements checklist | `PasswordRequirements` (password; live checklist of the 5 Supabase-mirrored rules, collapses to single "Looks good" success line when all met; render under any password Input) | `@/components/ui` |
| Field success indicator | `FieldSuccess` (children; small green check + label rendered under a form field to confirm a value is valid; used by `PasswordRequirements`' all-met state and SignUp's email shape check) | `@/components/ui` |
| Game thumbnail | `GameThumb` (src, alt, size: sm/md/lg/xl; BGG-aware) | `@/components/listings/atoms` |
| Game title | `GameTitle` (name, size, serif; display font by default) | `@/components/listings/atoms` |
| Game metadata | `GameMeta` (year, publisher; middot-separated) | `@/components/listings/atoms` |
| Price display | `Price` (cents, size; always Plus Jakarta Sans, never display font) | `@/components/listings/atoms` |
| Game identity row | `GameIdentityRow` (thumbnail + name + edition metadata icons; bare row, caller wraps in Card; size, href, action slot) | `@/components/listings/atoms` |
| Listing identity | `ListingIdentity` (compact horizontal row: linked thumb + title + expansion count + price slot + action slot; `disableLink` for parent-linked contexts; `disabled` for unavailable items) | `@/components/listings/atoms` |
| Compact listing row | `ListingRow` (horizontal; wraps `ListingIdentity` in bordered container with condition label) | `@/components/listings` |
| Mobile listing card | `ListingCardMini` (compressed for 2-col mobile grid) | `@/components/listings` |
| Listing card grid | `ListingSection` (heading, optional link, responsive grid of `ListingCard`; `emptyState`, `className`, `linkClassName` overrides) | `@/components/listings` |
| Truncated text | `ShowMoreText` (lines, children, className; line-clamp with "Show more/less" toggle; auto-detects if truncation needed) | `@/components/ui` |
| Truncated list | `ShowMoreList` (maxItems, label, children; shows first N items with "Show all N {label}" toggle) | `@/components/ui` |
| Q&A accordion | `Accordion` (items: `{ q: ReactNode; a: ReactNode }[]`, `exclusive` toggles single-vs-multi-open, `bordered` (default true) — set false when the accordion lives inside a Card so the outer top/bottom borders drop and only the inter-item dividers remain, `size` (`'md'` default for Help-in-Card, `'lg'` for the home-page marketing FAQ), `ariaLabel` for screen readers; brand-styled Plus-rotate-45 disclosure with full ARIA) | `@/components/ui` |
| Staff delete button | `DeleteItemButton` (onDelete callback, title; icon trigger + confirm/cancel flow) | `@/components/ui` |
| Icon count badge | `CountBadge` (count, className; 0 hides) | `@/components/ui` |
| Auction bid guard | `isAuctionWithBids(listingType, bidCount)` — use instead of inline `=== 'auction' && > 0` | `@/lib/listings/types` |
| Enriched game builder | `buildEnrichedGame(bggGameId, gameName, gameYear, games)` — builds `EnrichedGame` from DB row with games join | `@/app/[locale]/sell/_components/GameSearchStep` |
| DAC7 blocked banner | `Dac7BlockedAlert` (error alert with link to tax settings; used on all sell-flow entry points) | `@/components/dac7` |
| Legal document shell | `LegalDocument` (doc id + lang; renders layout container + page-scoped switcher + optional disclaimer banner; content module owns H1 + prose container) | `@/components/legal` |
| Legal document language switcher | `LegalLangSwitcher` (four-pill, page-scoped; non-clickable active state; tokens match `NavTabs` pill variant) | `@/components/legal` |
| Translation disclaimer banner | `TranslationDisclaimerNotice` (`Alert variant="info"`; per-doc-per-lang message keyed by `LEGAL_DISCLAIMER_MESSAGES`; shown only on lv/lt/et copies) | `@/components/legal` |

## Design System Rules
- **Use existing components first.** Before writing any UI element, check if a shared component exists in `@/components/ui`. If it does, use it. If it doesn't and the pattern appears in 2+ places, create a new shared component.
- **No hardcoded colors.** Never use raw Tailwind color classes (`red-600`, `amber-500`, `blue-100`). Always use semantic tokens (`semantic-error`, `semantic-warning`, `semantic-primary`) or design palette tokens (`aurora-*`, `frost-*`, `condition-*`).
- **No inline button/card/input styling.** If it looks like a button, use `<Button>`. If it's a bordered content area, use `<Card>`. If it's a text field, use `<Input>` or `<Select>`.
- **Button + Link:** Never nest `<Link>` inside `<Button>` (invalid `<a>` inside `<button>`). Use `<Button asChild><Link href="...">text</Link></Button>` — `asChild` renders Button styling on the Link element directly.
- **Heading hierarchy:** Page H1 = `text-2xl sm:text-3xl font-extrabold tracking-tight`. Page-section H2 = `text-xl sm:text-2xl font-bold tracking-tight`. Card-subsection H2 = `text-base font-semibold` (all Plus Jakarta Sans, weight is the contrast lever).
- **Typography (one display register + weight hierarchy):** Two fonts map to two semantic registers. Pick by *what the text represents*, not by visual weight.
  - **Plus Jakarta Sans (default `font-sans`)** — platform voice and body. Variable weight 200–800 carries the entire UI. Heavy weights (`font-extrabold` 800 for H1s/wordmark/hero, `font-bold` 700 for H2s) signal platform chrome; medium weights (`font-medium` 500, `font-semibold` 600) carry interactive labels and card subsections; default (400) carries body. No `font-platform` Tailwind key — chrome and body share the same family, contrast is *weight*. Reads especially well in long-form content (terms/privacy/help) due to its higher x-height vs. alternatives like Rubik. Has no italic in our setup — never apply `italic` to chrome (browsers synthesize fake italic via skew, which looks bad at heavy weights).
  - **`font-display` (Fraunces)** — game / product voice. Use for: game titles (always via the `GameTitle` atom when possible), listing detail page H1 (`{listing.game_name}`), wanted listing detail H1, anywhere "this is a specific game" semantics. Variable weight + true italic available.
  - **Never** use `font-display` for body, labels, buttons, prices, badges, or UI chrome. Prices always use `font-sans` (Plus Jakarta Sans).
  - **Failure mode discipline:** `font-display` falls back to Georgia, serif (so game identity stays serif if Fraunces fails). `font-sans` falls back to a system sans stack (so chrome and body stay legible if Plus Jakarta Sans fails). Don't change either fallback chain casually.
- **Brand colors:** Interactive elements (links, focus rings, active states) use `semantic-brand` (teal). Purchase-intent CTAs (Buy, Checkout, Add to Cart) use `semantic-primary` (orange). Platform-action CTAs (Sell a game, seller dashboard entry points) use `Button variant="brand"` (teal, filled).
- **Badge shape:** `rounded-md` (squared), not pills. Condition badges include a Phosphor tier icon.
- **Image containers:** Game art uses `aspect-square`, not fixed heights.
- **Transitions:** All transitions use branded easing — `duration-250 ease-out-custom` or `duration-350 ease-out-custom`.
- **Class merging:** Shared UI components that accept `className` must merge classes via `cn()` from `@/lib/cn` — never via plain template literals (`` `${base} ${className}` ``). `cn()` wraps `tailwind-merge` + `clsx`, so caller overrides correctly win against component defaults regardless of CSS cascade order. Without it, `className` props silently lose to internal size/variant classes, and the only workaround is `!important` prefixes. Accepts strings, conditionals (`cond && 'class'`), arrays, and objects.
- **Legal documents** (`/terms`, `/seller-terms`, `/privacy`, `/cookies`) ship in four languages via the `_content/{en,lv,lt,et}.tsx` module pattern. Wrap any new legal-document tree with `<LegalDocument doc="..." lang="...">`. The language switcher is page-scoped — do not extract it to the site-wide chrome. Per-doc-per-lang disclaimer wording lives in `LEGAL_DISCLAIMER_MESSAGES` (constants.ts); the "binding/authoritative" framing substring must appear in both the banner message and the clause body — Terms §17, Seller §10, Privacy §14, and Cookie Policy's unnumbered Language section (all enforced by `language-clause.test.ts`). Cookie Policy reuses Privacy's "authoritative" framing verbatim — both are notices under EU privacy law (cookies under e-Privacy Directive 5(3); privacy under GDPR 13/14). `LegalDocId` is the 4-doc union; if a new legal doc joins, extend `LEGAL_DOC_TITLES`, both disclaimer maps, and the regression test together. Open Graph / social-preview fields stay English on translated routes; only the body content and the browser-tab `<title>` are translated.
- **Legal-doc version stamps** are independently versioned per document: `TERMS_VERSION`, `SELLER_TERMS_VERSION`, `PRIVACY_VERSION`, and `COOKIES_VERSION` (constants.ts). Bump only the doc whose content changed. The Cookie Policy is a notice under e-Privacy Directive Art. 5(3), not a bilateral contract, so it uses Privacy-style "authoritative" framing in its Language section (not the Terms / Seller "legally binding" framing) and has no acceptance flow / audit-log resourceId. `/accessibility` still uses `TERMS_VERSION` as a coupled fallback — separate decoupling follow-up. The `language-clause.test.ts` regression guard covers Terms §17, Seller §10, Privacy §14 (numbered) AND the Cookie Policy's unnumbered "Language" section.
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

## Accounting Module
Foundational double-entry GL schema in migrations 093–096 (PR #1). Posting engine in migration 097 + `src/lib/accounting/` (PR #2). UI / vendor-invoice intake / period-close workflow in PR #4; marketplace lifecycle integration (cart, completion, withdrawal) in PR #5; Phase 0 backfill in PR #3. 8 tables: `accounts`, `periods`, `vat_rates`, `counterparties`, `fixed_assets`, `vendor_invoices`, `journal_entries`, `journal_lines`. Hand-written types in `src/lib/accounting/types.ts`.

**Operational playbook:** `docs/operations/lifecycle-cutover-runbook.md` is the canonical staff playbook for converting "engine code merged" → "engine active in production." Three-stage cutover (staging burn-in → production staff-only → production global), explicit gates per stage, rollback decision tree, monthly operational calendar. Cross-reference `docs/operations/deployment-state-audit-2026-05-12.md` for the production-state snapshot.

- Append-only: `journal_entries` / `journal_lines` blocked from UPDATE/DELETE by triggers; corrections via reversal entries with `reverses_entry_id`
- Σ debit = Σ credit per entry enforced by a `DEFERRABLE INITIALLY DEFERRED` constraint trigger (first such trigger in this codebase) so multi-line entries can be inserted line-by-line and the balance check runs at COMMIT
- Period state machine `open` → `soft_locked` → `hard_locked`; soft_locked accepts only entries with `period_close_adjustment=true` (the trigger respects the flag — application layer decides who is authorised to set it). Period seed window 2025-05 → 2030-12 monthly; extending later requires a new migration or a future `cron/seed-periods` route. **Hard-lock transitions go through the `hard_lock_period_atomic(period_key, period_type, expected_locked_at)` RPC (migration 099) — the check-then-update pattern was replaced with an atomic conditional UPDATE under `SELECT ... FOR UPDATE` to close a TOCTOU race that PR #5's concurrent writers would have exercised. Coupled trigger change in 099: `enforce_period_status` reads via `SELECT ... FOR SHARE` so concurrent INSERTs serialise on the period row lock. Lock-graph invariant: any future code path that reads `periods.status` to gate journal entry writes must hold ≥`FOR SHARE` on the period row.**
- VAT account prefix is `5710` (Latvian SME standard, accountant-confirmed). OSS-LT and OSS-EE are top-level (`5711`, `5712`), not `5710` sub-accounts — separate retention semantics, separate reporting (OSS portal). Architecture v2 §A still names `5721`; that's a stale predecessor convention pending a docs-only reconcile
- O.x order-completion entries are **5 lines** (4 for B2B RC O.2/O.4), not the pre-PR-#5 4-line "invoice slice" v3 §A.1–§A.5 shows. Full shape per `docs/legal_audit/accountant-completion-entry-signoff.md` (v1.4, accountant verbally approved 12 May 2026; written confirmation in flight): Dr 5590 suspense gross_cart / Cr 5351 seller_net / Cr 6310-C commission_net / Cr 6310-S shipping_net / Cr {5710-LV-OUT | 5711 | 5712} vat_amount (Line 5 omitted for B2B RC). **Per-order Unisend accrual dropped in v1.4** (was Dr 7720 + Cr 5410-UN at completion under v1.3 agency model). Unisend cost is now recognized only at monthly invoice receipt via the existing I.1 vendor-invoice flow — no per-order accrual, no `unisend_cost_cents` payload key, no new column on orders. **VAT-inclusive decomposition** stays load-bearing: commission and shipping are gross; net via `round_half_up(gross / (1 + vat_rate))` at cent boundary; `line_vat = gross − line_net` (NEVER computed independently — produces sub-cent disagreement). **`seller_net = item_value − commission_gross`** (matches existing `pricing.ts:walletCreditCents = itemsTotalCents − commissionCents`). Required payload keys for O.1–O.5: `item_value_cents`, `shipping_value_cents`, `invoice_number`. PR #5 commit 6 reworks `buildOrderRevenueLines` from 4 → 5 lines (2 additive: Dr 5590, Cr 5351 reversed direction from the deduction shape); pre-PR-#5 implementation was idle (Phase 0 backfill produced zero O.x entries). Earlier doc revisions superseded: v2 §K.4 (seller_net €83.35 under VAT-exclusive seller-bears), v1.2 (€86.50 under VAT-inclusive seller-bears), v1.3 (€90.00 under VAT-inclusive STG-bears with 7720+5410-UN accruals). v1.4 keeps STG-bears framing for I.1 invoice receipt time, drops the per-order accrual.
- **counterparty.tax_status default — silent-drift caveat (PR #5 commit 6).** `src/lib/accounting/lifecycle-wraps.ts:resolveSellerCounterparty` lazy-inits the seller counterparty from `user_profiles` at first-transaction time. Today's `user_profiles` schema only carries `country` and `full_name` — no `tax_status`, `vat_number`, or `vies_verified_at`. Every lazy-created counterparty therefore defaults to `tax_status='private'`, which means **B2B sellers (if any) route to O.3 (LT B2C OSS) or O.5 (EE B2C OSS) instead of O.2 / O.4 (B2B reverse-charge)**. This is a marketplace data-model gap, not an accounting bug — the catalog supports B2B RC, it just has no source data for vat_registered status today. When `user_profiles.tax_status` (and `vat_number` / `vies_verified_at`) ship alongside the seller-onboarding UX in a future PR, the resolver gets updated to source them. Because migration 093's snapshot contract is "snapshotted at first-transaction time, not read-through," **existing counterparties are NOT retroactively updated** when source columns ship — the marketplace fix would need an explicit reconciliation step amending affected sellers' counterparty rows. Until that lands: B2B RC routing remains catalog-supported but data-unsupported.
- System counterparties (VID, STG_INTERNAL) have pinned UUIDs in `src/lib/accounting/system-counterparties.ts` — do not change those values once journal entries reference them
- RLS: staff-SELECT only on all 8 tables; service role bypasses RLS
- **`emission_source` typed convention.** Every PostingEvent carries a top-level `emission_source` field; the engine merges it into `posting_context` so reporting views can filter by source. Four values: `'lifecycle'` (wrap-emitted from marketplace flows — cart, completion, refund, withdrawal), `'cron'` (monthly-depreciation P.6, monthly-vat-close P.1), `'staff_manual'` (C.3 EveryPay settlement via staff UI), `'backfill'` (historical Phase 0 + April + May entries). Builders set the field; no code path relies on a default. Convention shipped across PR C commits 9-12.
- **`is_staff_test` cutover gate (two-level).** Stage-2 cutover burn-in writes real GL in production while gating customer traffic to legacy paths. Each lifecycle entity (`orders`, `cart_checkout_groups`, `withdrawal_requests`) carries `is_staff_test boolean not null default false`. Wrap callers gate on `isAccountingEngineEnabled() && entity.is_staff_test` during stage 2; the wrap threads the flag to `posting_context.is_staff_test`. Stage 3 transition removes the `&& entity.is_staff_test` clause at all four caller sites (order-transitions, order-refund, payment-fulfillment, withdrawal route). See `docs/operations/lifecycle-cutover-runbook.md` §1 Gate 9 + §3 for the full discipline + four-site enumeration.

### Posting engine (PR #2)
The posting engine is **the only writer** to `journal_entries` / `journal_lines` at the application layer (architecture v2 §H.4). All marketplace flows that need to post must go through `emit(supabase, event)` in `src/lib/accounting/posting-engine.ts` — never INSERT directly.

- **Hybrid shape:** TypeScript engine owns routing/dispatch/compute/idempotency/KYC gate; PL/pgSQL primitive `insert_journal_entry(p_entry jsonb, p_lines jsonb) returns uuid` (migration 097, `SECURITY DEFINER`, `set search_path=''`) owns the atomic 1-entry-N-lines INSERT under the period-status, balanced-entry, and immutability triggers from PR #1
- **Inline-callable:** PR #5 parent RPCs compose multi-step transactions with `PERFORM public.insert_journal_entry(...)`. PR #3 backfill calls the same primitive. The engine itself uses `supabase.rpc('insert_journal_entry', ...)`
- **Idempotency:** UNIQUE `(source_doc_type, source_doc_id, type_id)` index on `journal_entries`; engine does pre-RPC SELECT for the dominant retry case + recovers from race-condition unique_violation via fresh SELECT (READ COMMITTED makes the winner's commit visible)
- **Mapping table:** `src/lib/accounting/mapping.ts` exports `MAPPING_TABLE: VatMappingEntry[]`, currently 18 type IDs (O.1–O.3, I.1–I.5, P.1, P.6, P.7, H.1–H.3, C.4, C.6–C.8). I.6 is a payload modifier (caller passes `expense_account: '1230'` on an underlying I.x type to capitalize), not a routing entry. Adding a new type is a `mapping.ts` row + a test — no engine change. First-match-wins routing; mutual-exclusivity test in `dispatcher.test.ts` enforces every event matches exactly one type
- **VAT rate snapshotting:** engine reads `vat_rates(country, posting_date)` at compute time and writes `vat_rate_snapshot` on every line. Future rate changes apply prospectively
- **FX decomposition (§F worked example):** `decomposeFx(foreign_amount, fx_rate, bank_amount_eur)` → `{ service_value_eur_cents, fx_fee_eur_cents }`. Cents throughout; the only multiply-then-round operation is `vat_base_cents × vat_rate → vat_amount_cents`. FX fees route to `7710` (VAT-exempt financial service); `decomposeFx` rejects negative fee inputs as caller-data inconsistency
- **KYC gate:** triggered for type `C.4` (wallet withdrawal) only. `legal_compliance_status` values `pending_kyc`, `dac7_blocked`, `negative_wallet`, `suspended` block; `dormant` does **not** block (marketplace-state signal, not a payout block). `assertPayoutAllowed(counterparty: CounterpartyRow | null)` is a pure function — engine passes the already-loaded row, no extra DB roundtrip
- **Error contract for parent RPCs.** PR #5 parent RPCs that `PERFORM public.insert_journal_entry(...)` must catch four distinct error families. The full catchable set:
  - **Caller-input failures from the RPC itself** (migration 097): SQLSTATE `P0001` (default for `RAISE EXCEPTION` without `USING ERRCODE`), message-prefixed. Two families: `POSTING:MISSING_KEY <field>` (required jsonb key absent) and `POSTING:INVALID_SHAPE <reason>` (p_lines not array, < 2 lines, p_entry not object). Catch via `WHEN sqlstate 'P0001' THEN IF SQLERRM LIKE 'POSTING:%' THEN ...`. Note: typed-cast failures inside the RPC's INSERT statements (malformed `posting_date`, invalid UUID in `reverses_entry_id`, non-numeric `debit_cents` etc.) surface as native Postgres SQLSTATEs (`22P02` invalid_text_representation, `22007` invalid_datetime_format, etc.) without the `POSTING:` prefix — parents should either pre-validate the jsonb shape before PERFORM, or catch the `data_exception` SQLSTATE family separately
  - **Idempotency UNIQUE violation** (migration 097's `idx_journal_entries_idempotency`): SQLSTATE `23505` (unique_violation). Treat as `idempotent_skip` — re-SELECT by `(source_doc_type, source_doc_id, type_id)` to recover the winner's `entry_id` (READ COMMITTED guarantees visibility post-commit). The TS engine handles this internally; PL/pgSQL parents using PERFORM need to re-implement the recovery
  - **Trigger-raised invariant failures** (migration 094): SQLSTATE `23514` (check_violation, set explicitly via `USING ERRCODE`). Four message shapes: `Unbalanced journal entry %: dr=% cr=%` (deferred Σ-balance trigger fires at COMMIT), `Period % is hard_locked; corrections must post to current open period as reversal entries`, `Period % is soft_locked; only entries marked period_close_adjustment=true allowed (set by authorised role at application layer)`, `Journal entries are immutable; corrections via reversal entries with reverses_entry_id`, `Journal lines are immutable; corrections via reversal entries`. Catch via `WHEN check_violation THEN ...` and inspect SQLERRM for the specific shape
  - **Period-not-seeded failure** (migration 094's `enforce_period_status`, generalized in migration 098): SQLSTATE `P0001` with message prefix `POSTING:UNKNOWN_PERIOD %; period must be seeded in public.periods (period_type in month/quarter/year)`. Catch via `WHEN sqlstate 'P0001' AND SQLERRM LIKE 'POSTING:UNKNOWN_PERIOD%' THEN ...`. Pre-098 versions raised SQLSTATE `23503` (foreign_key_violation, semantically wrong since no FK existed); migration 098 switched to `P0001` matching migration 097's RPC convention.
  - In TypeScript via `supabase.rpc()`, all of these arrive as `{ data, error }` with `error.code` set to the SQLSTATE; the engine in `src/lib/accounting/posting-engine.ts` only special-cases `23505` (idempotency recovery) and surfaces all others as `{ status: 'failed', error }` to callers
- **TypeScript errors:** `PostingValidationError` (caller-input), `PostingComplianceGateError` (KYC block), `PostingIdempotencyConflict` (defensive escape hatch, never throws in normal operation). `engine_invariant` code distinguishes engine-internal violations from caller-input failures
- **Test artifact convention:** lifecycle integration tests post entries to synthetic period **2027-01** (and 2027-02 for cross-period scenarios). The **period itself is the primary discriminator** — production reporting views never query 2027-01/02. The `posting_context.test_artifact=true` tag is the **secondary discriminator** and only applies to entries created via direct `insert_journal_entry` calls inside tests (e.g., synthetic GL state seeding in period-lock, cron-vat-close, wallet-integrity tests). Tests that exercise the wraps end-to-end (`settlement.test.ts`, `withdrawal.test.ts`, the happy-path scenarios in `cart-payment.test.ts` / `order-completion.test.ts` / `refund.test.ts`) emit entries WITHOUT the tag because the wraps don't accept a `test_artifact` payload override — they're opinionated about what they write. Entries persist permanently (immutability trigger blocks DELETE, FK from journal_lines blocks counterparty cleanup). PR #4 trial-balance / P&L views should filter on BOTH `accounting_period NOT IN ('2027-01', '2027-02')` (covers wrap-emitted test entries) AND `NOT (posting_context @> '{"test_artifact": true}')` (covers direct-insert test entries). The `posting_context.is_staff_test=true` tag (added during PR C commit 14 + Gate 9) is a SEPARATE discriminator for stage-2 cutover burn-in entries in PRODUCTION periods (not 2027-01) — see `docs/operations/lifecycle-cutover-runbook.md §3` for the dual-filter pattern. PR #3 backfill entries are tagged with `posting_context.backfill = true` and `posting_context.phase0_entry_number`; they post to real periods (2025-07 → 2026-03) — NOT test artifacts but historical production data, so PR #4 views need a separate "include/exclude backfill" toggle distinct from the test-artifact + staff-test filters
- **Phase 0 backfill (PR #3):** 23 historical journal entries reconstructing STG's GL state from incorporation (May 2025) through 31.03.2026 closing balance. Lives at `scripts/phase0-backfill.ts` + `scripts/phase0-backfill-data.ts` + `scripts/phase0-backfill-reconcile.ts`. Source-of-truth: `stg-phase-0-backfill-execution-v2.md` (with the v3 mapping doc's H.2/I.4 ESL-field misuse corrected in PR #281 — see below). H.2 is FX-aware (handles Cursor/Vercel post-VAT-reg-but-input-forfeited charges with the same FX decomposition as H.3); the v3 spec doc's original Entry 11 routing through I.4 would have double-counted RC against Entry 12's H.1 December catch-up. Production trial balance at 31.03.2026: Bank €444.90, share capital €1.00, related-party loans €2,150.00, fixed-asset NBV €1,427.44, accumulated deficit €278.66 (debit on 3420)
- **`esl_transaction_code` cleanup:** ESL (PVN 2 pielikums) is for OUTBOUND supplies to EU VAT-registered buyers in other MS (Article 263 of Directive 2006/112/EC). PR #281 dropped the field from I.2 and I.4, since both are INCOMING types where `esl_transaction_code` was used to carry PVN-1-I attachment markers ('R4' for domestic RC, 'N' for non-EU received) — those are not ESL codes and the field name was a v3-mapping-doc drift. Going forward, `esl_transaction_code` should appear ONLY on outbound types (currently O.2; future O.4 when shipped). The type union in `types.ts` is now `'S' | 'T'` (real ESL codes per Article 263) — the dead 'R4', 'A', 'N' values were dropped in the cleanup PR after PR #281. If PVN-1-I attachment codes need a home in the future, add a dedicated `pvn1_transaction_code` field rather than re-widening the ESL union.
- **Script env load order:** scripts that import `@/lib/*` modules MUST `import './_load-env';` as their FIRST import. ES module imports are evaluated depth-first in source order, and `@/lib/env` captures `process.env` at module-load time — so `dotenv.config()` calls inside the script's `runMain()` are too late. Without the side-effect import, the engine's audit-log path throws `supabaseUrl is required` because `@/lib/supabase`'s `createServiceClient` got undefined `env.url`. Surfaced during the 09.05.2026 Phase 0 production run; backfilled the missed 23 `accounting.posted` audit events via `metadata.backfilled_audit_event = true` flag. Convention enforced at lint time by custom rule `stg/scripts-load-env-first` (`eslint-rules/scripts-load-env-first.mjs`, scoped to `scripts/**/*.ts`, level `warn`; PR #4.5b). Promote to `error` after 2-3 PRs touching `scripts/` land cleanly.

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

Existing cron routes: `expire-reservations` (5min), `reconcile-payments` (5min, reconciles orphaned cart checkout groups + retries failed wallet debits), `auction-ending-soon` (5min, sends ending-soon notifications to bidders + seller 30min before auction end), `end-auctions` (1min), `cleanup-sessions` (10min, expires orphan cart checkout groups + unreserves their listings), `sync-tracking` (15min), `auction-payment-deadline` (30min), `enforce-deadlines` (2h), `auto-complete` (6h), `cleanup-photos` (6h, removes orphaned listing photos from storage), `dac7-reconcile` (daily, reconciles seller stats from completed orders + escalates DAC7 reminder/blocked statuses + year-start resets in January), `trader-signals` (daily, writes rolling 12-month sales/revenue counters to user_profiles + fires `seller.trader_signal_crossed` on first crossing of the 25-sales / €1,800-revenue verification trigger; advisory only — never auto-mutates `seller_status`), `verification-escalation` (daily, flips `verification_response` to `'unresponsive'` for sellers who haven't responded within 14d + fires `seller.verification_unresponsive`), `cleanup-notifications` (weekly), `cleanup-audit-log` (weekly, deletes `retention_class = 'operational'` audit log entries older than 30 days; `regulatory` entries are retained for 10 years per their originating obligations), `cleanup-login-activity` (daily, deletes `login_activity` rows older than 30 days per the lawyer-cleared GDPR Art. 6(1)(f) balancing test for fraud-prevention security logs — see `docs/legal_audit/ropa-login-activity.md`), `monthly-depreciation` (monthly at 00:30 UTC on day 1, schedule `30 0 1 * *`; posts P.6 depreciation entries for the previous month for every active row in `fixed_assets` (`disposed_date IS NULL`). `source_doc_id` pattern `depreciation_<asset_code>_<YYYY-MM>` is deterministic; UNIQUE on `(source_doc_type, source_doc_id, type_id)` makes re-runs idempotent_skip. `posting_context.emission_source = 'cron'` distinguishes from backfill-emitted P.6. Took over from Phase 0 Entries 19, 20 + april `phase0_entry_21` (months 1-3 of IT-2026-001) starting month 4 in May 2026), `monthly-vat-close` (monthly at 01:00 UTC on day 1, schedule `0 1 1 * *`; posts P.1 VAT consolidation entries for the previous month. Reads cumulative `5710-LV-IN` + `5710-LV-OUT` movement via `getNetVatPositionForPeriod`; routes by net direction — refund (Dr 5710-LV-OUT + Cr 5710-LV-IN + Dr 2380), payable (Dr 5710-LV-OUT + Cr 5710-LV-IN + Cr 5710-09), or zero-net (2-line clear-only). RC sub-accounts excluded by design — foreign RC stays on balance sheet per Phase 0/April convention; domestic RC washes within period. Pre-checks period state — fails with `failed_period_locked` when previous period is soft_locked or hard_locked. **Layered idempotency**: Layer 1 — engine UNIQUE on `(source_doc_type='period_close', source_doc_id, type_id='P.1')` catches same-source_doc_id retry races; Layer 2 — cron-level period skip queries `journal_entries WHERE accounting_period = target AND type_id = 'P.1'` BEFORE emit and returns `skipped_period_already_closed` if found, catching different-source_doc_id-same-period scenarios (backfill collisions with `phase0_entry_N`-style ids, manual one-shot scripts, future code changes). Both layers are required; engine UNIQUE alone doesn't catch cross-source_doc_id collisions. See `accounting_conventions.md §8` for the canonical layered-idempotency pattern. `source_doc_id` pattern `close_<YYYY>_<MM>` (underscore separator matches April `close_2026_04` + Phase 0 `close_2026_01`). Skipped (no emit) when both LV-IN and LV-OUT are zero — distinct from zero-net case where both nonzero but equal (P.1 still fires to clear). `posting_context.emission_source = 'cron'` distinguishes from backfill-emitted P.1. Takes over from manual P.1 backfill starting June 2026 (first prod fire targets May 2026; May backfill script likely emits May's P.1 first — Layer 2 catches the collision cleanly, returning `skipped_period_already_closed` rather than a Layer 1 idempotent_skip). P.1 routing event_type renamed `period_close.monthly_refund` → `period_close.monthly_vat` in PR C commit 12 to support both refund + payable positions; historical entries unaffected since event_type isn't persisted to journal_entries). See `src/app/api/cron/` for implementations.

## Branching Workflow
- Multi-file features: always use `feature/<name>` branch + PR to main
- Trivial single-file fixes: direct commits to main are acceptable
- Always delete feature branches (local + remote) after merging

## In-App Notifications
- Every email event also creates an in-app notification via `notify(userId, type, context)` from `@/lib/notifications`
- Fire-and-forget pattern (same as `logAuditEvent`) — never blocks the main operation
- 43 notification types with prefixes: `order.`, `comment.`, `dispute.`, `shipping.`, `auction.`, `wanted.`, `dac7.`, `moderation.`, `listing.`, `feedback.`, `message.`. **Every new prefix MUST ship a paired migration adding it to the `notifications_type_check` regex** — `notify()` swallows CHECK violations silently in its internal try/catch, so a missing prefix breaks the affected feature's in-app bell with zero noisy errors. Migration 119 swept the regex after `feedback.`, `moderation.`, `listing.`, and `message.` had drifted for one or more PRs each.
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
- **Pass your supabase client.** When you have a service-role `supabase` client locally scoped (most call sites do), call `logAuditEvent(supabase, { ... })` — the audit-write path then shares env state and connection-pool ordering with the surrounding data write, closing the structural seam that surfaced during PR #3's Phase 0 backfill (audit insert silently dropped 23 events while the data insert succeeded). Calling with the options object alone (`logAuditEvent({ ... })`) falls through to a service-role client created at audit-time — back-compat for SSR-only flows (e.g. `terms.accepted` from auth signup; `seller_terms.accepted` from the sell-gate acceptance) where no service-role client is locally scoped.
- `action` is freeform TEXT (no CHECK constraint); convention is `resource.verb_past_tense` (e.g. `order.status_changed`, `dispute.opened`, `shipment.cancelled`, `terms.accepted`). `actor_type` has a CHECK — must be `'user' | 'system' | 'cron'`. `retention_class` is `'operational'` (30-day cleanup) or `'regulatory'` (10-year retention) — required, no default; the cleanup-audit-log cron only deletes `retention_class = 'operational'` rows.
- `resourceType` + `resourceId` feed the `idx_audit_log_resource` index; prefer a shape that makes future compliance queries cheap (e.g. `resourceType: 'terms', resourceId: TERMS_VERSION` lets you ask "who accepted version X?" with an index scan)
- **Canonical register discipline**: this file is the source of truth for which events are regulatory vs operational. Every new event type added to a `logAuditEvent` call site must be registered here with its retention class **before or with** the emission site's PR. PRs that add a new event without the register entry get bounced — without this, the regulatory bucket silently leaks events as the codebase evolves.
- **Registered events** (each entry annotated with `retention_class`):
  - `terms.accepted` (retention: regulatory) — fires at email signup (`source: 'signup'` in metadata) and at OAuth onboarding when the user completes `CompleteProfileForm` (`source: 'oauth_onboarding'`). The OAuth path is gated by `.select('id')` on the profile update so the event only fires when `terms_accepted_at` actually flips from null — no duplicate events on repeat calls. `resourceId` is `TERMS_VERSION` captured at the moment of acceptance; the constant import resolves to a literal at call time, so the historical version is preserved even if we later bump `TERMS_VERSION`. **Translation coupling.** `TERMS_VERSION`, `SELLER_TERMS_VERSION`, `PRIVACY_VERSION`, and `COOKIES_VERSION` are the canonical version stamp for the English original AND for all three translations (LV / LT / ET) at `app/[locale]/{doc}/_content/{lang}.tsx`. Any change to an English legal doc that bumps the version constant must also update the three corresponding translation modules and their hardcoded "Last updated" date strings (LV: `2026. gada 13. maijā` format; LT: `2026 m. gegužės 13 d.` format; ET: `13. mail 2026` format). The English source is authoritative per §17 / §10 / §14 (Terms / Seller / Privacy) or the unnumbered Language section (Cookie Policy), but translations should not drift to an earlier version stamp — if a translation hasn't been updated, the version bump should not merge. The `language-clause.test.ts` regression guard verifies the clause exists in each language and that the disclaimer-banner framing substring (`LEGAL_DISCLAIMER_CLAUSE_BRIDGE`) matches the clause body in each (doc, lang) combination — 16 doc-lang combinations total; visual review during the bump PR verifies the date strings match.
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
    - `payment.refunded` (regulatory) — fires from `attemptAutoRefund` in `payment-fulfillment.ts`. Swedbank-side refund record.
    - `payment.cart_completed` (regulatory) — fires when a Swedbank cart payment lands and orders are created in `payment-fulfillment.ts`.
    - `payment.cart_wallet_completed` (regulatory) — fires when a wallet-funded cart payment completes in `cart-wallet-pay/route.ts`.
    - `payment.cart_created` (regulatory) — fires when a cart payment intent is created in `cart-create/route.ts`.
    - `wallet.credit` / `wallet.debit` / `wallet.refund` / `wallet.withdrawal_requested` (all regulatory) — fire from `src/lib/services/wallet.ts`. Financial ledger; accountant retention applies.
    - `accounting.posted` (regulatory) — fires from the posting engine in `src/lib/accounting/posting-engine.ts` after every successful `emit()` (one row per journal entry written to `journal_entries`). `actorType: 'system'`. `actorId` is the caller's user id when supplied (UUID-validated; non-UUID values fall back to null because `audit_log.actor_id` is `uuid REFERENCES auth.users`). `resourceType: 'journal_entry'`, `resourceId` = the new `journal_entries.id`. Metadata: `{ type_id, source_doc_type, source_doc_id, accounting_period, tax_period, created_by }`. Pattern is fire-and-forget; failures route to Sentry as `warning` (the GL entry already succeeded — audit failure is not an integrity invariant — but a sustained pattern of write failures is a compliance gap that needs visibility).
    - `accounting.period_status_changed` (regulatory) — fires from `softLockPeriod`, `hardLockPeriod`, and `unsoftLockPeriod` server actions in `src/lib/accounting/period-actions.ts`. `actorType: 'user'`, `actorId` = staff user. `resourceType: 'period'`, `resourceId` = the `period_key` (e.g., '2026-03'). Metadata: `{ period_type, from_status, to_status, transition_reason? }`. Hard-lock requires no entries posted to the period since soft-lock (verified at action time); the unsoft-lock action is the admin escape hatch and requires a non-empty `transition_reason`. Regulatory retention because period state is the gate for the immutability invariant.
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
