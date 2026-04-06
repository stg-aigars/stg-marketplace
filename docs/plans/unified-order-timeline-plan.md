# Unified Order Timeline

## Context

The order detail page currently has two separate timeline components:

1. **OrderTimeline.tsx** — shows high-level order status progression (Ordered → Accepted → Shipped → Delivered → Completed) using dates from order timestamp columns (`created_at`, `accepted_at`, `shipped_at`, `delivered_at`, `completed_at`)
2. **TrackingTimeline.tsx** — shows Unisend parcel tracking events from the `tracking_events` table, only visible when order status is `shipped`, `delivered`, or `completed`

These two timelines tell the same story from different data sources. Splitting them forces the buyer to mentally stitch together "where is my order" from two separate UI elements. This plan merges them into a single unified timeline.

Additionally, several tracking event labels are actively misleading and need correction regardless of the merge.

**Branch:** `fix/unified-order-timeline`

Read `CLAUDE.md` for full project context before starting.

---

## PR 1 — Fix tracking event labels (bug fix)

**Why first:** These labels are wrong today and mislead users. Ship independently so the fix is live even if PR 2 takes longer.

### Task 1: Fix Unisend event label mapping

**File:** `src/components/orders/TrackingTimeline.tsx` (or wherever the label mapping object lives — may be in a constants file or inline in the component)

Find the mapping from Unisend tracking states to user-facing labels. Update these entries:

| Unisend State | Current (wrong) | New (correct) |
|---|---|---|
| `PARCEL_RECEIVED` | "Dropped off at terminal" | "Arrived at pickup terminal" |
| `PARCEL_DELIVERED` | "Ready for pickup" | "Picked up" |

**Do NOT change:**
- `ON_THE_WAY` → "In transit" (correct as-is)
- `PARCEL_CANCELED` → "Shipment cancelled" (correct as-is)
- `RETURNING` → "Returning to sender" (correct as-is)
- `LABEL_CREATED` → stays hidden for now (PR 2 changes this)

**i18n:** These labels must use `next-intl` translation keys, not hardcoded English. If the current labels are hardcoded, migrate them to translation keys as part of this task. Add keys under the `Orders` namespace (or whichever namespace the existing order page strings use — check existing patterns first).

Translation key naming:

```
"tracking.ON_THE_WAY": "In transit",
"tracking.PARCEL_RECEIVED": "Arrived at pickup terminal",
"tracking.PARCEL_DELIVERED": "Picked up",
"tracking.PARCEL_CANCELED": "Shipment cancelled",
"tracking.RETURNING": "Returning to sender",
"tracking.LABEL_CREATED": "Shipment prepared"
```

**Verification:** `pnpm build` passes. Manually check that the label mapping object has exactly the values above.

**Commit:** `fix: correct misleading Unisend tracking event labels`

---

## PR 2 — Unified Order Timeline

### Task 2: Define the unified timeline data model

**File to create:** `src/lib/orders/timeline.ts`

This module merges order milestones and tracking events into a single chronologically sorted list.

#### Types

```typescript
type TimelineEntryType = 'order_milestone' | 'tracking_event';

type OrderMilestone =
  | 'ordered'
  | 'accepted'
  | 'shipped'      // only used if no tracking events exist (fallback)
  | 'delivered'     // only used if no tracking events exist (fallback)
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

type TrackingEvent =
  | 'LABEL_CREATED'
  | 'ON_THE_WAY'
  | 'PARCEL_RECEIVED'
  | 'PARCEL_DELIVERED'
  | 'PARCEL_CANCELED'
  | 'RETURNING';

interface TimelineEntry {
  type: TimelineEntryType;
  key: OrderMilestone | TrackingEvent;
  timestamp: string;          // ISO datetime
  location?: string;          // from tracking event location field (terminal name/city)
  isCurrent: boolean;         // true for the most recent entry matching current state
  isFuture: boolean;          // true for steps that haven't happened yet
}
```

#### Builder function

```typescript
function buildOrderTimeline(
  order: {
    status: string;
    created_at: string;
    accepted_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    disputed_at?: string | null;
    refunded_at?: string | null;
  },
  trackingEvents: Array<{
    state: string;
    timestamp: string;
    location?: string;
  }>
): TimelineEntry[]
```

**Logic — this is the critical part, be precise:**

1. **Always add `ordered`** with `order.created_at`.

2. **Always add `accepted`** if `order.accepted_at` exists.

3. **Middle phase — tracking events vs order milestones:**
   - If tracking events exist (array is non-empty): insert ALL tracking events (including `LABEL_CREATED`) as `tracking_event` entries. Do NOT add `shipped` or `delivered` as separate order milestones — the tracking events cover this phase with more granularity.
   - If NO tracking events exist AND `order.shipped_at` exists: add a `shipped` order milestone (fallback for orders without tracking data — e.g., pre-Unisend orders, or if tracking webhook hasn't fired yet).
   - If NO tracking events exist AND `order.delivered_at` exists: add a `delivered` order milestone (same fallback reasoning).

4. **Terminal states:**
   - If `order.completed_at` exists: add `completed`.
   - If `order.cancelled_at` exists: add `cancelled`. Do NOT add any future steps after cancellation.
   - If `order.disputed_at` exists: add `disputed`.
   - If `order.refunded_at` exists: add `refunded`.

5. **Future steps:** For the happy path (not cancelled/disputed/refunded), add future milestones as `isFuture: true` entries so the timeline shows where the order is heading. Which future steps to show depends on current status:
   - `pending_seller`: show future `accepted` (no tracking futures — too granular)
   - `accepted` with no tracking events: show future `shipped`
   - `accepted` with `LABEL_CREATED` only: no additional future steps (buyer sees "Shipment prepared", next real event will appear when it happens)
   - `shipped`: show future `completed` (the tracking events themselves show shipping progress)
   - `delivered`: show future `completed`
   - Do NOT show future `shipped` or `delivered` as order milestones when tracking events exist — that would duplicate the information.

6. **Sort** all entries chronologically by timestamp. Future entries go at the end (they have no real timestamp — use `null` or a sentinel and sort them last).

7. **Mark `isCurrent`** on the last non-future entry.

**Edge case — `LABEL_CREATED` during `accepted` status:** This is the key improvement. When the order is `accepted` and tracking events contain only `LABEL_CREATED`, the buyer sees: Ordered ✓ → Accepted ✓ → Shipment prepared ✓ (waiting for seller drop-off). This reduces buyer anxiety between acceptance and shipping.

**Edge case — `PARCEL_CANCELED` or `RETURNING`:** These are abnormal tracking events. If present, show them in the timeline but do NOT infer order status from them — the order status is authoritative. The timeline simply shows what happened.

**Tests:** Create `src/lib/orders/timeline.test.ts` with test cases:
- Happy path: all milestones + tracking events interleave correctly
- Cancelled order: no future steps shown, timeline ends at cancellation
- `accepted` with `LABEL_CREATED` only: shows "Shipment prepared" inline
- No tracking events: falls back to `shipped`/`delivered` order milestones
- `PARCEL_CANCELED` tracking event: shown but doesn't affect order milestones
- Chronological sort: events from different sources sort correctly by timestamp

**Commit:** `feat: add unified timeline builder with tests`

---

### Task 3: Create the unified timeline component

**File to create:** `src/components/orders/UnifiedTimeline.tsx`

This replaces both `OrderTimeline.tsx` and `TrackingTimeline.tsx`.

#### Props

```typescript
interface UnifiedTimelineProps {
  order: {
    status: string;
    created_at: string;
    accepted_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    disputed_at?: string | null;
    refunded_at?: string | null;
  };
  trackingEvents: Array<{
    state: string;
    timestamp: string;
    location?: string;
  }>;
  destinationTerminal?: string;  // terminal name for context on shipping steps
}
```

#### Visual design

Use a vertical timeline with a connecting line. Follow existing design system tokens — do NOT hardcode colors.

**Entry types get subtle visual differentiation:**

- **Order milestones** — use a larger dot/icon. Icons by milestone:
  - `ordered` → shopping bag or receipt icon
  - `accepted` → checkmark icon
  - `completed` → checkmark-circle or trophy icon
  - `cancelled` → X icon
  - `disputed` → warning icon
  - `refunded` → arrow-return icon
  - `shipped` / `delivered` (fallback only) → truck / package icon

- **Tracking events** — use a smaller dot or a package/truck icon. These are visually "inside" the shipping phase:
  - `LABEL_CREATED` → tag icon (small)
  - `ON_THE_WAY` → truck icon (small)
  - `PARCEL_RECEIVED` → map-pin icon (small)
  - `PARCEL_DELIVERED` → check-circle icon (small)
  - `PARCEL_CANCELED` → x-circle icon (small, error color)
  - `RETURNING` → arrow-u-up-left icon (small, warning color)

- **Future steps** — muted/greyed out with dashed connecting line

Use Phosphor icons from `@phosphor-icons/react/ssr` (SSR import path as per project convention). Use `weight="bold"` for order milestones, `weight="regular"` for tracking events.

**Each entry shows:**
- Icon + label (translated via `next-intl`)
- Timestamp formatted via `formatDateTime()` from `@/lib/date-utils` for past events
- Location if available (from tracking event, shown as secondary text below the label)
- For `LABEL_CREATED` when it's the most recent event: append destination terminal name if available — e.g., "Shipment prepared — pickup from Rimi Āgenskalns"

**Connecting line:**
- Solid line between completed steps (use `semantic-primary` or equivalent muted color)
- Dashed line between the last completed step and the first future step
- No line after the last future step

**Cancelled/disputed orders:**
- Show only the milestones that actually occurred (no future steps)
- The terminal milestone (`cancelled`/`disputed`) uses error/warning color
- No shipping/tracking section — if the order was cancelled before shipping, tracking events won't exist

#### Empty state

If the order is in `shipped` status but `trackingEvents` is an empty array, the timeline should show the `shipped` order milestone (from `shipped_at`) with a note: "Waiting for tracking updates" (translated). Do NOT show a blank gap.

#### Responsive

The timeline is a single vertical column that works identically on mobile and desktop. No horizontal layout variant.

**Commit:** `feat: create UnifiedTimeline component`

---

### Task 4: Wire up the unified timeline in the order detail page

**File to modify:** `src/components/orders/OrderDetailClient.tsx` (or the parent order detail component — find the file that currently renders `OrderTimeline` and `TrackingTimeline`)

**Changes:**

1. Replace both `<OrderTimeline ... />` and `<TrackingTimeline ... />` with a single `<UnifiedTimeline ... />`.

2. Remove the conditional visibility logic for `TrackingTimeline` (it was only shown for `shipped`/`delivered`/`completed`). The unified timeline is **always visible** — it starts with "Order placed" and grows as the order progresses.

3. Pass the `destinationTerminal` prop. Check where the order's destination terminal name is available — it may be on the order record directly, or in a shipping/parcel data structure. If the terminal name is stored as `terminal_name` or similar on the order, pass it through. If it's only available in the Unisend parcel data, check how `TrackingTimeline` currently accesses it and use the same source.

4. Remove the standalone "Order placed: dd.mm.yyyy" display if it still exists — this is now the first entry in the unified timeline.

**Data flow check:** Verify that the parent component/page already fetches tracking events. If `TrackingTimeline` was conditionally rendered, the tracking events query may also be conditional. Make sure the query runs for ALL order statuses (not just `shipped`+), since we now show `LABEL_CREATED` during `accepted` status. The query can still return empty for `pending_seller` — that's fine, the timeline just won't have tracking entries.

**Commit:** `feat: wire UnifiedTimeline into order detail page`

---

### Task 5: Update translation files

**File:** `src/messages/en.json` (and any other active locale files)

Add all new translation keys used by `UnifiedTimeline`. Place them under the same namespace as other order-related strings.

Required keys (English values):

```json
{
  "timeline.ordered": "Order placed",
  "timeline.accepted": "Seller accepted",
  "timeline.shipped": "Shipped",
  "timeline.delivered": "Delivered",
  "timeline.completed": "Order completed",
  "timeline.cancelled": "Order cancelled",
  "timeline.disputed": "Dispute opened",
  "timeline.refunded": "Refunded",
  "tracking.LABEL_CREATED": "Shipment prepared",
  "tracking.ON_THE_WAY": "In transit",
  "tracking.PARCEL_RECEIVED": "Arrived at pickup terminal",
  "tracking.PARCEL_DELIVERED": "Picked up",
  "tracking.PARCEL_CANCELED": "Shipment cancelled",
  "tracking.RETURNING": "Returning to sender",
  "tracking.waitingForUpdates": "Waiting for tracking updates",
  "tracking.pickupFrom": "Pickup from {terminal}"
}
```

If PR 1 already added the `tracking.*` keys, do not duplicate — reuse them.

**Commit:** `feat: add unified timeline translation keys`

---

### Task 6: Remove old components

**Files to delete:**
- `src/components/orders/OrderTimeline.tsx`
- `src/components/orders/TrackingTimeline.tsx`

**Before deleting:** search the entire codebase for imports of these components. They should only be imported in the order detail page (Task 4 already replaced them). If they're used anywhere else, update those usages to `UnifiedTimeline` too.

Also remove any now-unused translation keys that were specific to the old components.

**Commit:** `refactor: remove old OrderTimeline and TrackingTimeline components`

---

### Task 7: Verify

Run full verification:

1. `pnpm build` — must pass clean
2. `pnpm test` — must pass, including new timeline builder tests
3. **Visual check scenarios** (describe what the timeline should look like for each):
   - `pending_seller` order: "Order placed ✓" → "Seller accepted" (future, greyed)
   - `accepted` order with `LABEL_CREATED`: "Order placed ✓" → "Seller accepted ✓" → "Shipment prepared ✓" (with terminal name if available)
   - `accepted` order with no tracking events: "Order placed ✓" → "Seller accepted ✓" → "Shipped" (future)
   - `shipped` order with tracking events: "Order placed ✓" → "Seller accepted ✓" → "Shipment prepared ✓" → "In transit ✓" → "Arrived at pickup terminal ✓" → "Order completed" (future)
   - `shipped` order with zero tracking events: "Order placed ✓" → "Seller accepted ✓" → "Shipped ✓" → "Order completed" (future) + "Waiting for tracking updates" note
   - `delivered` order: full timeline with "Picked up ✓" → "Order completed" (future)
   - `completed` order: full timeline, all steps completed, no future steps
   - `cancelled` order (from `pending_seller`): "Order placed ✓" → "Order cancelled ✗"
   - `cancelled` order (from `accepted`): "Order placed ✓" → "Seller accepted ✓" → "Order cancelled ✗"
4. No remaining imports of `OrderTimeline` or `TrackingTimeline`
5. No hardcoded English strings — all user-facing text uses translation keys

**Commit:** (no commit — verification only)

---

## Deferred (post-launch backlog)

- **Role-aware labels** (buyer sees "Picked up", seller sees "Buyer collected") — add when user feedback indicates confusion
- **Static transit estimate** ("Typically 1–2 business days" next to "In transit") — add after confirming actual Unisend delivery times across Baltic routes
- **`ON_THE_WAY` as auto-ship trigger** — keep `PARCEL_RECEIVED` for now; revisit if it proves too slow
- **Unified order+tracking timeline for order list page** — the list page has its own compact status display; unify later if needed
