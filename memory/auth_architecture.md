---
name: Authentication Architecture
description: Supabase Auth flow (OAuth + email), cookie handling, middleware, auth helpers, profile creation
type: project
---

## Auth Flow

1. Supabase Auth with OAuth (Google) + email/password
2. Middleware validates session cookies on every request
3. `AuthContext` provides user state to client components
4. Protected routes redirect to `/auth/signin` with return URL

## Critical Patterns

- **Cookie handling:** `getAll()`/`setAll()` API (Supabase SSR v0.5+) — old `get()`/`set()` breaks chunked JWTs from OAuth
- **OAuth callbacks:** Never clear auth cookies during `?code=` or `?token_hash=` requests — PKCE code verifier cookie is needed for client-side code exchange
- **Profile creation:** Database trigger creates profile on signup; retry up to 3x if slow
- **Middleware order:** i18n routing → auth validation → route protection
- **Country selector:** LV, LT, EE at signup — drives shipping routes + VAT rates

## Auth Helpers

```ts
// API routes — returns 401 response if not authenticated
const { response, user, supabase } = await requireAuth();
const { response, user, supabase } = await requireStaffAuth();

// Server components — throws redirect if not authenticated
const { user, isStaff, serviceClient } = await requireServerAuth();
```

## Provider Stack (order matters)

```
QueryClientProvider (React Query — server state caching)
  → AuthProvider (session + profile)
    → ToastProvider (notifications)
      → SavedListingsProvider (heart/save feature)
        → UnreadMessagesProvider (polling, 30s)
          → UnreadNotificationsProvider (polling)
            → ActiveOrdersProvider (order count)
              → CartProvider (basket + reservation timers)
```

## State Management Patterns

- **Server state:** React Query with 1-min stale time, no refetch on window focus
- **Client state:** React Context for auth, cart, saved listings
- **Form state:** Custom hooks (`useListingForm`, `useBrowseFilters`)
- **Real-time:** Supabase realtime for auctions; polling for messages/notifications (visibility-aware)
