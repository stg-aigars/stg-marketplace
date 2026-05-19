# Seller Card Redesign — Listing Detail Page

**Status:** Design approved, ready to implement
**Author:** Aigars + Claude (brainstorming session, 19 May 2026)
**Touches:** `src/app/[locale]/listings/[id]/page.tsx`, `src/components/ui/badge.tsx`, new `src/components/sellers/EarlyMemberBadge.tsx`, `src/lib/services/sellers.ts`

## Why

The Seller card today stacks eight pieces of info in tight grey text (avatar, name, country flag, country name, "Member since X", sales count, rating, trust badge, plus a two-line legal notice). On mobile the strongest trust signals (rating + trust badge) sit *below* the weak signal (the name, which is unknown to most buyers on a new marketplace). The legal notice dominates the visual weight even though it's the least urgent piece at this point in the flow.

The card's primary job is **profile entry point** — give the buyer a clear doorway into the seller's other listings and reviews. Trust signals support that decision; legal disclosure stays visible but recedes.

## Decisions

| Decision | Chosen |
|---|---|
| Primary job of card | Profile entry point |
| Legal notice placement | Compact one-line at bottom (no popover) |
| Visible metadata | Larger avatar; name + 🇱🇻 flag inline (no country text); member since; active listings; sales count; rating; trust badge; **new** early-member badge |
| Tap target scope | Identity row only (avatar + name + flag + chevron) |
| Active-listings framing | Simple count "12 listings" — no "other" / "total" framing |
| Early-member cutoff | `created_at < '2026-09-01T00:00:00Z'` (covers 31 Aug inclusive) |
| Early-member label | "Early member" |
| Early-member visual | Sparkle icon, accent-gold tokens (`semantic-accent` / `semantic-accent-bg`) |

## Layout

### Mobile (≤ lg, ~375px content area)

```
┌──────────────────────────────────────────────────┐
│ ┌────┐  Aigars Grēniņš  🇱🇻                   › │
│ │ 64 │  Member since April 2026                  │
│ │ px │                                           │
│ └────┘  👍 100% (1)                              │
│         [🛡 Bronze seller]  [✨ Early member]    │
│         12 listings · 5 sales                    │
│ ──────────────────────────────────────────────── │
│ Private seller · EU 14-day right does not apply  │
│ · How returns work →                             │
└──────────────────────────────────────────────────┘
```

### Desktop (lg+, ~600px card width)

Rating + both badges fit one line:

```
┌────────────────────────────────────────────────────────────────┐
│ ┌────┐  Aigars Grēniņš  🇱🇻                                 › │
│ │ 64 │  Member since April 2026                                │
│ └────┘  👍 100% (1)   [🛡 Bronze]   [✨ Early member]          │
│         12 listings · 5 sales                                  │
│ ────────────────────────────────────────────────────────────── │
│ Private seller · EU 14-day right does not apply · How… →       │
└────────────────────────────────────────────────────────────────┘
```

### Reading order (top-to-bottom)

1. **Identity row** — Avatar (`size="lg"`, 64px) + Name (linked) + 🇱🇻 flag inline + chevron `›` at far right. The whole row is one `<Link>` to `/sellers/[id]`. Hover/press state on the row.
2. **Member since** — small muted line directly under name (`formatMonthYear` → "April 2026").
3. **Rating row** — `<SellerRating>` block (existing component).
4. **Badges row** — Trust badge + Early-member badge. Wraps to two lines on narrow mobile via `flex flex-wrap gap-2`.
5. **Stats line** — "X listings · Y sales" (`text-sm text-muted`).
6. **Divider** — `border-t border-semantic-border-subtle` separating data from legal.
7. **Legal one-liner** — `text-xs text-muted`, single line: "Private seller · EU 14-day right does not apply · How returns work →". The `How returns work` segment is the existing inline link to `/terms#cancellations-refunds`.

## Code shape

### New: `Badge variant="accent"` in `src/components/ui/badge.tsx`

Adds an `accent` value to `BadgeVariant` and a matching entry in `variantClasses`:

```ts
accent: 'bg-semantic-accent-bg text-semantic-accent border-semantic-accent',
```

Reusable for future warm-gold accents (early-member badge today; potentially "Featured" or "Verified collector" later — the variant is the design-system primitive, not the early-member-specific styling).

### New: `EarlyMemberBadge` component at `src/components/sellers/EarlyMemberBadge.tsx`

```tsx
import { Sparkle } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui';

export function EarlyMemberBadge() {
  return (
    <Badge variant="accent">
      <span className="inline-flex items-center gap-1">
        <Sparkle size={14} weight="fill" />
        Early member
      </span>
    </Badge>
  );
}
```

Mirrors `TrustBadge` shape — props-free, self-contained. Callers decide whether to render it via `isEarlyMember(profile.created_at)`.

### New: `EARLY_MEMBER_CUTOFF` + `isEarlyMember()` in `src/lib/services/sellers.ts`

```ts
/**
 * Sellers whose accounts were created before this cutoff get a permanent
 * "Early member" badge. Anchored to soft-launch + ~3.5 months so the badge
 * stays meaningful (scarce after 31 Aug 2026) while giving genuine
 * day-zero adopters real social capital.
 */
export const EARLY_MEMBER_CUTOFF = '2026-09-01T00:00:00Z';

export function isEarlyMember(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  return new Date(createdAt) < new Date(EARLY_MEMBER_CUTOFF);
}
```

### Modified: `listings/[id]/page.tsx`

- Add `getActiveListingCount(listing.seller_id)` to the existing parallel-fetch `Promise.all`. Function already exists at `src/lib/services/sellers.ts:25` — currently used only by `/account`. Aligns the listing detail card with the count framing used on the seller profile (`['active', 'reserved']`); decide at implementation time whether to extend `getActiveListingCount` to include `reserved` or add a sibling helper.
- Restructure the Seller card body to the layout above.
- Wrap the identity row in a single `<Link>` to `/sellers/[id]`; remove the inner `<Link>` on the name (now redundant).
- Import `isEarlyMember`, `EarlyMemberBadge`, `CaretRight` (chevron icon).

## Acceptance criteria

- [ ] Avatar in the card is 64px (`size="lg"`), matches `/sellers/[id]` page avatar
- [ ] Country flag appears inline after the seller name with no "Latvia" text
- [ ] "Member since" formats as e.g. "April 2026" (`formatMonthYear`, already adopted in PR #336)
- [ ] Trust badge renders only when `calculateTrustTier()` returns non-`new`
- [ ] Early-member badge renders only when `isEarlyMember(profile.created_at)` is true; renders independently of trust badge (both can show together)
- [ ] Active-listings count includes statuses `active` + `reserved` (matches `/sellers/[id]` framing)
- [ ] Identity row is the only tap target into `/sellers/[id]`; the name itself is no longer separately linked
- [ ] Legal notice is one muted line at the bottom of the card, separated by `border-t`
- [ ] `pnpm verify` passes (`type-check && lint && test && build`)
- [ ] Mobile width: badges row wraps without overflow at 360px viewport
- [ ] Desktop width: badges row sits inline with rating block at `lg` breakpoint

## Out of scope (deferred)

- Backporting the same redesign to `/sellers/[id]` page (its own card-style header). Worth a sibling PR once this lands.
- Showing the early-member badge in the listing-card grid (browse, related listings, seller's other listings).
- Localizing the new strings to LV/LT/ET. English-only for now per the launch plan; translation strings live in `messages/en.json` for the legal notice, hardcoded for everything else (matches surrounding code).

## Branch / PR strategy

- Branched from `main`, not from `feature/listing-detail-polish` (PR #336).
- This PR may conflict with PR #336 in `page.tsx` (both touch the Seller card region). Whichever merges first, the other rebases.
