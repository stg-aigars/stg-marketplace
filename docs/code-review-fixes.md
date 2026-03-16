# STG Post-Review Fixes — Claude Code Prompt

> **For Claude Code:** Work through these tasks sequentially. Each task has a clear scope and verification step. Commit after each task with the suggested message. Read relevant memory files before starting (per the build-feature skill). Run `pnpm build` after each task to verify nothing breaks.

---

## Task 1: Fix `as any` casts in order-transitions.ts

**Why:** The most business-critical file uses `as any` on every transition function, defeating TypeScript safety.

**Files:**
- Modify: `src/lib/services/order-transitions.ts`
- Modify: `src/lib/orders/types.ts`

**Steps:**

1. In `src/lib/orders/types.ts`, add a new type for orders loaded with joined relations:

```ts
/** Order loaded with joined listing + profile data for transition logic */
export interface OrderWithRelations extends OrderRow {
  listings: { game_name: string; seller_id: string } | null;
  buyer_profile: { full_name: string | null; email: string | null; phone: string | null; country: string } | null;
  seller_profile: { full_name: string | null; email: string | null; phone: string | null; country: string } | null;
}
```

2. In `src/lib/services/order-transitions.ts`:
   - Import the new `OrderWithRelations` type
   - Change `loadOrder` return type from `Promise<OrderRow>` to `Promise<OrderWithRelations>`
   - Type the `.single()` call: `.single<OrderWithRelations>()`
   - Remove ALL `as any` casts from every transition function (`acceptOrder`, `declineOrder`, `markShipped`, `markDelivered`, `completeOrder`, `disputeOrder`)
   - Use proper typed access: `order.buyer_profile?.full_name` etc.
   - Use nullish coalescing for safety where needed

3. Verify: `pnpm build` passes with zero `any` casts remaining in this file.

**Commit:** `fix: remove as-any casts from order-transitions with proper OrderWithRelations type`

---

## Task 2: Fix dynamic import in checkout page

**Why:** Unnecessary dynamic import adds complexity with no benefit in a server component.

**File:** `src/app/[locale]/checkout/[listingId]/page.tsx`

**Steps:**

1. Replace the dynamic import block:
```ts
// REMOVE THIS:
const supabase = (await import('@/lib/supabase/server')).createClient;
const client = await supabase();

// REPLACE WITH:
const client = await createClient();
```

2. Ensure `createClient` is already imported at the top from `@/lib/supabase/server`. If not, add: `import { createClient } from '@/lib/supabase/server';`

3. Verify: `pnpm build` passes.

**Commit:** `fix: replace dynamic import with static import in checkout page`

---

## Task 3: Add error boundaries for main route groups

**Why:** Without error boundaries, any server component throw shows Next.js's default error page, which is not branded and provides no recovery path.

**Files to create:**
- `src/app/[locale]/error.tsx`
- `src/app/[locale]/browse/error.tsx`
- `src/app/[locale]/orders/error.tsx`
- `src/app/[locale]/account/error.tsx`
- `src/app/[locale]/checkout/error.tsx`

**Steps:**

1. Create a reusable error component. Create `src/components/errors/ErrorFallback.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}

export function ErrorFallback({
  reset,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
}: ErrorFallbackProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="text-center py-16">
        <svg
          className="w-16 h-16 mx-auto text-semantic-text-muted mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h1 className="text-2xl font-bold text-semantic-text-heading mb-2">
          {title}
        </h1>
        <p className="text-semantic-text-secondary mb-6">{message}</p>
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
```

2. Create the root locale error boundary at `src/app/[locale]/error.tsx`:

```tsx
'use client';

import { ErrorFallback } from '@/components/errors/ErrorFallback';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}
```

3. Create route-specific error boundaries for browse, orders, account, and checkout. Each should use `ErrorFallback` with a contextual message. Examples:
   - Browse: `message="We couldn't load the game listings. Please try again."`
   - Orders: `message="We couldn't load your order. Please try again."`
   - Account: `message="We couldn't load your profile. Please try again."`
   - Checkout: `message="Something went wrong during checkout. Your payment was not processed."`

4. Verify: `pnpm build` passes.

**Commit:** `feat: add error boundaries for all main route groups`

---

## Task 4: Add pagination to browse page

**Why:** Browse page currently fetches all active listings with no limit. This will degrade with scale.

**Files:**
- Modify: `src/app/[locale]/browse/page.tsx`

**Steps:**

1. Add a `PAGE_SIZE` constant (24 is good — divisible by 2, 3, and 4 column grids).

2. Read `searchParams.page` (default to 1) and calculate offset: `(page - 1) * PAGE_SIZE`.

3. Use Supabase `.range(offset, offset + PAGE_SIZE - 1)` on the query. Also request `{ count: 'exact' }` to get total count for pagination.

4. Add simple prev/next navigation at the bottom using `Link` components with `?page=N` query params. Use the `Button` component with `variant="secondary"` for styling.

5. Disable "Previous" on page 1, disable "Next" when `offset + PAGE_SIZE >= totalCount`.

6. Show a count summary: "Showing 1–24 of 156 listings".

7. Verify: `pnpm build` passes.

**Commit:** `feat: add pagination to browse page (24 items per page)`

---

## Task 5: Populate user_profiles.email in signup trigger

**Why:** The `email` column exists and is referenced in `OrderWithDetails` and email stubs, but the trigger never populates it.

**File to create:** `supabase/migrations/003_populate_profile_email.sql`

**Steps:**

1. Create the migration file:

```sql
-- Populate user_profiles.email from auth.users
-- The signup trigger was missing this field

-- Update the trigger function to include email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'country', 'LV')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing profiles that have null email
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
AND up.email IS NULL;
```

2. Apply via Supabase MCP `apply_migration` tool if available, otherwise note it for manual application.

**Commit:** `fix: populate user_profiles.email in signup trigger and backfill existing rows`

---

## Task 6: Add checkout session expiry logic

**Why:** Checkout sessions never expire, allowing potential replay attacks.

**Steps:**

1. In the payment callback route (`src/app/api/payments/callback/route.ts`), before processing the session, add an expiry check:

```ts
// Check if session has expired (30 minutes)
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessionAge = Date.now() - new Date(session.created_at).getTime();
if (sessionAge > SESSION_TTL_MS && session.status === 'pending') {
  // Mark as expired
  await serviceClient
    .from('checkout_sessions')
    .update({ status: 'expired' })
    .eq('id', session.id)
    .eq('status', 'pending');

  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=session_expired`
  );
}
```

2. Add `session_expired` to the `errorMessages` map in `src/app/[locale]/checkout/[listingId]/page.tsx`:

```ts
session_expired: 'Your checkout session expired. Please try again.',
```

3. Add an index for cleanup queries. Create migration `supabase/migrations/004_checkout_session_indexes.sql`:

```sql
-- Indexes for checkout session lookups and cleanup
CREATE INDEX idx_checkout_sessions_listing ON checkout_sessions(listing_id);
CREATE INDEX idx_checkout_sessions_buyer ON checkout_sessions(buyer_id);
CREATE INDEX idx_checkout_sessions_status_created ON checkout_sessions(status, created_at)
  WHERE status = 'pending';
```

4. Verify: `pnpm build` passes.

**Commit:** `fix: add checkout session expiry check (30 min TTL) and cleanup indexes`

---

## Task 7: Tighten storage upload RLS policy

**Why:** Current policy allows any authenticated user to upload to any user's folder in the listing-photos bucket.

**File to create:** `supabase/migrations/005_tighten_photo_upload_rls.sql`

**Steps:**

1. Create the migration:

```sql
-- Tighten listing-photos upload policy to enforce user folder ownership
-- Old policy only checked auth.role() = 'authenticated'
-- New policy also validates the upload path starts with the user's ID

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-photos'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

2. Apply via Supabase MCP or note for manual application.

**Commit:** `fix: tighten listing-photos upload RLS to enforce user folder ownership`

---

## Task 8: Add per-user photo upload quota

**Why:** Without a quota, a single user could exhaust storage by uploading thousands of photos.

**File:** `src/app/api/listings/photos/route.ts`

**Steps:**

1. After the auth check and before processing the upload, add a quota check:

```ts
// Per-user photo quota: max 100 photos across all listings
const MAX_USER_PHOTOS = 100;

const { data: files, error: listError } = await supabase.storage
  .from('listing-photos')
  .list(user.id, { limit: MAX_USER_PHOTOS + 1 });

if (!listError && files && files.length >= MAX_USER_PHOTOS) {
  return NextResponse.json(
    { error: `Photo limit reached (${MAX_USER_PHOTOS}). Please remove unused photos before uploading new ones.` },
    { status: 400 }
  );
}
```

2. Place this check BEFORE reading the file from the form data (to fail fast).

3. Verify: `pnpm build` passes.

**Commit:** `feat: add per-user photo upload quota (max 100 photos)`

---

## Task 9: Add loading states for main pages

**Why:** Server-rendered pages with Supabase queries can have high TTFB. Loading states improve perceived performance.

**Files to create:**
- `src/app/[locale]/browse/loading.tsx`
- `src/app/[locale]/listings/[id]/loading.tsx`
- `src/app/[locale]/orders/[id]/loading.tsx`
- `src/app/[locale]/account/orders/loading.tsx`

**Steps:**

1. Create a reusable skeleton component at `src/components/ui/skeleton.tsx`:

```tsx
import { type HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-snow-storm-light ${className}`}
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
```

2. Export it from `src/components/ui/index.ts`.

3. Create `src/app/[locale]/browse/loading.tsx` showing a grid of card skeletons (matching the 2/3/4 column grid):

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function BrowseLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-9 w-64 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-semantic-border-subtle overflow-hidden">
            <Skeleton className="h-40 sm:h-44 lg:h-48 rounded-none" />
            <div className="px-3 py-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

4. Create similar loading states for listing detail (two-column layout skeleton), order detail (card stack skeleton), and order list (list of card skeletons).

5. Verify: `pnpm build` passes.

**Commit:** `feat: add Skeleton component and loading states for browse, listing, and order pages`

---

## Task 10: Verify condition badge border colors render correctly

**Why:** The badge component references `border-condition-like-new` etc., and the Tailwind config maps these to `condition.like-new`. Verify this actually works.

**Steps:**

1. Check `tailwind.config.ts` — the condition colors are mapped as:
```ts
'like-new': colors.condition.likeNew.border,
'like-new-bg': colors.condition.likeNew.bg,
'like-new-text': colors.condition.likeNew.text,
```

2. Check `badge.tsx` — the condition classes reference:
```ts
likeNew: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new',
```

3. This should generate `border-condition-like-new` → Tailwind utility class → resolves to `colors.condition.likeNew.border`. Verify by running `pnpm dev` and visually checking a listing card with each condition on the browse page. If any border colors are missing, the Tailwind config mapping needs fixing.

4. If they render correctly, no changes needed. If not, fix the class names to match the Tailwind config key structure.

**Commit (if needed):** `fix: correct condition badge border color class names`

---

## Task 11: Identify hardcoded English strings for future i18n

**Why:** Many UI strings are hardcoded in English rather than using translation keys. This doesn't need fixing now (Latvian is Week 3), but documenting them prevents rework.

**Steps:**

1. Create a tracking file at `docs/i18n-audit.md` listing all files with hardcoded English strings that will need translation keys. Key areas:
   - `src/lib/orders/constants.ts` — `ORDER_STATUS_CONFIG` labels
   - `src/lib/condition-config.ts` — condition labels and descriptions
   - `src/app/[locale]/checkout/[listingId]/page.tsx` — error messages map
   - `src/app/[locale]/checkout/[listingId]/CheckoutForm.tsx` — form labels
   - `src/components/orders/OrderDetailClient.tsx` — status messages
   - `src/components/orders/OrderActions.tsx` — button labels
   - `src/components/orders/OrderTimeline.tsx` — step labels
   - `src/components/orders/ShippingInfo.tsx` — section labels
   - All auth form components under `src/app/[locale]/auth/_components/`

2. Do NOT convert these to translation keys now. Just document them so Week 3 Latvian locale work has a clear scope.

**Commit:** `docs: add i18n audit tracking hardcoded English strings for Week 3 locale work`

---

## Summary checklist

| # | Task | Priority | Type |
|---|------|----------|------|
| 1 | Fix `as any` casts in order-transitions | High | Bug/Safety |
| 2 | Fix dynamic import in checkout | Low | Cleanup |
| 3 | Add error boundaries | High | UX |
| 4 | Add browse pagination | High | Performance |
| 5 | Populate email in signup trigger | Medium | Data integrity |
| 6 | Add checkout session expiry | Medium | Security |
| 7 | Tighten storage upload RLS | High | Security |
| 8 | Add photo upload quota | Medium | Security |
| 9 | Add loading states | Medium | UX |
| 10 | Verify badge border colors | Low | Visual QA |
| 11 | Document hardcoded strings | Low | Planning |

After all tasks: run `pnpm build` + `pnpm test` to verify everything passes, then deploy per the deploy skill.
