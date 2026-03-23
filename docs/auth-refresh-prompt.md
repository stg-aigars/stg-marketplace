# Fix: Auth state not updating UI + missing X-Requested-With headers on API calls

## Bug 1: Auth state not updating after sign-in/sign-out (mobile)

### Problem

After signing in or signing out on mobile, the navigation/UI still shows the previous auth state. The page only reflects the correct state after a manual browser refresh. This affects both sign-in (nav still shows "Sign in" button) and sign-out (nav still shows user menu).

Desktop may also be affected but it's most noticeable on mobile.

### Root Cause Investigation

Check these three potential causes in order. Fix all that apply.

### 1. Missing or broken `onAuthStateChange` listener

Search the codebase for any component that listens to Supabase auth state changes and calls `router.refresh()`. This is typically called `AuthListener`, `SupabaseListener`, `AuthProvider`, or similar.

**Files to check:**
- `src/app/layout.tsx` and `src/app/[locale]/layout.tsx` — is an auth listener component mounted here?
- `src/components/` — search for `onAuthStateChange`
- `src/lib/supabase/client.ts` — the client-side Supabase instance

**What to look for:**
```typescript
// There should be a 'use client' component mounted in the root layout that does:
supabase.auth.onAuthStateChange((event, session) => {
  router.refresh()
})
```

**If missing:** Create an `AuthListener` component:

```typescript
// src/components/AuthListener.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AuthListener() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Refresh server components when auth state changes
      router.refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  return null
}
```

Then mount it in the root layout (inside the `<body>`, alongside other providers). It renders nothing — it just listens.

**If it exists but is broken:** Make sure:
- It's actually a `'use client'` component
- It's mounted inside `<body>`, not conditionally rendered
- The `router.refresh()` call is not wrapped in a condition that filters out events (see point 2)
- The Supabase client is created with `createClient` from the client module, not the server module

### 2. Auth event filtering is too restrictive

If the listener exists, check whether it filters auth events. Some implementations only handle `SIGNED_IN` and `SIGNED_OUT` but miss `TOKEN_REFRESHED` and `INITIAL_SESSION`.

**Bad pattern:**
```typescript
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    router.refresh()
  }
})
```

**Correct pattern — just refresh on every auth event:**
```typescript
supabase.auth.onAuthStateChange((event) => {
  router.refresh()
})
```

This is safe because `router.refresh()` is idempotent — it just re-runs Server Components with fresh cookies. There's no harm in calling it on `TOKEN_REFRESHED` or `INITIAL_SESSION`.

### 3. Safari bfcache serving stale pages after OAuth redirect

Mobile Safari aggressively caches pages in its back-forward cache (bfcache). After a Google OAuth redirect (sign-in → Google → callback → redirect back), Safari may serve the cached pre-auth version of the page instead of re-rendering.

**Check if this is the issue:** The symptom is specific to OAuth sign-in (not email/password), and only on Safari/iOS. The page looks exactly as it did before clicking "Sign in with Google."

**Fix:** Add a `pageshow` event listener to the same `AuthListener` component:

```typescript
useEffect(() => {
  const handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      // Page was restored from bfcache — refresh to get current auth state
      router.refresh()
    }
  }

  window.addEventListener('pageshow', handlePageShow)
  return () => window.removeEventListener('pageshow', handlePageShow)
}, [router])
```

This should be a second `useEffect` in the same `AuthListener` component (or combined, as long as both listeners are set up).

---

## Bug 2: "Missing required X-Requested-With header" on API calls

### Problem

On the order detail page, two actions fail:
- **"Confirm received"** button gets stuck in a loading state (spinner never resolves)
- **"Submit review"** shows error: "Missing required X-Requested-With header"

Both fail because the API routes require an `X-Requested-With: XMLHttpRequest` header for CSRF protection, but the client-side `fetch()` calls don't send it.

### Fix

**Step 1: Find ALL client-side fetch calls to `/api/` routes.**

```bash
grep -rn "fetch('/api\|fetch(\`/api\|fetch(\"/api" src/components src/app --include="*.tsx" --include="*.ts"
```

**Step 2: Add the missing header to every match.**

Each fetch call needs `'X-Requested-With': 'XMLHttpRequest'` in its headers object.

Before:
```typescript
const response = await fetch(`/api/orders/${orderId}/review`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ rating, comment }),
})
```

After:
```typescript
const response = await fetch(`/api/orders/${orderId}/review`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  body: JSON.stringify({ rating, comment }),
})
```

**Known affected files (check these first):**
- Review form component (review submission) — likely in `src/components/orders/` or `src/app/[locale]/orders/`
- `src/components/orders/OrderActions.tsx` — confirm received, accept, decline, ship, etc.

**But don't stop there.** Every client-side `fetch('/api/...')` in the codebase must include this header, or it will hit the same error. Check all matches from the grep.

**Step 3: Consider a fetch wrapper to prevent this from recurring.**

If there are many fetch calls (5+), create a utility:

```typescript
// src/lib/api-fetch.ts
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
  })
}
```

Then replace all `fetch('/api/...')` calls with `apiFetch('/api/...')`. This ensures future API calls automatically include the header. Only create this if there are enough call sites to justify it — if there are only 2-3, just add the header inline.

---

## Bug 3 (check): Loading states stuck after failed fetch calls

### Problem

The "Confirm received" button was stuck with a spinner. Even after fixing the X-Requested-With header, if any fetch call fails for any reason, buttons may remain in a loading state forever if there's no `finally` block resetting the state.

### Fix

Search for all state-driven loading patterns in order-related components:

```bash
grep -rn "setLoading\|setIsLoading\|setSubmitting\|isLoading\|isSubmitting" src/components/orders src/app/[locale]/orders --include="*.tsx"
```

Every fetch call that sets a loading state to `true` must reset it in a `finally` block, not just in the success path:

**Bad pattern:**
```typescript
setLoading(true)
const res = await fetch(...)
if (res.ok) {
  // success handling
}
setLoading(false) // never reached if fetch throws
```

**Correct pattern:**
```typescript
setLoading(true)
try {
  const res = await fetch(...)
  if (!res.ok) {
    const data = await res.json()
    setError(data.error || 'Something went wrong')
    return
  }
  // success handling
} catch {
  setError('Something went wrong. Please try again.')
} finally {
  setLoading(false) // always runs
}
```

Check all order action handlers (confirm received, accept, decline, ship, submit review) and fix any that don't have proper `try/catch/finally`.

---

## Bug 4 (check): Sign-out not clearing server-side cookies

### Problem

If the sign-out flow only calls `supabase.auth.signOut()` on the client-side Supabase instance, the server-side cookies may not be cleared. The middleware still sees a valid session on the next navigation, so server-rendered components still show the logged-in state.

### Fix

Find the sign-out handler — likely in a nav/header component or an auth utility.

**If sign-out is client-only:**
```typescript
// This alone is NOT enough in App Router
await supabase.auth.signOut()
```

**It needs a server action or API route to clear cookies:**
```typescript
// Client: call a server action after sign-out
await supabase.auth.signOut()
router.refresh() // triggers server re-render with cleared cookies
router.push('/') // redirect to home
```

The `router.refresh()` from the `AuthListener` (Bug 1) should handle this, but verify that the sign-out handler also navigates to a public page (like `/`) after signing out. If it stays on a protected page, the middleware redirect might race with the client-side state update.

---

## Bug 5 (check): Middleware not refreshing the Supabase session

### Problem

The Supabase middleware in `src/middleware.ts` needs to call `supabase.auth.getUser()` on every request to refresh the auth cookies. If it only calls `getSession()`, expired tokens won't be refreshed and the auth state can go stale — especially on mobile where tabs stay backgrounded for long periods.

### Fix

Check `src/middleware.ts`. Look for which auth method is called:

**Incorrect — `getSession()` reads from cookies but doesn't refresh:**
```typescript
const { data: { session } } = await supabase.auth.getSession()
```

**Correct — `getUser()` verifies with the Supabase server and refreshes tokens:**
```typescript
const { data: { user } } = await supabase.auth.getUser()
```

This is a common Supabase gotcha. The `getSession()` method is explicitly documented as NOT refreshing the session, while `getUser()` does a server-side check that triggers token refresh when needed.

---

## Bug 6 (check): Page not refreshing after successful order actions

### Problem

Even with the X-Requested-With header fixed, after successfully confirming receipt or submitting a review, the order page may not update to reflect the new status. The user would need to manually refresh to see the updated order progress timeline or the submitted review.

### Fix

Check that every successful mutation on the order detail page calls `router.refresh()` after the API call succeeds:

```typescript
const res = await fetch(...)
if (res.ok) {
  router.refresh() // re-run server components to show updated order state
  // optionally also: setSuccess('Review submitted') or similar
}
```

This applies to: confirm received, accept order, decline order, ship order, submit review. Each success handler should trigger a server re-render.

---

## Verification

After applying all fixes:

**Auth refresh (Bug 1):**
1. **Sign-in test (mobile Safari):** Sign in with Google OAuth. After redirect back, the nav should immediately show the user menu — no manual refresh needed.
2. **Sign-out test (mobile Safari):** Sign out. The nav should immediately show "Sign in" — no manual refresh needed.
3. **Tab backgrounding test:** Sign in, switch to another app for 30+ seconds, come back. The auth state should still be correct (the `TOKEN_REFRESHED` event handles this).
4. **Desktop test:** Verify sign-in/sign-out still works correctly on desktop browsers.

**API calls (Bug 2):**
5. **Confirm received:** On a delivered order, click "Confirm received" — it should complete without getting stuck.
6. **Submit review:** After confirming, fill in the review form and submit — it should succeed without the X-Requested-With error.
7. **Other order actions:** Test accept, decline, and ship actions on orders — all should work without errors.

**Loading states (Bug 3):**
8. **Offline test:** Disable network, try an order action — button should show an error and return to its normal state, never stuck loading.

**UI updates (Bug 6):**
9. **Post-action state:** After confirming received, the order progress timeline should immediately update without a manual page refresh. Same for submitting a review — it should appear on the page.

## Technical Notes

- Supabase SSR cookies: use `getAll()`/`setAll()`, never `get()`/`set()`
- All monetary values as INTEGER CENTS (never floats)
- Run `pnpm build` after changes to verify no type/lint errors
- Commit as separate commits:
  - `fix: refresh UI on auth state change (mobile sign-in/sign-out)`
  - `fix: add X-Requested-With header to all client-side API fetch calls`
  - `fix: ensure loading states reset on fetch failure`
  - Any other fixes as appropriate per scope
