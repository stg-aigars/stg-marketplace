# Seller Order-Stage Helper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a seller-only, per-stage "next steps" helper to the order detail page, with the Accepted stage showing a packaging-guide link and a collapsible locker finder.

**Architecture:** A reusable `OrderStageHelper` (`switch(status)`, content only for `accepted` today) renders inside `OrderDetailClient`. The Accepted card holds a packing-guide link plus a collapsed-by-default `LockerFinder` that reuses the existing `TerminalMap` in a read-only "directions" mode. The order page fetches Unisend terminals only for seller + accepted views.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind, Vitest + React Testing Library (jsdom), Mapbox GL (via `@/components/ui/map`), Unisend terminal API.

**Design ref:** `docs/plans/2026-06-01-seller-order-stage-helper-design.md` (read the "Review resolutions" section — it records why there's no `seller_country` hide-branch, why copy is inline English, and why drop-off accuracy holds).

**Conventions to honor:**
- Inline English literals (no next-intl) — matches `OrderDetailClient` and `TerminalMap`.
- Shared UI only: `Button`, `Card`, `CardBody`, `InlineArrowLink` from `@/components/ui`; `MapPin` from `@phosphor-icons/react/ssr`.
- No hardcoded colors — semantic tokens only.
- Transitions: `duration-250 ease-out-custom`.
- No exclamation marks in copy.
- Component tests are co-located `*.test.tsx` with a `// @vitest-environment jsdom` first line (vitest default env is `node`), using `render/screen/cleanup` from `@testing-library/react` and `afterEach(cleanup)`.
- Money is irrelevant here; no cents handling.

**Do NOT touch:** payment, auth, or DB schema. No migrations. The only checkout-critical file touched is `TerminalMap.tsx`, and only additively (new optional prop defaulting to current behavior).

---

## Task 1: Extract a testable popup body + add `popupAction` to TerminalMap

Rationale: Mapbox can't render in jsdom, so the popup body is extracted into a pure presentational component that can be unit-tested in isolation. `TerminalMap` gets one optional prop, `popupAction`, defaulting to `'select'` (checkout unchanged).

**Files:**
- Create: `src/components/checkout/TerminalPopupContent.tsx`
- Create: `src/components/checkout/TerminalPopupContent.test.tsx`
- Modify: `src/components/checkout/TerminalMap.tsx`

**Step 1: Write the failing test**

Create `src/components/checkout/TerminalPopupContent.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TerminalPopupContent } from './TerminalPopupContent';
import type { TerminalOption } from '@/lib/services/unisend/types';

const terminal: TerminalOption = {
  id: 'LV101',
  name: 'Rimi Centrs',
  city: 'Riga',
  address: 'Brivibas iela 1',
  postalCode: 'LV-1010',
  countryCode: 'LV',
  latitude: '56.9496',
  longitude: '24.1052',
};

afterEach(cleanup);

describe('TerminalPopupContent', () => {
  it('renders the Select terminal button by default (checkout behavior)', () => {
    render(<TerminalPopupContent terminal={terminal} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Select terminal' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Get directions' })).toBeNull();
  });

  it('calls onSelect when the Select button is clicked', () => {
    const onSelect = vi.fn();
    render(<TerminalPopupContent terminal={terminal} onSelect={onSelect} />);
    screen.getByRole('button', { name: 'Select terminal' }).click();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('renders a Get directions link in directions mode with a maps URL and safe rel', () => {
    render(<TerminalPopupContent terminal={terminal} action="directions" onSelect={() => {}} />);
    const link = screen.getByRole('link', { name: 'Get directions' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=56.9496,24.1052'
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('button', { name: 'Select terminal' })).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/checkout/TerminalPopupContent.test.tsx --reporter=verbose`
Expected: FAIL — cannot resolve `./TerminalPopupContent`.

**Step 3: Write minimal implementation**

Create `src/components/checkout/TerminalPopupContent.tsx`:

```tsx
import { Button } from '@/components/ui';
import type { TerminalOption } from '@/lib/services/unisend/types';

export type TerminalPopupAction = 'select' | 'directions';

interface TerminalPopupContentProps {
  terminal: TerminalOption;
  /** 'select' (default) shows the checkout "Select terminal" button.
   *  'directions' shows a read-only "Get directions" link (locker finder). */
  action?: TerminalPopupAction;
  onSelect: () => void;
}

export function TerminalPopupContent({ terminal, action = 'select', onSelect }: TerminalPopupContentProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-semantic-text-heading text-sm">{terminal.name}</h4>
      <p className="text-xs text-semantic-text-secondary">
        {terminal.address}, {terminal.postalCode}
      </p>
      <p className="text-xs text-semantic-text-secondary">{terminal.city}</p>
      {action === 'directions' ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${terminal.latitude},${terminal.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-2 text-center text-sm font-medium text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
        >
          Get directions
        </a>
      ) : (
        <Button type="button" size="sm" onClick={onSelect} className="w-full mt-2">
          Select terminal
        </Button>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/components/checkout/TerminalPopupContent.test.tsx --reporter=verbose`
Expected: PASS — 3 tests.

**Step 5: Refactor TerminalMap to use it + accept `popupAction`**

In `src/components/checkout/TerminalMap.tsx`:

1. Add import near the top (after the `Button` import line):
   ```tsx
   import { TerminalPopupContent, type TerminalPopupAction } from './TerminalPopupContent';
   ```
   Remove the now-unused `Button` import if nothing else uses it (check first — `grep -n "Button" src/components/checkout/TerminalMap.tsx`; the `MapPin` and other imports stay).

2. Add `popupAction` to the props interface (`TerminalMapProps`), defaulting in the destructure:
   ```tsx
   interface TerminalMapProps {
     terminals: TerminalOption[];
     selectedTerminal: TerminalOption | null;
     onSelect: (terminal: TerminalOption) => void;
     country: TerminalCountry;
     className?: string;
     popupAction?: TerminalPopupAction;   // NEW — default 'select'
   }
   ```
   ```tsx
   export function TerminalMap({
     terminals,
     selectedTerminal,
     onSelect,
     country,
     className,
     popupAction = 'select',   // NEW
   }: TerminalMapProps) {
   ```

3. Replace the popup's inner JSX (the `<div className="space-y-2">…</div>` block currently at lines ~182–200, containing the `<h4>`, two `<p>`, and the `<Button>Select terminal</Button>`) with:
   ```tsx
   <TerminalPopupContent
     terminal={popupTerminal}
     action={popupAction}
     onSelect={handleSelectFromPopup}
   />
   ```
   Leave the surrounding `<MapPopup …>` wrapper untouched.

**Step 6: Run the full suite + type-check**

Run: `pnpm test src/components/checkout/ --reporter=verbose && pnpm type-check`
Expected: PASS; no type errors. Checkout still compiles with `popupAction` unset (defaults to `'select'`).

**Step 7: Commit**

```bash
git add src/components/checkout/TerminalPopupContent.tsx src/components/checkout/TerminalPopupContent.test.tsx src/components/checkout/TerminalMap.tsx
git commit -m "refactor(checkout): extract TerminalPopupContent + add popupAction to TerminalMap"
```

---

## Task 2: `filterTerminals` pure helper

Rationale: the finder needs name/city/address search; extracting it as a pure function gives Mapbox-free test coverage of the search logic.

**Files:**
- Create: `src/lib/services/unisend/filter-terminals.ts`
- Create: `src/lib/services/unisend/filter-terminals.test.ts`

**Step 1: Write the failing test**

Create `src/lib/services/unisend/filter-terminals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterTerminals } from './filter-terminals';
import type { TerminalOption } from './types';

const t = (over: Partial<TerminalOption>): TerminalOption => ({
  id: '1', name: 'Rimi Centrs', city: 'Riga', address: 'Brivibas 1',
  postalCode: 'LV-1010', countryCode: 'LV', latitude: '0', longitude: '0', ...over,
});

const terminals = [
  t({ id: '1', name: 'Rimi Centrs', city: 'Riga', address: 'Brivibas 1' }),
  t({ id: '2', name: 'Maxima Kauns', city: 'Kaunas', address: 'Laisves 5' }),
  t({ id: '3', name: 'Depo Mezciems', city: 'Riga', address: 'Mezciema 3' }),
];

describe('filterTerminals', () => {
  it('returns all terminals for an empty/whitespace query', () => {
    expect(filterTerminals(terminals, '')).toHaveLength(3);
    expect(filterTerminals(terminals, '   ')).toHaveLength(3);
  });

  it('matches case-insensitively on name', () => {
    expect(filterTerminals(terminals, 'rimi').map((x) => x.id)).toEqual(['1']);
  });

  it('matches on city', () => {
    expect(filterTerminals(terminals, 'riga').map((x) => x.id)).toEqual(['1', '3']);
  });

  it('matches on address', () => {
    expect(filterTerminals(terminals, 'laisves').map((x) => x.id)).toEqual(['2']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterTerminals(terminals, 'zzz')).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/services/unisend/filter-terminals.test.ts --reporter=verbose`
Expected: FAIL — cannot resolve `./filter-terminals`.

**Step 3: Write minimal implementation**

Create `src/lib/services/unisend/filter-terminals.ts`:

```ts
import type { TerminalOption } from './types';

/** Case-insensitive search across name, address, and city. Empty query → all. */
export function filterTerminals(terminals: TerminalOption[], query: string): TerminalOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return terminals;
  return terminals.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q)
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/services/unisend/filter-terminals.test.ts --reporter=verbose`
Expected: PASS — 5 tests.

**Step 5: Commit**

```bash
git add src/lib/services/unisend/filter-terminals.ts src/lib/services/unisend/filter-terminals.test.ts
git commit -m "feat(unisend): add filterTerminals search helper"
```

---

## Task 3: `LockerFinder` component

Read-only finder: dynamic `TerminalMap` (in `directions` mode) + a search box, scoped to one country. When `terminals` is empty, render an unavailable message and no map (also the deterministic, Mapbox-free test path).

**Files:**
- Create: `src/components/orders/LockerFinder.tsx`
- Create: `src/components/orders/LockerFinder.test.tsx`

**Step 1: Write the failing test**

Create `src/components/orders/LockerFinder.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LockerFinder } from './LockerFinder';

afterEach(cleanup);

describe('LockerFinder', () => {
  it('shows an unavailable message and no search box when there are no terminals', () => {
    render(<LockerFinder terminals={[]} country="LV" />);
    expect(screen.getByText(/Locker map is unavailable right now/i)).toBeDefined();
    expect(screen.queryByPlaceholderText('Search lockers...')).toBeNull();
  });
});
```

(The map-present path mounts Mapbox and is covered by manual verification in Task 5, not here.)

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/orders/LockerFinder.test.tsx --reporter=verbose`
Expected: FAIL — cannot resolve `./LockerFinder`.

**Step 3: Write minimal implementation**

Create `src/components/orders/LockerFinder.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MagnifyingGlass, SpinnerGap } from '@phosphor-icons/react/ssr';
import type { TerminalOption, TerminalCountry } from '@/lib/services/unisend/types';
import { filterTerminals } from '@/lib/services/unisend/filter-terminals';

// Dynamically import the map (Mapbox) to avoid SSR issues and keep it out of the
// initial bundle — only mounts once the finder is expanded and terminals exist.
const TerminalMap = dynamic(() => import('@/components/checkout/TerminalMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-lg border border-semantic-border-default bg-semantic-bg-secondary flex items-center justify-center" role="status">
      <SpinnerGap className="w-6 h-6 animate-spin text-semantic-brand" aria-hidden="true" />
      <span className="ml-2 text-sm text-semantic-text-secondary">Loading map...</span>
    </div>
  ),
});

interface LockerFinderProps {
  terminals: TerminalOption[];
  country: TerminalCountry;
}

const NOOP = () => {};

export function LockerFinder({ terminals, country }: LockerFinderProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterTerminals(terminals, query), [terminals, query]);

  if (terminals.length === 0) {
    return (
      <p className="text-sm text-semantic-text-secondary" role="status">
        Locker map is unavailable right now — drop at any compatible parcel locker.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlass
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-muted"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lockers..."
          aria-label="Search lockers"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-semantic-border-default bg-semantic-bg-primary text-sm text-semantic-text-heading placeholder-semantic-text-muted focus:border-semantic-brand focus:ring-2 focus:ring-semantic-brand/20 outline-none transition-all duration-250 ease-out-custom"
        />
      </div>
      <TerminalMap
        terminals={filtered}
        selectedTerminal={null}
        onSelect={NOOP}
        country={country}
        popupAction="directions"
      />
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/components/orders/LockerFinder.test.tsx --reporter=verbose`
Expected: PASS — 1 test (unavailable branch returns before the dynamic map mounts).

**Step 5: Commit**

```bash
git add src/components/orders/LockerFinder.tsx src/components/orders/LockerFinder.test.tsx
git commit -m "feat(orders): add read-only LockerFinder (map + search, directions mode)"
```

---

## Task 4: `OrderStageHelper` component

Seller-only, `switch(status)`. Only `accepted` has content: a "Ship your parcel" card with a packing-guide link and a collapse toggle that mounts `LockerFinder`. Returns `null` for every other status and for the buyer role.

**Files:**
- Create: `src/components/orders/OrderStageHelper.tsx`
- Create: `src/components/orders/OrderStageHelper.test.tsx`

**Step 1: Write the failing test**

Create `src/components/orders/OrderStageHelper.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OrderStageHelper } from './OrderStageHelper';

afterEach(cleanup);

const baseProps = { sellerCountry: 'LV' as const, terminals: [] };

describe('OrderStageHelper', () => {
  it('renders the Accepted helper for a seller on an accepted order', () => {
    render(<OrderStageHelper role="seller" status="accepted" {...baseProps} />);
    expect(screen.getByText('Ship your parcel')).toBeDefined();
    const link = screen.getByRole('link', { name: /Read the packing guide/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/help/packing');
    expect(screen.getByRole('button', { name: /Find a drop-off locker/i })).toBeDefined();
  });

  it('keeps the locker finder collapsed until the button is clicked', () => {
    render(<OrderStageHelper role="seller" status="accepted" {...baseProps} />);
    // Collapsed: no finder content yet (empty terminals would show unavailable text).
    expect(screen.queryByText(/Locker map is unavailable right now/i)).toBeNull();
    screen.getByRole('button', { name: /Find a drop-off locker/i }).click();
    expect(screen.getByText(/Locker map is unavailable right now/i)).toBeDefined();
  });

  it('renders nothing for non-accepted statuses', () => {
    const { container } = render(<OrderStageHelper role="seller" status="shipped" {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for the buyer role', () => {
    const { container } = render(<OrderStageHelper role="buyer" status="accepted" {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/orders/OrderStageHelper.test.tsx --reporter=verbose`
Expected: FAIL — cannot resolve `./OrderStageHelper`.

**Step 3: Write minimal implementation**

Create `src/components/orders/OrderStageHelper.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { MapPin } from '@phosphor-icons/react/ssr';
import { Button, Card, CardBody, InlineArrowLink } from '@/components/ui';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import type { OrderStatus } from '@/lib/orders/types';
import type { TerminalOption, TerminalCountry } from '@/lib/services/unisend/types';
import { LockerFinder } from './LockerFinder';

interface OrderStageHelperProps {
  role: 'buyer' | 'seller';
  status: OrderStatus;
  sellerCountry: TerminalCountry;
  terminals: TerminalOption[];
}

/**
 * Seller-only, stage-specific "next steps" helper. Today only the `accepted`
 * stage has content; other statuses are intentional extension points that
 * render nothing until their content is designed.
 */
export function OrderStageHelper({ role, status, sellerCountry, terminals }: OrderStageHelperProps) {
  if (role !== 'seller') return null;

  switch (status) {
    case 'accepted':
      return <AcceptedHelper sellerCountry={sellerCountry} terminals={terminals} />;
    default:
      return null;
  }
}

function AcceptedHelper({
  sellerCountry,
  terminals,
}: {
  sellerCountry: TerminalCountry;
  terminals: TerminalOption[];
}) {
  const [showFinder, setShowFinder] = useState(false);

  return (
    <Card>
      <CardBody>
        <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-3')}>Ship your parcel</h2>

        <p className="text-sm text-semantic-text-secondary">
          New to shipping board games? A few minutes of padding saves a damaged-in-transit
          dispute.{' '}
          <InlineArrowLink href="/help/packing" size="sm">
            Read the packing guide
          </InlineArrowLink>
        </p>

        <div className="mt-4 pt-4 border-t border-semantic-border-subtle">
          {!showFinder ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowFinder(true)}
            >
              <MapPin size={16} className="mr-1.5" />
              Find a drop-off locker
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-semantic-text-secondary">
                Drop at whichever compatible locker is closest to you.
              </p>
              <LockerFinder terminals={terminals} country={sellerCountry} />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
```

Note: confirm `InlineArrowLink` accepts `size="sm"` and renders an `<a>` (it does per the shared-components table). If its icon/label arrangement differs, keep the `href`/children and drop `size` rather than inventing props.

**Step 4: Run test to verify it passes**

Run: `pnpm test src/components/orders/OrderStageHelper.test.tsx --reporter=verbose`
Expected: PASS — 4 tests.

**Step 5: Commit**

```bash
git add src/components/orders/OrderStageHelper.tsx src/components/orders/OrderStageHelper.test.tsx
git commit -m "feat(orders): add seller-only OrderStageHelper with Accepted-stage content"
```

---

## Task 5: Wire into the order page (data fetch + render) and verify end-to-end

Fetch terminals only for seller + accepted; render the helper in `OrderDetailClient` right after the barcode card. No new unit tests (server-component data wiring); covered by `pnpm verify` + manual smoke.

**Files:**
- Modify: `src/app/[locale]/orders/[id]/page.tsx`
- Modify: `src/components/orders/OrderDetailClient.tsx`

**Step 1: Thread terminals through the page**

In `src/app/[locale]/orders/[id]/page.tsx`:

1. Add imports:
   ```tsx
   import { getAllTerminals } from '@/lib/services/unisend/client';
   import { isTerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
   ```

2. After `userRole` is computed (line ~48) and before/around the existing `Promise.all`, add a gated terminal fetch. Keep it parallel-friendly — fetch only when needed:
   ```tsx
   const needsStageTerminals =
     userRole === 'seller' &&
     order.status === 'accepted' &&
     isTerminalCountry(order.seller_country);

   const stageTerminalsPromise: Promise<TerminalOption[]> = needsStageTerminals
     ? getAllTerminals()
         .then((all) =>
           all
             .filter((t) => t.countryCode === order.seller_country)
             .map((t) => ({
               id: t.id, name: t.name, city: t.city, address: t.address,
               postalCode: t.postalCode, countryCode: t.countryCode,
               latitude: t.latitude, longitude: t.longitude,
             }))
         )
         .catch(() => [])
     : Promise.resolve([]);
   ```

3. Add `stageTerminalsPromise` to the existing `Promise.all` destructure so it resolves in parallel with dispute/review/tracking/messages:
   ```tsx
   const [dispute, existingReview, trackingEvents, messages, stageTerminals] = await Promise.all([
     getDispute(id),
     getReviewForOrder(id),
     hasTracking ? getTrackingEvents(id) : Promise.resolve([]),
     getOrderMessages(id),
     stageTerminalsPromise,
   ]);
   ```

4. Pass it to the client:
   ```tsx
   <OrderDetailClient
     order={orderWithDispute}
     userRole={userRole}
     sellerPhone={sellerPhone}
     existingReview={existingReview}
     isReviewEligible={isReviewEligible}
     trackingEvents={trackingEvents}
     messages={messages}
     isStaff={isStaff}
     stageTerminals={stageTerminals}
   />
   ```

**Step 2: Render the helper in OrderDetailClient**

In `src/components/orders/OrderDetailClient.tsx`:

1. Add imports:
   ```tsx
   import { OrderStageHelper } from './OrderStageHelper';
   import { isTerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
   ```

2. Add `stageTerminals` to `OrderDetailClientProps`:
   ```tsx
   stageTerminals: TerminalOption[];
   ```
   and to the destructured params in the function signature.

3. Render it immediately after the existing barcode-card block (after the `{userRole === 'seller' && order.barcode && status === 'accepted' && <BarcodeCard … />}` at lines ~178–181), before `<div className="space-y-6">`. Guard on `isStaff` (staff view suppresses seller actions) and on a valid country:
   ```tsx
   {!isStaff && isTerminalCountry(order.seller_country) && (
     <div className="mb-6">
       <OrderStageHelper
         role={userRole}
         status={status}
         sellerCountry={order.seller_country}
         terminals={stageTerminals}
       />
     </div>
   )}
   ```
   (`OrderStageHelper` itself returns `null` for buyers and non-accepted statuses, so this only paints for seller + accepted; the wrapper `mb-6` only adds margin when something renders — acceptable, but if an empty-margin div bothers you, move the spacing inside `AcceptedHelper`.)

**Step 3: Type-check + targeted tests**

Run: `pnpm type-check && pnpm test src/components/orders/ src/components/checkout/ src/lib/services/unisend/ --reporter=verbose`
Expected: no type errors; all new + existing orders/checkout/unisend tests pass.

**Step 4: Full pre-deploy gate**

Run: `pnpm verify`
Expected: `type-check && lint && test && build` all green. If the empty-margin wrapper trips a lint rule or you moved spacing, re-run.

**Step 5: Manual smoke (Mapbox + geolocation can't be unit-tested)**

Run `pnpm dev`, then as a **seller** open an **accepted** order:
- [ ] "Ship your parcel" card appears after the barcode, before "Mark as shipped".
- [ ] "Read the packing guide" link opens `/help/packing`.
- [ ] "Find a drop-off locker" button expands the map + search; subtitle reads "Drop at whichever compatible locker is closest to you."
- [ ] The map's "locate me" control prompts for location and drops the "you are here" marker; lockers are the seller's country.
- [ ] Clicking a locker shows a popup with a "Get directions" link that opens Google Maps in a new tab (no "Select terminal" button).
- [ ] Search filters the list/map.
- [ ] As a **buyer** on the same/any order: no "Ship your parcel" card.
- [ ] As a seller on a **shipped/pending/completed** order: no card.
- [ ] Checkout terminal selector still shows "Select terminal" in its popups (regression check).

**Step 6: Commit**

```bash
git add src/app/\[locale\]/orders/\[id\]/page.tsx src/components/orders/OrderDetailClient.tsx
git commit -m "feat(orders): render OrderStageHelper on seller accepted orders"
```

---

## Post-implementation

- REQUIRED: run the `post-implementation-review` skill before merging (per project workflow: code review + simplify + observations).
- Push the branch and open a PR to `main`. The PR description must flag that **no new design-system component** was added (all reuse `@/components/ui`), and note the additive `TerminalMap.popupAction` prop as the only checkout-surface change.
- Delete the feature branch (local + remote) after merge.
