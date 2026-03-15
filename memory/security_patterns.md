---
name: Security Patterns
description: RLS policies, service role usage, security headers, rate limiting, environment variables
type: project
---

## Row Level Security (RLS)

- Every table has RLS enabled
- Public data (games, active listings): `SELECT` for anon
- User data (orders, profiles): `SELECT` filtered by `auth.uid()`
- Writes: most through service role (bypasses RLS) via API routes
- Views: always `WITH (security_invoker = true)` to enforce RLS
- No INSERT policy on `orders` — created exclusively via service role after payment

## Service Role Usage

- Service role key stored as `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to client)
- Used for: order creation, wallet mutations, admin operations, game metadata updates
- All critical financial operations use Postgres RPCs for atomicity

## Security Headers (next.config.mjs)

- CSP with explicit allowlists (Sentry, Cloudflare Turnstile, EveryPay, MapBox)
- X-Frame-Options: DENY
- HSTS: 1 year
- Permissions-Policy: geolocation=self

## Rate Limiting & Captcha

- Cloudflare Turnstile on sensitive forms (signup, listing creation)
- Cron secret for scheduled tasks
- Sentry for error monitoring

## Environment Variables

```
# Required (server-side)
SUPABASE_SERVICE_ROLE_KEY
EVERYPAY_API_USERNAME, EVERYPAY_API_SECRET, EVERYPAY_API_URL, EVERYPAY_ACCOUNT_NAME
RESEND_API_KEY, RESEND_FROM_EMAIL
UNISEND_API_URL, UNISEND_USERNAME, UNISEND_PASSWORD

# Required (public)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL

# Optional
CRON_SECRET
NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY
```

## PWA

- Service worker with 2-day cache (Workbox)
- Offline fallback page
- Disabled in development
