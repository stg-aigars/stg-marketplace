# Price Drop — Design

**Status:** Design locked, implementation deferred to follow-up PRs.
**Date:** 2026-05-26.
**Author:** Aigars Grenins (with code-review dialogue).

---

## Summary

When a seller drops a fixed-price listing's price, show the previous price struck through next to the new price for 14 days. Add a "Price drops only" filter to the browse page. Notify wanted-list matchers (in-app + email) inline with the seller's edit submit. Price increases are tracked at the data layer for symmetry but never surface visually — they silently reset the baseline so the next decrease is measured from there. Auctions are excluded by construction: `price_cents` on auctions is the current high bid, not a seller-set price.

---

## §1 — Data model & trigger

Two new nullable columns on `listings`:

```sql
alter table listings
  add column previous_price_cents integer,
  add column price_changed_at     timestamptz;
```

Both nullable; existing rows start with no drop state. A `BEFORE UPDATE FOR EACH ROW` trigger is the authoritative writer for both columns:

```sql
create function listings_track_price_change() returns trigger
language plpgsql as $$
begin
  -- Skip auctions on both sides of the type transition. Auction price_cents
  -- moves with bids and is not a seller-intent signal. Checking OLD as well
  -- as NEW closes the auction→fixed_price conversion misfire window.
  if old.listing_type <> 'fixed_price' or new.listing_type <> 'fixed_price' then
    return new;
  end if;
  if new.price_cents is distinct from old.price_cents then
    new.previous_price_cents := old.price_cents;
    new.price_changed_at     := now();
  end if;
  return new;
end $$;

create trigger trg_listings_track_price_change
before update on listings
for each row execute function listings_track_price_change();
```

**Operator choice:** `is distinct from` handles the NULL case correctly versus `<>`.

**Single-writer framing:** the trigger wins on UPDATE because it runs `BEFORE` and overwrites `NEW.previous_price_cents` / `NEW.price_changed_at` regardless of caller payload. This is not column-level GRANT-enforced — relying on the migration comment + code review to keep application code from writing the columns directly. If a future writer adds a competing `BEFORE UPDATE` trigger that runs after this one, ordering matters; flag in review.

**Direction-agnostic capture:** the trigger fires on any price change (drop or increase). Drop semantics — `new.price_cents < old.price_cents` — are applied at the read path, not the write path. Increases silently reset the baseline so the next decrease is measured from the new baseline.

**Schema scope:** retains the most recent price change only. Historical drops are not retained — by design. An event-sourced drop log is a deferred follow-up.

---

## §2 — Read path

The "drop is active right now" predicate has three conditions:

```
listing_type      = 'fixed_price'
and previous_price_cents is not null
and price_cents   < previous_price_cents
and price_changed_at > now() - interval '14 days'
and price_changed_at <= now()
```

The upper-bound `price_changed_at <= now()` is defensive against backfill / clock-skew rows that might write a future timestamp.

### (a) Card render

Every listing query that drives a card (browse, search, seller profile, wanted matches, home feed) SELECTs `previous_price_cents` and `price_changed_at` alongside the existing fields. The `Price` atom renders the strike when a caller passes `previousCents`. Visibility computed at render time, not stored.

**Performance call:** adding two columns to every listing query unconditionally inflates payload by ~16 bytes/row. At <10k listings this is negligible. State the call so a future "I see we're loading drop columns in cart line items, can we trim?" question has a written answer: yes, unconditional is intentional.

### (b) Browse filter

Supabase PostgREST cannot express "column A < column B" directly. Solution: a **`STORED` generated column** on `listings`:

```sql
alter table listings
  add column has_price_decrease boolean
  generated always as (price_cents < previous_price_cents) stored;
```

**Naming discipline:** `has_price_decrease` reflects the **directional fact only**. The 14-day visibility window is applied at query time via `price_changed_at`. Naming it `is_price_drop` would imply visibility-window awareness, which Postgres cannot express in a `STORED GENERATED` column (`now()` is not immutable).

**Trigger ↔ generated-column ordering:** `BEFORE` triggers run before `STORED` generated-column computation. The generated value reflects the trigger's updated `previous_price_cents`, not the pre-trigger value. Documented in the migration so future debugging has a written answer.

**Partial index:**

```sql
create index concurrently idx_listings_recent_drops
  on listings (price_changed_at desc)
  where has_price_decrease;
```

The `WHERE has_price_decrease` predicate makes leading the index with `has_price_decrease` redundant; `price_changed_at desc` matches the natural "newest drops first" sort. `STORED` generated columns can be referenced in partial-index predicates (`VIRTUAL` cannot — if a future "save space" optimization tries to switch to `VIRTUAL`, this index breaks).

**Filter query shape:** `query.eq('has_price_decrease', true).gt('price_changed_at', cutoffIso).lte('price_changed_at', nowIso)`.

---

## §3 — Filter wiring, sort, and combined-filter UX

**URL key:** `?priceDrops=1`. `parseFiltersFromParams` reads `get('priceDrops') === '1'` — exact parity with `expansionsOnly` / `showAuctions`. `filtersToSearchParams` emits the key only when true. `countActiveFilters` increments for `priceDrops` (same shape as the existing two booleans).

**Filter UI:** `BrowseFilters` gains a `<Checkbox>` row labelled "Price drops only", placed beneath "Auctions only". Single responsive component — no separate mobile sheet.

**Sort:** new `SortOption` enum value `'recent_drops'` → `price_changed_at DESC`. When `priceDrops=1` flips on and the current sort is `'newest'`, the URL writer rewrites to `'recent_drops'`. User-picked sorts (`price_asc`, `price_desc`) survive untouched. The sort dropdown surfaces "Recent drops" as a label only when `priceDrops=1` is active. **Not** a runtime semantic shift of the existing `'newest'` value — the enum value visible to telemetry and shareable URLs always matches what the query is doing.

**Combined-filter behavior:** `priceDrops=1 + showAuctions=1` is empty by construction (auctions don't have `has_price_decrease=true`). Both checkboxes stay enabled; the empty state renders with copy framed from the user's mental model: *"Price drops apply to fixed-price listings only."* Cheaper than a disabled-checkbox + tooltip pattern that risks an a11y trap (disabled inputs don't receive hover/focus events).

**Wanted-side parity:** `WantedBrowseFilters` not in scope. Wanted is buyer-side and has no price-drop concept.

---

## §4 — Notification fan-out: `wanted.price_dropped`

**Firing point:** inline in `updateListing` (`src/lib/listings/actions.ts`), after the UPDATE returns. Fire-and-forget via `void notifyWantedPriceDropped(...).catch(...)`. Same pattern as `logAuditEvent` and existing `void notify(...)` calls.

**Why inline, not DB-trigger + LISTEN:** `LISTEN` requires a long-lived connection, which Next.js serverless functions don't have. A NOTIFY/LISTEN bridge would require a separate worker process — new infra component, new failure mode, new deploy concern — for a feature that fires on seller edit submits (already a request-bound moment).

**Pre-fetch extension:** `updateListing`'s pre-update SELECT currently reads `'seller_id, status, listing_type, bid_count, photos'`. Add `'price_cents'` so the fan-out can compute `fromCents = OLD.price_cents` without a second round-trip.

**Recipient query** — reuses the existing coarse "watching this BGG game" semantics from `notifyWantedListingMatches`:

```sql
select buyer_id
  from wanted_listings
 where bgg_game_id = $1
   and status = 'active'
   and buyer_id <> $2  -- self-notify guard
```

No `max_price_cents` filter, no condition filter — those fields don't exist on `wanted_listings` today. If they ship later, both wanted fan-out paths thread them together.

**Shared helper boundary:** extract `findActiveWantedMatchers(bggGameId, sellerId)` returning the buyer-ID list. Both `notifyWantedListingMatches` (existing) and `notifyWantedPriceDropped` (new) consume it. **Not shared:** the notify call, dedup check, email template, analytics event — each fan-out path owns its downstream. Docstring on the helper states this explicitly to prevent a future "let's merge these with a `type` parameter" refactor.

**Listing-status check:** unnecessary inside the fan-out — `updateListing` already gates `listing.status === 'active'` before the UPDATE runs.

**Dedup window:** **14 days**, matching the visibility window. The dedup query:

```sql
select 1 from notifications
 where user_id = $u
   and type    = 'wanted.price_dropped'
   and context->>'listingId' = $l
   and created_at > now() - interval '14 days'
```

`context->>'listingId'` is a JSONB extraction — won't use a btree index. At <100 notifications/user/14d typical, sequential scan over the user's recent rows is acceptable. A top-level `listing_id` column on `notifications` would index cleanly but is overkill for one query.

**Percent-drop floor:** none in v1. €30 → €29.99 fires fan-out. Tuning lever deferred to v2 once data accrues.

**Self-notify guard:** existing `.neq('buyer_id', sellerId)` pattern.

**Channels:** in-app (via `notify()`) **+ email** (new template `sendListingPriceDroppedToBuyer`). Matches existing `wanted.listing_matched` pattern. Email-fatigue concern noted; v2 fix is per-type email preferences in account settings.

**Copy** (warm-specific register, mirroring `wanted.listing_matched`):

```ts
'wanted.price_dropped': {
  title: () => 'A game you want dropped in price',
  body: (ctx) => `${ctx.gameName ?? 'A game'} dropped from ${formatCents(ctx.fromCents)} to ${formatCents(ctx.toCents)}.`,
  link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : '/wanted',
},
```

**Prefix migration:** none needed. `wanted.` is already in `notifications_type_check` (migration 119).

**Audit event:** none. Price-drop fan-out is a notification, not a regulatory action. The price change itself is implicitly captured via `previous_price_cents`. Documented as a non-event so a future reader doesn't speculatively add one to the regulatory register.

**Analytics:** new server-side event `listing_price_dropped`. Payload: `{ listingId, sellerId, fromCents, toCents, percentDrop, wantedMatchCount }`. Extends `AnalyticsEventMap`. Fires after the matcher count is known, fire-and-forget, doesn't block the action return.

**Order of operations in `updateListing`:**

1. Trigger sets `previous_price_cents` / `price_changed_at` (DB-side, atomic with UPDATE).
2. Detect drop locally (compare pre-fetched `OLD.price_cents` vs payload).
3. If drop: `void notifyWantedPriceDropped(...)` — fan-out + analytics fire inside, both fire-and-forget. Analytics consumes the matcher count from the same query the fan-out used.
4. Return `{ success: true }` to the client.

The action returns immediately; the fan-out and analytics complete on the request's tail.

**Staff price-edit path:** no such code exists today. The trigger would still fire if staff gained edit capability; the inline fan-out would not. Memo'd.

**Bulk-edit path:** future feature would produce N× fan-outs per request. Memo'd as deferred concern.

---

## §5 — Visual render

### Pure helper (`src/lib/listings/price-drop.ts`)

```ts
import type { ListingType } from './types';

export const PRICE_DROP_WINDOW_DAYS = 14;

/**
 * Single source of truth for "is this listing's price drop visible right now?"
 *
 * SQL mirror: see the `has_price_decrease` generated column on `listings`
 * (directional fact) + the `price_changed_at` predicate applied in the
 * browse query builder (freshness window). Helper computes all conditions
 * inline; SQL short-circuits the directional check via the generated column.
 * Semantics are identical — any change to one must update the other.
 *
 * SSR caching: helper computes against `Date.now()` at render time. Browse
 * pages are dynamic (searchParams forces dynamic rendering), so the visual
 * is always fresh today. A future PPR/ISR migration touching browse would
 * need to revisit — a cached card could show a stale strike up to the
 * revalidate TTL after the 14d boundary.
 */
export function isPriceDropActive(listing: {
  listing_type: ListingType;
  price_cents: number;
  previous_price_cents: number | null;
  price_changed_at: string | null;
}): boolean {
  if (listing.listing_type !== 'fixed_price') return false;
  if (listing.previous_price_cents == null || listing.price_changed_at == null) return false;
  if (listing.price_cents >= listing.previous_price_cents) return false;
  const now = Date.now();
  const changedAt = new Date(listing.price_changed_at).getTime();
  if (changedAt > now) return false; // clock-skew / backfill defense
  const cutoff = now - PRICE_DROP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return changedAt > cutoff;
}
```

Pure ts, environment-neutral. No `'use client'`, no `'server-only'`, no `next/headers`. Importable from server query, client render, server action.

### Atom change (`src/components/listings/atoms/Price.tsx`)

```tsx
interface PriceProps {
  cents: number;
  previousCents?: number;            // when set, renders <s> strike before current
  size?: 'sm' | 'md' | 'lg' | 'xl';  // 'xl' added for detail-page H1 (text-3xl)
  className?: string;
}
```

Render shape:

```tsx
<span
  className={cn(sizeClasses[size], 'font-bold font-sans tracking-tight text-semantic-text-heading', className)}
  aria-label={
    previousCents !== undefined
      ? `Price dropped from ${formatCentsToCurrency(previousCents)} to ${formatCentsToCurrency(cents)}`
      : undefined
  }
>
  {previousCents !== undefined && (
    <s className="font-normal text-semantic-text-muted mr-2" aria-hidden="true">
      {formatCentsToCurrency(previousCents)}
    </s>
  )}
  {formatCentsToCurrency(cents)}
</span>
```

**Accessibility:** outer `aria-label` carries the semantic statement ("Price dropped from X to Y"); struck inner is `aria-hidden` so screen readers don't double-read the number. Semantic `<s>` element marks "no longer accurate."

**Typography:** weight-only differential (`font-normal` inside `font-bold`) at `size='sm'` on `ListingCardMini` is a visual-review item at impl time. If contrast doesn't read, fallback is to drop the struck price one Tailwind size.

### Caller wiring

Each call site already destructures the listing; the change is one prop:

```tsx
<Price
  cents={listing.price_cents}
  previousCents={isPriceDropActive(listing) ? listing.previous_price_cents! : undefined}
  size="md"
/>
```

**Sites in scope:**

1. `ListingCard` (desktop browse / search / wanted matches / home feed).
2. `ListingCardMini` (mobile 2-col grid).
3. Listing detail page H1 area at `src/app/[locale]/listings/[id]/page.tsx:443-445` — currently inlines `formatCentsToCurrency` directly; refactor to `<Price ... size="xl" />`.
4. `PurchaseSection` (mobile sticky bar) — receives `priceCents` prop. Verify whether it renders price visibly; if yes, thread the strike there too. UX seam: a buyer who sees a struck price on the card → taps in → sees struck on the detail → scrolls → sticky bar shows only the new price = inconsistent. Close the seam in this PR.

**Sites explicitly out of scope** (per §0 surfaces decision):

- `ListingRow`, `ListingIdentity` (compact rows in post-purchase / dashboard contexts).
- Cart and order line items.

**Type updates:** wherever a listing-row shape is defined (`ListingListItem`, the detail page's `Listing` type, etc.), add `previous_price_cents: number | null` and `price_changed_at: string | null`. TypeScript catches missed SELECTs when the atom prop is wired.

---

## §6 — Testing, rollout, deferred follow-ups

### Test scope (v1)

- Co-located `price-drop.test.ts` — pure helper, boundary cases: just-now / 13d59m / 14d1m / future-dated / auction / null previous / equal / increase.
- Co-located `filters.test.ts` extension — `parseFiltersFromParams` / `filtersToSearchParams` round-trip for `priceDrops=1` + `recent_drops` sort; `countActiveFilters` counts `priceDrops`.
- Trigger test and fan-out test deferred — no migration test harness today; the trigger is verifiable by `pnpm dev` + manual edit. Helper/SQL drift detection joins the deferred integration-test harness (the same gap CLAUDE.md documents for anon-RLS regressions).

`pnpm verify` is the gate.

### Rollout — three-PR split

The "ship data layer first to warm up" pattern beats a single bundled PR. Three separately-rollbackable concerns:

**PR A — data layer (ships dark):**
- Migration 122 (transactional): columns + trigger + trigger function + generated column.
- Migration 123 (non-transactional, `-- postgres-migrations disable-transaction`): `CREATE INDEX CONCURRENTLY idx_listings_recent_drops`.
- Helper (`price-drop.ts`) + pure helper test.
- Type updates on listing row shapes.

No UI changes; no user-visible effect. Drop state accumulates on real edits between PR A merge and PR B merge — when PR B ships, real listings have real strike-throughs from day one.

**PR B — render + filter:**
- `Price` atom `previousCents` prop + `size='xl'` variant.
- Caller wiring: `ListingCard`, `ListingCardMini`, detail page H1 refactor, `PurchaseSection` mobile sticky bar.
- Filter wiring: `parseFiltersFromParams`, `filtersToSearchParams`, `countActiveFilters`, `BrowseFilters` checkbox.
- Sort: new `SortOption = 'recent_drops'`, query builder branch, dropdown label gating.
- Browse query: `.eq('has_price_decrease', true).gt('price_changed_at', cutoffIso).lte('price_changed_at', nowIso)` when `priceDrops=1`.
- Empty-state copy when `priceDrops=1 + showAuctions=1`.

User-visible drops appear.

**PR C — notifications:**
- Extract `findActiveWantedMatchers(bggGameId, sellerId)` from existing `notifyWantedListingMatches`.
- New `notifyWantedPriceDropped` consuming the shared matcher.
- New notification type `wanted.price_dropped` in `templates.ts` + `types.ts`.
- New email template `sendListingPriceDroppedToBuyer`.
- New analytics event `listing_price_dropped` in `AnalyticsEventMap`.
- Wire fan-out + analytics into `updateListing` post-UPDATE, fire-and-forget.
- Dedup query against `notifications` table.

Riskiest of the three (email volume) — isolating it lets PR B's metrics inform whether to tune dedup or percent-floor before fan-out goes live.

### Rollback path

If PR A needs to roll back: drop in dependency order:

```sql
drop index if exists idx_listings_recent_drops;          -- index references generated column
alter table listings drop column if exists has_price_decrease;  -- generated column
drop trigger if exists trg_listings_track_price_change on listings;
drop function if exists listings_track_price_change();
alter table listings drop column if exists price_changed_at;
alter table listings drop column if exists previous_price_cents;
```

Captured in the migration 122 header comment so a future rollback PR doesn't reconstruct it.

### Migration interaction note

Adding a `STORED GENERATED` column to a populated `listings` table requires Postgres to compute the value for every existing row at migration time. At current ~10k listings this is milliseconds. At 10M+ listings this would be a concern — flag in the migration comment for a future scaling reader.

### Deferred follow-ups

1. **Wanted-match algorithm prioritization** — surface price-dropped matches more prominently on the wanted dashboard.
2. **Bulk price-reduction UX** — batch fan-out + cross-listing dedup when a seller drops N listings in one request.
3. **Per-type email preferences** — granular toggles in account settings (the right v2 fix if email-fatigue surfaces).
4. **Multi-step descent notifications** — currently 14d dedup means a buyer doesn't get re-pinged on a second drop within the window. Tighten dedup or send "biggest drop in window" digest if feedback warrants.
5. **Percent-drop floor** — fire fan-out only if `(prev − current) / prev >= X%`. Data-driven tuning lever.
6. **Staff price-edit path** — when staff gets price-edit capability, thread the same fan-out (trigger fires regardless).
7. **Historical drop log** — current schema retains only the most recent change. Analytics queries ("which sellers drop most?") would need an event-sourced log.
8. **Integration test harness** — anon-RLS regression gap (CLAUDE.md) + helper/SQL drift test would join it.
9. **Listing detail "Price history" affordance** — buyer-facing tooltip on detail page.
10. **VIRTUAL → STORED constraint** — if a future "save index space" optimization tries to switch `has_price_decrease` to `VIRTUAL`, the partial index breaks. Already noted in the migration comment.

---

## Out-of-scope clarifications

- **Auctions:** excluded by construction at the trigger level. `price_cents` on auctions is the current high bid, not seller intent.
- **Wanted-side filter parity:** wanted is buyer-side, no price-drop concept. `WantedBrowseFilters` untouched.
- **`ListingRow` / `ListingIdentity`:** compact rows in dashboard / management surfaces. Drop story irrelevant once past browse.
- **Cart and order line items:** post-purchase context, intentionally untouched.
- **Audit event:** none. Price-drop fan-out is a notification, not a regulatory action.

---

## Decisions locked

| Decision | Choice | Source |
|---|---|---|
| Old-price basis | Most recent previous price (single column) | §0 |
| Visibility window | 14 days, both strike + filter | §0 |
| Surfaces | Detail page, card grid (desktop + mobile), notifications | §0 |
| Update semantics | Any change updates marker; only drops visible | §0 |
| Notification recipients | Wanted-list matchers only | §0 |
| Visual treatment | Strikethrough + current, no badge, no percentage | §0 |
| Generated column name | `has_price_decrease` (directional fact only) | §2 |
| Sort interaction | New `'recent_drops'` enum, not semantic shift of `'newest'` | §3 |
| Combined-filter UX | Both checkboxes enabled, EmptyState explains | §3 |
| Dedup window | 14d (matches visibility) | §4 |
| Channels | In-app + email (matches existing `wanted.listing_matched`) | §4 |
| Percent-drop floor | None in v1 | §4 |
| Accessibility | `<s>` + `aria-label` on wrapper | §5 |
| Rollout | Three-PR split (data → render → notifications) | §6 |
