# Nordic Hybrid Design System Upgrade

> **For Claude Code:** This is a multi-phase design system upgrade. Work through phases sequentially, tasks within each phase sequentially. Commit after each task with the suggested message. Run `pnpm build` after every task. Read all referenced files before modifying them. Take your time — quality over speed.

## Context

Second Turn Games has a functional Nordic-minimalist design system built on the Nord color palette, Inter font, and 18 shared Tailwind components. The system works but lacks personality — it's visually indistinguishable from any other Tailwind + shadcn app.

This upgrade implements the **Nordic Hybrid** direction: a clean, warm foundation (daily UI) with editorial moments (featured content, collections) and playful accents (interactions, community features). The marketplace should feel like a premium board game shop — warm, curated, trustworthy — not a generic SaaS app.

## Design Principles (reference throughout)

1. **The container is minimal; the content is vibrant** — keep the UI framework clean so board game box art provides the color energy
2. **Precision with personality** — disciplined foundations (typography, spacing, color) with distinctive touches (motion, badges, editorial moments)
3. **Teal is the brand; orange is the action** — resolve the current frost/aurora ambiguity
4. **Weight = meaning** — in both typography and icon usage, heavier = more important/interactive
5. **Square over round** — badges, icon containers, avatars, and image frames shift from circular/pill to squared with rounded corners

## Pre-work: Read These Files

Before starting any phase, read:
- `src/styles/tokens.ts` — all design tokens
- `tailwind.config.ts` — Tailwind theme extension
- `src/app/globals.css` — base styles
- `src/app/[locale]/layout.tsx` — font setup, providers
- `src/components/ui/` — all 18 shared components
- `src/components/ui/index.ts` — barrel exports
- `src/components/listings/ListingCard.tsx` — current card component
- `CLAUDE.md` — project conventions, shared components table, design system rules

---

## Phase 1: Foundation Tokens (global, instant impact)

These changes touch `tokens.ts` and `tailwind.config.ts` only. Every page in the app transforms immediately because all components use semantic token classes.

### Task 1.1: Warm the background palette

**Why:** The current `#ECEFF4` (bg-primary) has a blue-gray cast that reads clinical. Shifting to warm parchment tones makes the entire site feel like a cozy game shop.

**File:** `src/styles/tokens.ts`

**Changes to the semantic section:**

| Token | Current | New | Reason |
|-------|---------|-----|--------|
| `bgPrimary` | `#ECEFF4` | `#FAF9F6` | Warm parchment instead of cool blue-gray |
| `bgSecondary` | `#E5E9F0` | `#F5F3EF` | Warm light surface |
| `bgElevated` | `#FEFEFE` | `#FFFFFF` | True white for cards (keep contrast with warm bg) |
| `borderSubtle` | `#D8DEE9` | `#E8E5DF` | Warm border |
| `borderDefault` | `#C8CED9` | `#D4CFC7` | Warm mid border |
| `borderStrong` | `#B8BEC9` | `#C0BAB0` | Warm strong border |

Also update the Snow Storm raw palette to have warm variants available:

```ts
snow: {
  storm: '#E8E5DF',       // was #D8DEE9
  stormLight: '#F5F3EF',  // was #E5E9F0
  stormLightest: '#FAF9F6', // was #ECEFF4
  white: '#FFFFFF',        // was #FEFEFE
},
```

**Important:** Do NOT change the Polar Night, Frost, Aurora, or Condition color groups. Those stay as-is. Only Snow Storm and the semantic mappings that reference them change.

**Verify:** `pnpm build` passes. Run `pnpm dev` and visually confirm the homepage background is warm cream, not blue-gray.

**Commit:** `design: warm background palette — parchment tones replace blue-gray`

---

### Task 1.2: Update shadow tints

**Why:** Shadows currently use `rgba(46, 52, 64, X)` (polar.night) which gives them a cold blue-ish tint. Shifting to a warmer base keeps shadows consistent with the new warm backgrounds.

**File:** `src/styles/tokens.ts`

**Changes to the shadows object:**

```ts
shadows: {
  xs: '0 1px 2px rgba(26, 31, 38, 0.04)',
  sm: '0 1px 3px rgba(26, 31, 38, 0.06)',
  md: '0 4px 12px rgba(26, 31, 38, 0.08)',
  lg: '0 8px 24px rgba(26, 31, 38, 0.10)',
  xl: '0 12px 32px rgba(26, 31, 38, 0.14)',
  focus: '0 0 0 3px rgba(107, 163, 181, 0.25)',  // teal focus, not orange
},
```

Key changes:
- Base color shifts from `46, 52, 64` to `26, 31, 38` (slightly warmer dark)
- Opacity values slightly reduced for a softer feel
- `shadow-focus` changes from orange-based to teal-based (`107, 163, 181` = desaturated teal that becomes the brand color)
- `shadow-md` slightly softer with more spread

**Commit:** `design: warm shadow tints and teal focus ring`

---

### Task 1.3: Resolve brand color hierarchy

**Why:** Currently `semantic-primary` is aurora.orange (CTAs) and `semantic-trust` is frost.ice (brand). The "brand color" is ambiguous — is STG teal or orange? This resolves it: **teal is the brand**, orange is for purchase actions only.

**File:** `src/styles/tokens.ts`

**Add new semantic tokens:**

```ts
// Brand identity (teal) — links, focus, active nav, trust indicators
brand: '#6BA3B5',        // slightly desaturated from frost.ice (#88C0D0) for warmth
brandHover: '#5A9AAD',
brandActive: '#4A8A9C',

// Keep primary as orange — but now it means "purchase action" specifically
// primary, primaryHover, primaryActive stay as-is (aurora.orange family)
```

**Also add** a warm gold accent:
```ts
accent: '#C9A84C',       // warm gold for ratings, featured highlights
accentBg: '#FBF8EE',     // gold tint background
```

**File:** `tailwind.config.ts`

Add the new brand and accent tokens to the Tailwind theme so they're available as utility classes:

```ts
semantic: {
  // ... existing tokens ...
  brand: colors.semantic.brand,
  'brand-hover': colors.semantic.brandHover,
  'brand-active': colors.semantic.brandActive,
  accent: colors.semantic.accent,
  'accent-bg': colors.semantic.accentBg,
},
```

**Do NOT yet change existing components** to use these tokens. That happens in later tasks. This task only adds the tokens.

**File:** `src/styles/tokens.ts` — also change `borderFocus`:

```ts
borderFocus: '#6BA3B5',  // was aurora.orange (#D08770) — focus ring now matches brand
```

**Commit:** `design: add brand teal + accent gold tokens, teal focus ring`

---

### Task 1.4: Add motion tokens

**Why:** All transitions currently use Tailwind's 150ms default. A branded easing curve and intentional durations make interactions feel designed, not default.

**File:** `src/styles/tokens.ts`

Add a new `motion` export:

```ts
export const motion = {
  // Easing curves
  easeOut: 'cubic-bezier(0.2, 0, 0, 1)',      // primary — gentle spring for state changes
  easeIn: 'cubic-bezier(0.4, 0, 1, 0.8)',      // for exits
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',   // for movements

  // Durations
  fast: '150ms',     // micro-feedback (button press scale)
  normal: '250ms',   // standard transitions (color, opacity)
  slow: '350ms',     // state changes (hover effects, tab switches)
  slower: '500ms',   // layout shifts, page transitions

  // Composites (for CSS transition shorthand)
  hover: '300ms cubic-bezier(0.2, 0, 0, 1)',
  press: '150ms cubic-bezier(0.2, 0, 0, 1)',
  appear: '400ms cubic-bezier(0.2, 0, 0, 1)',
};
```

**File:** `src/app/globals.css`

Add CSS custom properties for the motion tokens so they can be used in Tailwind arbitrary values:

```css
:root {
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 0.8);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --duration-slower: 500ms;
}
```

**File:** `tailwind.config.ts`

Extend the Tailwind config with custom transition timing:

```ts
transitionTimingFunction: {
  'ease-out-custom': 'cubic-bezier(0.2, 0, 0, 1)',
  'ease-in-custom': 'cubic-bezier(0.4, 0, 1, 0.8)',
},
transitionDuration: {
  '250': '250ms',
  '350': '350ms',
},
```

**Commit:** `design: add branded motion tokens (easing curves + durations)`

---

## Phase 2: Typography (additive, no breaking changes)

### Task 2.1: Add Fraunces display font

**Why:** Inter alone makes everything feel like a settings page. Fraunces is a variable serif with warm, playful character — designed by Google with an optical size axis. It becomes the "editorial voice" while Inter stays as the "functional voice."

**File:** `src/app/[locale]/layout.tsx`

Add Fraunces alongside the existing Inter setup:

```ts
import { Inter } from 'next/font/google';
import { Fraunces } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz'],  // include optical size axis for better rendering at different sizes
});
```

Apply both font variables to the body:

```tsx
<body className={`${inter.variable} ${fraunces.variable} min-h-screen antialiased`}>
```

**File:** `tailwind.config.ts`

Add the display font family:

```ts
fontFamily: {
  sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
  display: ['var(--font-display)', 'Georgia', 'serif'],
},
```

**File:** `src/app/globals.css`

No changes needed — the existing `font-family: theme('fontFamily.sans')` on body stays as-is. The display font is applied selectively via `font-display` class.

**Important:** Do NOT apply `font-display` to any components yet. This task only makes the font available. Application happens in subsequent tasks.

**Verify:** `pnpm build` passes. The font is loaded but nothing visually changes yet.

**Commit:** `design: add Fraunces display font (available as font-display class)`

---

### Task 2.2: Define the typographic scale

**Why:** Establish clear rules for when each font is used, so the display font gets applied consistently and deliberately.

**File:** Create `docs/typography-guide.md` (reference doc, not code)

```markdown
# STG Typography Guide

## Font Usage Rules

| Font | Class | When to Use |
|------|-------|-------------|
| **Fraunces** (display serif) | `font-display` | Page headings (H1), game titles on cards, featured collection titles, marketing hero text, empty state headings, editorial section titles |
| **Inter** (functional sans) | `font-sans` (default) | Everything else: body text, labels, buttons, navigation, form inputs, badges, metadata, prices, system messages |

## Rules
- Fraunces is ONLY for headings and game-identity text. Never for body copy, labels, or UI chrome.
- Prices always use Inter (functional precision, not editorial flair)
- Button text always uses Inter
- Badge text always uses Inter
- When Fraunces is used, also apply `tracking-tight` (letter-spacing: -0.01em to -0.02em) for proper optical fit at display sizes
- Fraunces looks best at semibold (600) to extrabold (800). Never use it at regular (400) weight.

## Heading Scale (updated)

| Level | Desktop | Mobile | Font | Weight |
|-------|---------|--------|------|--------|
| H1 page heading | `text-3xl` (30px) | `text-2xl` (24px) | `font-display` | `font-bold` (700) |
| H2 section heading | `text-2xl` (24px) | `text-xl` (20px) | `font-display` | `font-semibold` (600) |
| H2 card subsection | `text-base` (16px) | `text-base` (16px) | `font-sans` | `font-semibold` (600) |
| Game title (card) | `text-sm` (14px) | `text-sm` (14px) | `font-display` | `font-semibold` (600) |
| Game title (detail) | `text-2xl` (24px) | `text-xl` (20px) | `font-display` | `font-bold` (700) |
```

**Do NOT update CLAUDE.md yet** — that happens in the final phase when all changes are verified.

**Commit:** `docs: add typography guide for Nordic Hybrid dual-font system`

---

### Task 2.3: Apply display font to page headings

**Why:** The single highest-impact typography change. Every page has an H1 — changing its font immediately transforms the feel.

**Files to modify:** Search for all H1 patterns using `text-2xl sm:text-3xl font-bold` across the codebase. These are the page headings defined in the Layout Standards.

For every page heading H1, add `font-display tracking-tight`:

```tsx
// Before
<h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">

// After
<h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
```

Do the same for H2 section headings (`text-xl sm:text-2xl font-semibold`):

```tsx
// Before
<h2 className="text-xl sm:text-2xl font-semibold">

// After
<h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight">
```

**Do NOT change:** card subsection H2s (`text-base font-semibold`) — these stay Inter.

**Files likely affected** (verify with grep):
- `src/app/[locale]/browse/page.tsx`
- `src/app/[locale]/account/page.tsx`
- `src/app/[locale]/account/*/page.tsx` (orders, wallet, shelf, listings, etc.)
- `src/app/[locale]/sellers/[id]/page.tsx`
- `src/app/[locale]/sell/page.tsx`
- Any other pages with H1/H2 headings

**Use grep to find all instances:**
```bash
grep -rn "text-2xl sm:text-3xl font-bold" src/app/ src/components/
grep -rn "text-xl sm:text-2xl font-semibold" src/app/ src/components/
```

**Verify:** `pnpm build` passes. Visually check the browse page and account page — headings should now be in the serif font.

**Commit:** `design: apply display font to all page headings (H1 + H2 sections)`

---

## Phase 3: Brand Color Migration

### Task 3.1: Audit current frost/orange usage

**Why:** Before changing component colors, understand exactly where frost blue and aurora orange are currently used.

**Create:** `docs/brand-color-audit.md`

Run these greps and document the results:

```bash
# Where is trust/frost used?
grep -rn "semantic-trust\|frost-ice\|frost-polar\|frost-arctic" src/components/ src/app/

# Where is primary/orange used?
grep -rn "semantic-primary\|aurora-orange" src/components/ src/app/

# Where is borderFocus / focus ring orange used?
grep -rn "border-focus\|ring-semantic" src/components/ src/app/
```

Categorize each usage into:
- **Should become brand (teal):** links, focus rings, active navigation, seller trust indicators, message buttons, "View all" links
- **Should stay orange:** "Buy now", "Checkout", "Add to cart", "Sell a game" — purchase-intent CTAs only
- **Needs evaluation:** anything unclear

**Commit:** `docs: brand color audit — categorize frost/orange usage for migration`

---

### Task 3.2: Migrate focus rings to brand teal

**Why:** Focus rings currently use aurora.orange (`semantic-border-focus`). Since we changed the token value in Task 1.3, this may already be working. Verify and fix any hardcoded orange focus rings.

**Files:** All components in `src/components/ui/`

Search for any hardcoded focus ring colors that bypass the token:
```bash
grep -rn "ring-frost\|ring-aurora\|ring-semantic-primary" src/components/
```

Replace any that should be brand-colored with `ring-semantic-border-focus` (which now maps to teal via the token change in 1.3).

**Also check:** `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `src/components/ui/button.tsx` — these have focus ring styles that need to use the updated token.

**Commit:** `design: verify all focus rings use brand teal token`

---

### Task 3.3: Migrate interactive elements to brand teal

**Why:** Links, active navigation, "View all" arrows, the message-seller button, and similar interactive elements should use brand teal instead of mixing frost and orange.

**Approach:** Work through the audit from Task 3.1. For each "should become brand" usage:

- Replace `text-semantic-trust` or `text-frost-ice` with `text-semantic-brand`
- Replace `border-semantic-trust` or `border-frost-ice` with `border-semantic-brand`
- Replace `hover:text-semantic-trust-hover` with `hover:text-semantic-brand-hover`

**Key files likely affected:**
- `src/components/layout/SiteHeader.tsx` — active nav link color
- `src/components/ui/tabs.tsx` — active tab indicator
- `src/components/ui/nav-tabs.tsx` — active tab
- `src/components/ui/pagination.tsx` — active page
- Breadcrumb link colors
- "View all →" link patterns

**Do NOT change** the primary button (it stays orange — that's the purchase-action color).

**Important:** If `text-semantic-brand` doesn't exist as a Tailwind class, verify the tailwind.config.ts from Task 1.3 correctly exposes it. You may need to add it under the semantic color group.

**Commit:** `design: migrate interactive elements from frost to brand teal`

---

## Phase 4: Badge & Icon System

### Task 4.1: Square badges

**Why:** Rounded pill badges (rounded-2xl) are generic. Squared badges (rounded-md, 6px) with slightly more structure feel more intentional and collectible.

**File:** `src/components/ui/badge.tsx`

Changes:
1. Replace `rounded-2xl` with `rounded-md` (this changes from 24px pill to 8px rounded square)
2. Increase border width from `border` (1px) to `border-[1.5px]` for slightly more presence
3. Add optional `icon` prop for condition badges (see Task 4.2)

The `variantClasses` and `conditionClasses` objects stay the same color-wise, only the shared base classes change:

```tsx
// Before
className={`inline-flex items-center rounded-2xl border px-2.5 py-0.5 text-xs font-medium ${classes} ${className}`}

// After
className={`inline-flex items-center gap-1 rounded-md border-[1.5px] px-2.5 py-0.5 text-xs font-semibold ${classes} ${className}`}
```

Note: `font-medium` → `font-semibold` for slightly more presence, and `gap-1` added for the optional icon.

**Verify:** Check browse page, listing detail, order pages — all badges should now be squared. Condition badges, status badges, and category tags all inherit this change.

**Commit:** `design: square badge shape (rounded-md) with heavier border`

---

### Task 4.2: Condition tier icons

**Why:** Adding a unique Phosphor icon per condition tier makes them instantly recognizable at a glance — buyers can read condition before reading the label.

**File:** `src/components/ui/badge.tsx`

Import Phosphor icons (from `@phosphor-icons/react/ssr` as per project convention):

```ts
import { Sparkle, Star, Check, Warning, PuzzlePiece } from '@phosphor-icons/react/ssr';
```

Add icon mapping to the condition section:

```ts
const conditionIcons: Record<ConditionKey, React.ComponentType<{ size?: number; weight?: string }>> = {
  likeNew: Sparkle,
  veryGood: Star,
  good: Check,
  acceptable: Warning,
  forParts: PuzzlePiece,
};
```

In the Badge render, when a `condition` prop is provided, render the corresponding icon:

```tsx
{condition && (() => {
  const Icon = conditionIcons[condition];
  return Icon ? <Icon size={12} weight="bold" /> : null;
})()}
{children}
```

**Verify:** Browse page shows condition badges with icons. Each tier has a unique, meaningful icon.

**Commit:** `design: add Phosphor condition tier icons to badges`

---

### Task 4.3: Status badge dots

**Why:** Order status badges benefit from a colored dot indicator for quick scanning in lists.

**File:** `src/components/ui/badge.tsx`

Add an optional `dot` prop:

```tsx
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  condition?: ConditionKey;
  dot?: boolean;  // add colored dot before label
}
```

When `dot` is true and a variant is provided, render a small colored circle before the text:

```tsx
{dot && (
  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
)}
```

The `bg-current` inherits the text color of the badge variant, so it automatically matches.

**Usage in order components:** Update order status badges to use `dot` prop where appropriate. Check `src/lib/orders/constants.ts` or wherever `ORDER_STATUS_CONFIG` maps statuses to badge variants.

**Commit:** `design: add status dot indicator to badge component`

---

### Task 4.4: Icon weight convention

**Why:** Currently all Phosphor icons use Regular weight everywhere. Mapping weights to UI states creates visual hierarchy.

**File:** Create `docs/icon-guide.md`

```markdown
# STG Icon Guide

## Weight Rules (Phosphor Icons)

| Weight | When to Use | Example |
|--------|-------------|---------|
| `light` | Decorative, background, disabled state | Empty state illustration accents |
| `regular` | UI chrome, navigation, labels (DEFAULT) | Nav icons, breadcrumb separators |
| `bold` | Interactive affordance, emphasis | Filter icon button, action icons |
| `fill` | Active/selected/toggled state | Favorited heart, selected filter, active tab |

## Import Convention
Always import from `@phosphor-icons/react/ssr` (even in client components).

## Sizing Convention
| Size | Context |
|------|---------|
| 14px | Inside badges, inline with small text |
| 16px | Next to body text (buttons, metadata rows) |
| 20px | Standalone nav/action icons |
| 24px | Inside icon containers |
| 36px | Empty state focal icons |

## Icon Container Style
- Shape: `rounded-lg` (12px), NOT circular
- Background: semantic color tint matching function
- Border: `border-[1.5px]` with matching color at 20% opacity
- Example: teal container = `bg-[#EDF5F7] border-[#6BA3B5]/20`
```

**Now apply the weight convention** across the codebase. This is a series of small changes:

**Files:** Search for Phosphor icon imports across the codebase:
```bash
grep -rn "from '@phosphor-icons/react" src/
```

For each file, evaluate icon usage against the weight rules:
- **FavoriteButton.tsx**: Heart should be `weight="regular"` when unfavorited, `weight="fill"` when favorited (likely already correct)
- **Navigation icons**: Should be `weight="regular"` for inactive, consider `weight="fill"` for active page
- **Button loading spinner** (CircleNotch): keep `weight="bold"` as established
- **Empty state icons**: Use `weight="regular"` at 36px size
- **Filter/action icons**: Use `weight="bold"`

**Do NOT try to change all icons at once.** Focus on the most visible patterns — navigation, favorites, and empty states. Other icons can be updated incrementally.

**Commit:** `docs: add icon guide; apply weight convention to key icons`

---

## Phase 5: Card Family Refactor

### Task 5.1: Create shared card atoms

**Why:** Listings appear in 6+ contexts (browse grid, hero section, shelf, orders, mobile, cart). Shared atoms enforce visual consistency while allowing purpose-built layouts.

**Create:** `src/components/listings/atoms/` directory with these files:

#### `src/components/listings/atoms/GameThumb.tsx`

A square image container with warm background fallback:

```tsx
interface GameThumbProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';  // 40px, 48px, 56px
  className?: string;
}
```

- Square aspect ratio at all sizes
- `rounded-lg` (12px) border radius
- Background: `bg-semantic-bg-secondary` (warm tone) as fallback
- When `src` is null, show a `Package` Phosphor icon as placeholder
- `object-fit: cover` for user photos, `object-fit: contain` for BGG thumbnails (distinguish via a `contain` prop or by checking if the URL is from `cf.geekdo-images.com`)

#### `src/components/listings/atoms/GameTitle.tsx`

```tsx
interface GameTitleProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  serif?: boolean;  // true = font-display, false = font-sans
  className?: string;
}
```

- Default `serif={true}` — game titles use the display font
- Truncation with `overflow-hidden text-overflow-ellipsis whitespace-nowrap`
- `tracking-tight` applied when serif is true
- Size maps: xs=11px, sm=12px, md=14px, lg=16px

#### `src/components/listings/atoms/GameMeta.tsx`

```tsx
interface GameMetaProps {
  year?: number | null;
  publisher?: string | null;
}
```

- Renders: `2019 · Stonemaier Games` (year + publisher separated by middot)
- `text-xs text-semantic-text-muted font-sans`
- Returns null if both year and publisher are null

#### `src/components/listings/atoms/Price.tsx`

```tsx
interface PriceProps {
  cents: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

- Uses existing `formatCentsToCurrency()` from `@/lib/services/pricing`
- Always `font-sans` (prices use Inter, never the display font)
- `font-bold tracking-tight`
- Size maps: sm=13px, md=15px, lg=20px

#### `src/components/listings/atoms/index.ts`

Barrel export all atoms.

**Commit:** `feat: create shared card atom components (GameThumb, GameTitle, GameMeta, Price)`

---

### Task 5.2: Refactor ListingCard to use atoms + square images

**Why:** The browse grid card is the most-seen component. This task upgrades it to use atoms, square images, and the new hover treatment.

**File:** `src/components/listings/ListingCard.tsx`

Key changes:
1. **Import and use atoms** instead of inline rendering
2. **Square image container**: Replace `h-40 sm:h-44 lg:h-48` with `aspect-square`
3. **Game title in display font**: Use `<GameTitle serif />` 
4. **Metadata line**: Add `<GameMeta>` showing year and publisher below the title
5. **Hover treatment**: teal border accent + subtle lift
   ```
   border border-semantic-border-subtle
   hover:border-semantic-brand hover:shadow-lg
   transition-all duration-350 ease-out-custom
   hover:-translate-y-0.5
   ```
6. **Photo count badge**: When listing has > 1 photo, show count in top-right of image
7. **Warm image background**: `bg-semantic-bg-secondary` behind images for fallback/loading

**Also update** `ListingCardSkeleton` to match the new card dimensions (square image area instead of landscape).

**Important:** The card's `<a>` or `<Link>` wrapping stays as-is for navigation. Only the visual presentation changes.

**Verify:** Browse page shows cards with square images, serif titles, metadata, and teal hover borders.

**Commit:** `design: refactor ListingCard — square images, display font, teal hover`

---

### Task 5.3: Create ListingRow component

**Why:** Hero sections, recommendations, cart, and autocomplete need a horizontal compact card. Currently these either don't exist or use ad-hoc markup.

**File:** Create `src/components/listings/ListingRow.tsx`

```tsx
interface ListingRowProps {
  listing: {
    id: string;
    game_name: string;
    game_year?: number | null;
    price_cents: number;
    condition: string;
    photos?: string[];
    bgg_thumbnail?: string | null;
  };
  className?: string;
}
```

Layout: horizontal flex, `GameThumb` (48px square) on left, info on right.
- `<GameTitle size="sm" serif />`
- Flex row of `<Price size="sm" />` + `<Badge condition={...} />`
- `rounded-lg border border-semantic-border-subtle shadow-sm`
- Hover: `hover:shadow-md` transition

**File:** Update `src/components/listings/index.ts` to export `ListingRow`.

**Commit:** `feat: add ListingRow component for compact horizontal listing display`

---

### Task 5.4: Create ListingCardMini component

**Why:** Mobile 2-column grid needs a compressed card variant — same visual DNA but tighter spacing, smaller type, no publisher line.

**File:** Create `src/components/listings/ListingCardMini.tsx`

Same props as `ListingCard` but:
- Square image (aspect-square)
- `<GameTitle size="xs" serif />`
- No `<GameMeta>` (too tight for mobile)
- `<Price size="sm" />`
- `<Badge>` at `text-[10px]` size
- Tighter padding: `p-2` instead of card body's `px-4 py-4`
- No photo count badge (saves space)

**Commit:** `feat: add ListingCardMini for mobile browse grid`

---

### Task 5.5: Update ShelfCard to use atoms

**Why:** Shelf cards share the same game identity atoms but show shelf status instead of condition.

**File:** `src/app/[locale]/account/shelf/ShelfItemCard.tsx` (or wherever the shelf card lives)

Update to use `GameThumb`, `GameTitle` atoms. Key differences from ListingCard:
- Shows shelf visibility status badge instead of condition badge
- Green dot indicator (8px circle, `bg-semantic-success`) on image for "open to offers" items
- Price shown only when item is listed (has a linked listing)
- Compact vertical layout

**Commit:** `design: update ShelfCard to use shared listing atoms`

---

## Phase 6: Component Upgrades

### Task 6.1: Upgrade Alert with icon support

**Why:** Alerts currently support variants but no structured icon + title layout.

**File:** `src/components/ui/alert.tsx`

Add optional `icon` prop (Phosphor icon component) alongside the existing optional `title` prop. When both are provided, render:

```
[icon] [title]
[description / children]
```

The icon should be `weight="regular"` at `size={20}`, colored to match the variant.

**Commit:** `design: add icon support to Alert component`

---

### Task 6.2: Upgrade EmptyState

**Why:** Empty states are personality moments. They should use the display font and brand-colored icons.

**File:** `src/components/ui/empty-state.tsx`

Changes:
1. Title uses `font-display tracking-tight`
2. Icon container changes from `rounded-full` to `rounded-xl` (16px), with `border-[1.5px] border-dashed border-semantic-border-default`
3. Icon color changes from muted gray to brand teal (`text-semantic-brand`)
4. Support for dual actions: primary CTA + secondary link

```tsx
interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; className?: string; weight?: string }>;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };  // add this
  className?: string;
}
```

**Commit:** `design: upgrade EmptyState — display font, squared icon container, dual actions`

---

### Task 6.3: Upgrade Avatar to squared

**Why:** Matching the "square over round" direction. Avatars shift from circular to squared with rounded corners.

**File:** `src/components/ui/avatar.tsx`

Change border radius from `rounded-full` to `rounded-lg` (12px for md, 8px for sm).

For avatars that use the brand gradient (seller profiles), the gradient shifts to the brand teal:
```
bg-gradient-to-br from-semantic-brand to-semantic-brand-active
```

**Commit:** `design: square avatar shape (rounded-lg instead of rounded-full)`

---

### Task 6.4: Upgrade form inputs

**Why:** Inputs appear on every transactional page. The warm treatment and teal focus create consistency with the broader system.

**File:** `src/components/ui/input.tsx`

Changes:
1. Input background: add `bg-[#FDFCFA]` (very slightly warm, distinguishes from card white)
2. Focus: `focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand` (teal, not orange)
3. Focus transition: `transition-all duration-250 ease-out-custom`
4. Error state: add `shadow-[0_0_0_3px_rgba(192,96,104,0.1)]` for a soft red glow alongside the border

**File:** `src/components/ui/select.tsx`

Apply the same changes for consistency.

**Commit:** `design: warm input backgrounds, teal focus rings, error glow`

---

### Task 6.5: Button refinements

**Why:** Buttons need the new motion tokens and slight visual upgrades.

**File:** `src/components/ui/button.tsx`

Changes:
1. Replace `transition-colors` with `transition-all duration-250 [transition-timing-function:cubic-bezier(0.2,0,0,1)]`
2. Primary button: add `shadow-[0_2px_8px_rgba(208,135,112,0.2)]` for a warm glow beneath the orange
3. Secondary button: hover changes from `hover:shadow-md` to `hover:shadow-md hover:border-semantic-brand` (teal accent on hover)
4. Active press: keep `active:scale-[0.98]` but add `active:shadow-sm` (shadow compresses with scale)
5. Focus ring: should already be teal from Task 3.2 — verify

**Commit:** `design: button refinements — branded motion, warm shadows, teal secondary hover`

---

## Phase 7: Page Compositions

### Task 7.1: Homepage hero upgrade

**Why:** The first thing a visitor sees. The current centered text block is functional but forgettable.

**File:** `src/app/[locale]/page.tsx` (or wherever the homepage hero section is)

The hero section changes:
1. Heading uses `font-display` at a larger size: `text-3xl sm:text-4xl font-extrabold font-display tracking-tight`
2. Add a subtle gradient background to the hero area: `bg-gradient-to-br from-semantic-bg-primary via-semantic-bg-primary to-[rgba(107,163,181,0.04)]`
3. Add trust stats below the CTA (games listed count, countries, shipping price) — these can be static numbers initially, dynamic later
4. Category chips below the hero use squared badges (the badge component change from Phase 4 handles this automatically)

**Important:** This is a layout enhancement, not a redesign. Keep the existing content structure — heading, subheading, CTA buttons — and enhance it with the display font, gradient, and trust stats.

**Commit:** `design: homepage hero — display font, gradient background, trust stats`

---

### Task 7.2: Listing detail page refinements

**Why:** This is the conversion page where buyers decide to purchase.

**File:** `src/app/[locale]/listings/[id]/page.tsx`

Changes:
1. Game title: `font-display tracking-tight` at larger size
2. Publisher/year byline: move above the title as a small uppercase label in brand teal
3. Price section: wrap in a contained area with `bg-[#FDFCFA] rounded-lg border border-semantic-border-subtle p-4` — makes the price + shipping feel like a "deal card"
4. Metadata chips (player count, playtime, weight): use squared tags with icons
5. Seller card: use squared avatar with brand gradient
6. Photo gallery: square aspect ratio for main image

**Commit:** `design: listing detail — display font title, contained price, publisher byline`

---

### Task 7.3: Seller profile refinements

**Why:** The community surface where trust is built.

**File:** `src/app/[locale]/sellers/[id]/page.tsx`

Changes:
1. Seller name in `font-display`
2. Squared avatar with brand gradient
3. Add a stats bar (sales count, positive rating, shelf count) with clear visual separation
4. Shelf section heading in `font-display`
5. Shelf filter chips use squared badges

**Commit:** `design: seller profile — display font, squared avatar, stats bar`

---

### Task 7.4: 404 page personality

**Why:** Small touch, big impression for the ~2% of visitors who hit it.

**File:** `src/app/[locale]/not-found.tsx` (or create if it doesn't exist)

- Heading: "This game has left the table" in `font-display`
- Icon: `DiceThree` or similar game-themed Phosphor icon at large size (64px) in brand teal, squared container with dashed border
- Friendly message: "The page you're looking for doesn't exist — maybe the listing was sold or removed."
- CTA: "Browse games" button

**Commit:** `design: playful 404 page with display font and game-themed icon`

---

## Phase 8: Texture & Polish

### Task 8.1: Subtle paper grain texture (optional)

**Why:** A barely-visible noise texture on the main background adds organic warmth that separates from flat-color sites. This is the "can't identify but can feel" layer.

**File:** `src/app/globals.css`

Add a very subtle noise overlay to the body:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px;
}
```

At 2.5% opacity, this is invisible on casual inspection but adds the "paper" quality that Nordic design sites have.

**Important:** Test on mobile — if it causes any performance issues (unlikely at this opacity), wrap it in a `@media (hover: hover)` to skip on touch devices.

**Commit:** `design: add subtle paper grain texture overlay`

---

### Task 8.2: Transition audit

**Why:** Replace all remaining Tailwind default transitions with the branded motion tokens.

**Files:** All components in `src/components/ui/` and `src/components/listings/`

Search for default transition classes:
```bash
grep -rn "transition-colors\|transition-shadow\|transition-opacity\|transition-all" src/components/
```

For each:
- Replace `transition-colors` with `transition-colors duration-250 ease-out-custom` (or `transition-all` where multiple properties change)
- Replace `transition-shadow` with `transition-shadow duration-250 ease-out-custom`
- Replace `transition-all` (no duration) with `transition-all duration-350 ease-out-custom`
- Any `transition-transform` gets `duration-150 ease-out-custom` (fast for press feedback)

If the custom timing function class doesn't work via Tailwind, use the CSS variable:
```
[transition-timing-function:var(--ease-out)]
```

Or add it as a Tailwind plugin/utility in the config.

**Commit:** `design: apply branded motion (easing + duration) to all transitions`

---

## Phase 9: Documentation & Cleanup

### Task 9.1: Update CLAUDE.md

Update the following sections in `CLAUDE.md`:

**Layout Standards:** Add `font-display tracking-tight` to the H1 and H2 heading specs.

**Design System Rules:** Add:
- `font-display` is for headings and game identity text only. Never for body, labels, buttons, or UI chrome.
- Prices, badges, buttons, and form labels always use `font-sans` (Inter).
- Interactive elements (links, focus rings, active states) use `semantic-brand` (teal). Purchase-intent CTAs (Buy, Checkout, Sell) use `semantic-primary` (orange).
- Badge shape is `rounded-md` (squared), not pills. Condition badges include a Phosphor tier icon.
- Icon containers use `rounded-lg` (12px), not circles.
- Image containers for game art use `aspect-square`, not fixed heights.
- All transitions use the branded easing: `duration-250 ease-out-custom` or `duration-350 ease-out-custom`.

**Shared Components table:** Add new components:
- `GameThumb`, `GameTitle`, `GameMeta`, `Price` — listing atoms in `@/components/listings/atoms`
- `ListingRow` — horizontal compact listing card in `@/components/listings`
- `ListingCardMini` — mobile compressed card in `@/components/listings`

**Commit:** `docs: update CLAUDE.md for Nordic Hybrid design system`

---

### Task 9.2: Update design tokens memory file

**File:** `memory/design_tokens.md`

Update to reflect all token changes: warm palette, brand teal, accent gold, motion tokens, squared shapes. Update the component inventory count.

**Commit:** `docs: update design tokens memory for Nordic Hybrid`

---

### Task 9.3: Final verification

Run the full verification suite:

1. `pnpm build` — must pass
2. `pnpm test` — must pass (no regressions)
3. Visual spot-check on desktop:
   - Homepage: warm background, serif headings, gradient hero
   - Browse page: square-image cards, serif game titles, teal hover borders
   - Listing detail: display font title, contained price area, square gallery
   - Account pages: serif headings, squared badges
   - Seller profile: squared avatar, serif name, stats bar
4. Visual spot-check on mobile (375px):
   - Cards fit 2-col grid with square images
   - Bottom sheet modals still work
   - Touch targets still 44px minimum
   - No horizontal overflow
5. Check badge rendering:
   - Condition badges: squared with tier icons
   - Status badges: squared with optional dots
   - Category tags: squared with warm tones
6. Check focus states:
   - Tab through interactive elements — focus rings should be teal
   - Input focus: teal ring + slight glow
7. Check transitions:
   - Card hover: smooth lift + teal border + shadow
   - Button press: scale feedback
   - Tab switching: smooth color transition

**Commit:** `verify: Nordic Hybrid design system upgrade complete`

---

## Summary

| Phase | Tasks | Scope | Impact |
|-------|-------|-------|--------|
| 1. Foundation Tokens | 1.1–1.4 | `tokens.ts`, `tailwind.config.ts`, `globals.css` | Global — every page transforms |
| 2. Typography | 2.1–2.3 | `layout.tsx`, heading elements across pages | Global — immediate personality |
| 3. Brand Color | 3.1–3.3 | Components, interactive elements | System-wide color clarity |
| 4. Badge & Icons | 4.1–4.4 | `badge.tsx`, icon usage across files | Component-level distinctiveness |
| 5. Card Family | 5.1–5.5 | `src/components/listings/` | Highest-visibility component |
| 6. Component Upgrades | 6.1–6.5 | Alert, EmptyState, Avatar, Input, Button | Supporting cast polish |
| 7. Page Compositions | 7.1–7.4 | Homepage, listing detail, seller profile, 404 | Page-level design quality |
| 8. Texture & Polish | 8.1–8.2 | `globals.css`, transition audit | Final refinement layer |
| 9. Documentation | 9.1–9.3 | CLAUDE.md, memory files, verification | System integrity |

**Estimated total effort:** 3-4 days of focused work, done over 1-2 weeks at a careful pace.

**Implementation order matters:** Phases 1-2 should be done first (they transform everything globally). Phases 3-6 can be done in any order. Phases 7-8 come last (they build on all previous changes). Phase 9 is always final.
