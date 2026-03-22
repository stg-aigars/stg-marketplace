---
name: Design System Upgrade Plan
description: 9-step execution plan for Silk-inspired design system upgrades - icons, components, trust indicators, stepper
type: project
---

# Design System Upgrade — Execution Plan

Origin: Silk Design System audit (2026-03-22). Separate initiative from weekly feature rollout.

## Principle

One session per step. Each step ships a PR. `pnpm build` passes before merge. Nothing breaks.

## Dependencies

- Step 1 (Phosphor Icons) first — every subsequent step benefits from the icon system
- Step 2 (EmptyState) depends on Step 1 (uses Phosphor icons)
- Steps 3-5 (Breadcrumb, Pagination, Tabs) are independent of each other, all benefit from Step 1
- Step 6 (Alert enhancement) benefits from Step 1
- Step 7 (ListingCard) independent
- Step 8 (Trust indicators) independent, but needs DB query verification
- Step 9 (Checkout stepper) should reference ListingCreationFlow's existing step indicator

---

## ~~Step 1: Phosphor Icons~~ DONE (2026-03-22, PR #13)

Installed `@phosphor-icons/react` and replaced ~80 inline SVGs across 29 files.

### Implementation notes
- All imports use `@phosphor-icons/react/ssr` (even in client components) — avoids double-barrel bundle bloat from the CSR entry point
- Google OAuth logo SVG kept inline (branded multi-color, not replaceable)
- `ConditionStep.tsx` had an SVG not in the original inventory — caught during implementation
- Button spinner changed from two-part SVG (faint circle + arc) to `CircleNotch` — visually similar but not identical, needs visual spot-check
- `Sliders` icon in BrowseFilters is vertical orientation vs original horizontal — check if acceptable on mobile filter button

### Files to modify (grouped by area)

**UI components (5 files)**:
- `src/components/ui/button.tsx` — spinner → `CircleNotch` (weight: bold, animate-spin)
- `src/components/ui/input.tsx` — eye/eye-slash → `Eye` / `EyeSlash`
- `src/components/ui/alert.tsx` — close X → `X`
- `src/components/ui/modal.tsx` — close X → `X`
- `src/components/layout/SiteHeader.tsx` — chevron down, X, hamburger → `CaretDown`, `X`, `List`

**Listings & browse (5 files)**:
- `src/components/listings/ListingCard.tsx` — image placeholder → `ImageSquare`
- `src/components/listings/BrowseFilters.tsx` — filter slider → `Sliders`
- `src/components/listings/FavoriteButton.tsx` — heart filled/outline → `Heart` (weight: fill/regular)
- `src/app/[locale]/browse/page.tsx` — magnifying glass, dice → `MagnifyingGlass`, `Cube`
- `src/app/[locale]/account/favorites/page.tsx` — heart outline → `Heart`

**Orders & messages (5 files)**:
- `src/components/orders/OrderDetailClient.tsx` — warning triangle → `Warning`
- `src/components/orders/DisputeForm.tsx` — close X → `X`
- `src/components/messages/ConversationList.tsx` — chat bubble, box → `ChatCircle`, `Package`
- `src/components/messages/ConversationView.tsx` — box → `Package`
- `src/components/messages/MessageInput.tsx` — spinner, send → `CircleNotch`, `PaperPlaneRight`

**Sell flow (4 files)**:
- `src/app/[locale]/sell/_components/PhotoUploadStep.tsx` — drag handle, X, spinner, cloud upload → `DotsSixVertical`, `X`, `CircleNotch`, `CloudArrowUp`
- `src/app/[locale]/sell/_components/GameSearchStep.tsx` — spinner, image placeholder, spinner → `CircleNotch`, `ImageSquare`
- `src/app/[locale]/sell/_components/VersionStep.tsx` — spinner, checkmark → `CircleNotch`, `CheckCircle`
- `src/app/[locale]/listings/[id]/PhotoGallery.tsx` — image placeholder → `ImageSquare`

**Listing detail & checkout (2 files)**:
- `src/app/[locale]/listings/[id]/page.tsx` — prohibition, people, weight → `Prohibit`, `Users`, `Scales`
- `src/app/[locale]/checkout/[listingId]/page.tsx` — (breadcrumb area, no standalone icons)

**Reviews (3 files)**:
- `src/components/reviews/ReviewForm.tsx` — thumbs up/down → `ThumbsUp`, `ThumbsDown` (weight: fill)
- `src/components/reviews/ReviewItem.tsx` — thumbs up/down → `ThumbsUp`, `ThumbsDown` (weight: fill)
- `src/components/reviews/SellerRating.tsx` — thumbs up → `ThumbsUp` (weight: fill)

**Account & errors (3 files)**:
- `src/app/[locale]/account/page.tsx` — right arrows (5x) → `CaretRight`
- `src/app/[locale]/messages/[conversationId]/page.tsx` — back arrow → `ArrowLeft`
- `src/components/errors/ErrorFallback.tsx` — warning triangle → `Warning`

**Auth (1 file — KEEP AS-IS)**:
- `src/app/[locale]/auth/_components/OAuthButton.tsx` — Google logo is a branded multi-color SVG. Do NOT replace with Phosphor. Keep inline.

### Icon size mapping
| Current class | Phosphor `size` prop |
|---|---|
| `w-3 h-3` | `size={12}` |
| `w-3.5 h-3.5` | `size={14}` |
| `w-4 h-4` | `size={16}` |
| `w-5 h-5` | `size={20}` |
| `w-6 h-6` | `size={24}` |
| `w-8 h-8` | `size={32}` |
| `w-12 h-12` | `size={48}` |
| `w-16 h-16` | `size={64}` |

### Verification
- `pnpm build` passes
- Visual spot-check: browse page, listing detail, checkout, sell flow, account page, messages
- All icons inherit `currentColor` (no hardcoded hex)
- Animated spinners still spin (`className="animate-spin"`)

---

## Step 2: EmptyState + Spinner Components (half day)

Extract the repeated empty state pattern (10 variations across 11 files) into a shared component.

Also add a `Spinner` component — `CircleNotch` + `animate-spin` appears 5 times (button.tsx, MessageInput, GameSearchStep, VersionStep, PhotoUploadStep). Wrap it once.

### Component design
```tsx
// src/components/ui/empty-state.tsx
interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>
  title: string
  description?: string
  action?: { label: string; href: string }
  className?: string
}
```

### Files to refactor

**Full empty states (icon + title + description + CTA)**:
- `src/app/[locale]/browse/page.tsx` (lines ~134-187) — 2 variants: filtered no-results + no listings
- `src/app/[locale]/account/favorites/page.tsx` (lines ~50-74) — heart icon + browse CTA
- `src/components/messages/ConversationList.tsx` (lines ~12-35) — chat icon, no CTA
- `src/app/[locale]/listings/[id]/page.tsx` (lines ~140-168) — prohibition icon + browse CTA
- `src/components/errors/ErrorFallback.tsx` (lines ~26-37) — warning icon

**Simpler empty states (text only, inside Cards)**:
- `src/app/[locale]/account/listings/MyListingsTabs.tsx` (lines ~71-81) — text + CTA
- `src/app/[locale]/account/orders/OrderTabs.tsx` (lines ~53-63) — text + CTA
- `src/app/[locale]/account/wallet/page.tsx` (lines ~47-54) — text only
- `src/app/[locale]/sellers/[id]/page.tsx` (lines ~112-128, ~136-143) — text only (2 spots)
- `src/app/[locale]/staff/orders/page.tsx` (lines ~84-89) — text only

### Register in index
- Add to `src/components/ui/index.ts`

### Verification
- `pnpm build` passes
- All 10 empty states render identically to before

---

## Step 3: Breadcrumb Component (half day)

Extract 3 inline breadcrumb implementations into a shared component.

### Component design
```tsx
// src/components/ui/breadcrumb.tsx
interface BreadcrumbProps {
  items: { label: string; href?: string }[]
  className?: string
}
```
- Last item renders as plain text (non-link), `text-semantic-text-secondary`
- Other items render as `<Link>` with `truncate` class
- Separators: `/` with `mx-2 shrink-0`
- Container: `nav` element, `text-sm text-semantic-text-muted flex items-center min-w-0`

### Files to refactor
- `src/app/[locale]/listings/[id]/page.tsx` (lines ~179-186) — Browse / Game Name
- `src/app/[locale]/checkout/[listingId]/page.tsx` (lines ~178-189) — Browse / Game / Checkout
- `src/components/orders/OrderDetailClient.tsx` (lines ~67-74) — Your Orders / Order #

### Register in index
- Add to `src/components/ui/index.ts`

### Verification
- `pnpm build` passes
- Breadcrumbs render identically, truncation works on mobile

---

## Step 4: Pagination Component (half day)

Extract the single pagination implementation and enhance with page numbers.

### Component design
```tsx
// src/components/ui/pagination.tsx
interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  buildUrl: (page: number) => string
  className?: string
}
```
- Shows "Showing X-Y of Z" on left
- Page numbers with ellipsis (1 ... 4 5 6 ... 20) on right
- Previous/Next buttons using `Button variant="secondary" size="sm"`
- Server component compatible (uses `<Link>`, not `onClick`)

### Files to refactor
- `src/app/[locale]/browse/page.tsx` (lines ~208-230) — extract and replace

### Register in index
- Add to `src/components/ui/index.ts`

### Verification
- `pnpm build` passes
- Pagination works correctly on browse page with various page counts

---

## Step 5: Tabs Component (half day)

Extract 4 inline tab implementations. Two visual styles: underline tabs and pill tabs.

### Two components, not one

State-based tabs and link-based navigation tabs are fundamentally different. Forcing one component to do both always gets messy. Build both from the start:

**`Tabs`** — state-based, client component, `onTabChange` callback:
```tsx
interface TabItem { key: string; label: string; count?: number }
interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (key: string) => void
  className?: string
}
```

**`NavTabs`** — link-based, renders `<Link>`, server-compatible:
```tsx
interface NavTabItem { key: string; label: string; href: string; count?: number }
interface NavTabsProps {
  tabs: NavTabItem[]
  activeTab: string
  variant?: 'underline' | 'pill'
  className?: string
}
```

### Files to refactor
- `src/app/[locale]/account/listings/MyListingsTabs.tsx` (lines ~40-68) → `Tabs` (underline, with counts)
- `src/app/[locale]/account/orders/OrderTabs.tsx` (lines ~22-50) → `Tabs` (underline, with counts)
- `src/app/[locale]/staff/layout.tsx` (lines ~19-44) → `NavTabs` (underline, link-based)
- `src/app/[locale]/staff/orders/page.tsx` (lines ~58-82) → `NavTabs` (pill variant, link-based)

### Register in index
- Add to `src/components/ui/index.ts`

### Verification
- `pnpm build` passes
- Active/inactive states, count badges, hover effects all preserved

---

## Step 6: Alert Enhancement (2-3 hours)

Add structured layout to existing Alert component. Backward compatible.

### Changes to `src/components/ui/alert.tsx`
- Add optional `icon` prop (Phosphor icon component)
- Add optional `title` prop (string)
- When `title` provided, render: icon | title + children stacked
- When only `children` provided, render as-is (backward compatible)

### Verification
- `pnpm build` passes
- Existing Alert usage unchanged
- New icon+title layout tested on at least one page

---

## Step 7: ListingCard Enhancements (1 day)

### Changes to `src/components/listings/ListingCard.tsx`
- **Image hover zoom**: Add `overflow-hidden` to image container, `group-hover:scale-105 transition-transform duration-300` to `<Image>` / image element
- **Photo count indicator**: When `photos.length > 1`, render small badge (e.g., `Camera` icon + count) in corner of image
- **ListingCardSkeleton**: New export matching card layout with Skeleton components for image, title, badge, price

### New file
- `src/components/listings/ListingCardSkeleton.tsx` (or co-located in ListingCard.tsx)

### Verification
- `pnpm build` passes
- Hover zoom visible on desktop browse page
- Photo count badge renders correctly
- Skeleton matches card dimensions

---

## Step 8: Basic Trust Indicators (2-3 days)

### What to show
- **Member since**: `users.created_at` → `formatDate()`
- **Completed sales count**: COUNT of orders with status `completed` where user is seller

### Files to create/modify
- New: `src/components/sellers/TrustIndicators.tsx` — reusable inline component
- Modify: `src/app/[locale]/sellers/[id]/page.tsx` — add to seller profile header
- Modify: `src/app/[locale]/listings/[id]/page.tsx` — add next to seller name on listing detail

### Data access
- Verify `users.created_at` is accessible via existing seller queries
- May need a small server function to count completed sales (check if `orders` table has seller_id + status columns accessible via existing RLS)

### Verification
- `pnpm build` passes
- Seller profile shows "Member since" and "X sales"
- Listing detail shows trust info next to seller
- Data is accurate (cross-check with DB)

---

## Step 9: Checkout Stepper (1-2 days)

### Reference
- Check `src/app/[locale]/sell/_components/ListingCreationFlow.tsx` — already has a step indicator. Reuse the pattern or extract a shared `Stepper` component.

### Component design
```tsx
// src/components/ui/stepper.tsx
interface StepperProps {
  steps: { label: string; id: string }[]
  currentStep: string
  className?: string
}
```
- Horizontal layout, steps connected by line
- Current step highlighted (semantic-primary)
- Completed steps show checkmark
- Mobile: may need to show only current step label with "Step X of Y"

### Files to modify
- New: `src/components/ui/stepper.tsx`
- Modify: `src/app/[locale]/checkout/[listingId]/page.tsx` — add stepper at top
- Refactor: `src/app/[locale]/sell/_components/ListingCreationFlow.tsx` — if the sell flow's existing step indicator is compatible, refactor it to use the shared Stepper too. Reduce code, don't add a second stepper pattern.

### Register in index
- Add to `src/components/ui/index.ts`

### Verification
- `pnpm build` passes
- Stepper renders on checkout page with correct step highlighting
- Mobile responsive (doesn't overflow on 375px)

---

## What to Skip

| Silk Feature | Why |
|---|---|
| Color palette (fuchsia/rose) | STG's Nordic palette is brand-aligned |
| 3-tier token architecture | Premature at current scale |
| Custom grid CSS | Tailwind grid is sufficient |
| Complex form controls | Build only when needed |
| Heavy animations | Nordic minimalism = restraint |
| Typography changes | Inter is the right choice |

---

## Completion Summary (2026-03-22)

All 9 steps completed in a single session. PRs #13-21, all merged to main.

| Step | PR | Component | Key Review Findings |
|---|---|---|---|
| 1 | #13 | Phosphor Icons | Bundle: standardized all to /ssr subpath |
| 2 | #14 | Spinner + EmptyState | Clean |
| 3 | #15 | Breadcrumb | Truncation bug for 2-item breadcrumbs, accessibility |
| 4 | #16 | Pagination | Current page was a link (no-op nav), missing aria |
| 5 | #17 | Tabs + NavTabs | Missing active indicator bar, fragile locale regex |
| 6 | #18 | Alert enhancement | Clean |
| 7 | #19 | ListingCard | Photo badge showing on unavailable listings |
| 8 | #20 | Trust indicators | Inconsistent copy, missing composite index |
| 9 | #21 | Stepper | Invalid currentStep guard, vague checkout label |

**Design system grew from 10 to 18 components.** Post-implementation review workflow caught bugs in 7 of 9 steps that would have shipped otherwise.

---

## After This Plan

- **Grid/List view toggle** — design alongside Seller Shelves (shared pattern)
- **Seller Shelves** — separate planning session for DB schema, offer system, UI
- **Trust tier badges** — after basic indicators prove valuable
- **Comparison view, Seller dashboard** — after Shelves

---

## Verification Protocol (every step)

1. `pnpm build` — must pass (catches ESLint + TypeScript errors)
2. `pnpm test` — must pass (no regressions in existing tests)
3. Visual spot-check on mobile (375px) and desktop
4. All new components use semantic tokens (no hardcoded colors)
5. New components registered in `src/components/ui/index.ts`
6. Update the Shared Components table in `CLAUDE.md` — the project context file has that table and explicitly says to update it when adding new UI components
7. Feature branch → PR → merge to main
