# Security Hardening — Claude Code Prompt

> **For Claude Code:** Read all referenced files before starting. Work through tasks sequentially. Commit after each task with the suggested message. Run `pnpm build` after each task to verify nothing breaks.

## Context

Second Turn Games is a Baltic peer-to-peer board game marketplace handling real payments (EveryPay) and personal data (names, addresses, order history). It runs on Hetzner VPS with Coolify (Docker), not Vercel — so we don't get automatic security headers. This prompt addresses the security gaps identified in an external audit of secondturn.games.

## Pre-work: Read These Files

```
src/middleware.ts
next.config.mjs
src/lib/env.ts
src/lib/supabase/server.ts
src/lib/supabase/client.ts
src/app/auth/signin/page.tsx (or wherever the sign-in form lives)
src/app/auth/signup/page.tsx (or wherever the sign-up form lives)
src/app/api/ (scan for all route handlers)
```

---

## Task 1: Add HTTP Security Headers

**Why:** The site currently returns no security headers. This is the single highest-impact security fix — it protects against XSS, clickjacking, MIME sniffing, and downgrade attacks. Any security scanner (securityheaders.com, CheckVibe, Mozilla Observatory) will flag this immediately.

**File:** `next.config.mjs`

**Steps:**

1. Add a `headers()` async function to the Next.js config that applies security headers to all routes.

2. The headers to add:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking (no one should iframe our site) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage to third parties |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | We don't use these APIs — disable them |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS for 1 year |
| `X-DNS-Prefetch-Control` | `on` | Performance: allows DNS prefetch for Supabase/BGG domains |
| `Content-Security-Policy` | See below | XSS protection — the most important one |

3. For `Content-Security-Policy`, build a policy that allows exactly what STG needs and nothing else:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' https://tfxqbtcdkzdwfgsivvet.supabase.co https://cf.geekdo-images.com data: blob:;
font-src 'self';
connect-src 'self' https://tfxqbtcdkzdwfgsivvet.supabase.co https://*.everypay.co https://*.unisend.com;
frame-src 'self' https://*.everypay.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

Notes on the CSP:
- `unsafe-inline` and `unsafe-eval` for scripts: needed because Next.js injects inline scripts. Tightening this with nonces is a future improvement.
- `img-src` includes Supabase storage (listing photos) and GeekDo (BGG game images), plus `data:` and `blob:` for Next.js Image component placeholders.
- `connect-src` includes Supabase (API calls), EveryPay (payment redirects), and Unisend (shipping API — though this should be server-side only, including it is defensive).
- `frame-src` allows EveryPay iframes for 3DS payment verification.
- `frame-ancestors 'none'` duplicates X-Frame-Options for browsers that support CSP.

4. Apply headers to all routes with `source: '/(.*)'`.

5. Also add a separate entry for `/_next/static/(.*)` with `Cache-Control: public, max-age=31536000, immutable` if not already set.

**Verify:** Run `pnpm build`. Then test locally with `pnpm start` and check response headers with:
```bash
curl -sI http://localhost:3000 | grep -iE "(content-security|x-frame|x-content-type|strict-transport|referrer-policy|permissions-policy)"
```
All six headers should appear.

**Commit:** `security: add HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)`

---

## Task 2: Disable Source Maps in Production

**Why:** If source maps are enabled, anyone can download `/_next/static/chunks/*.map` and read the entire application source code, including API route logic, business rules, and internal paths.

**File:** `next.config.mjs`

**Steps:**

1. Verify that `productionBrowserSourceMaps` is either absent or explicitly set to `false` in the Next.js config.
2. If it's set to `true`, change it to `false`.
3. If it's absent, add `productionBrowserSourceMaps: false` explicitly for clarity.

**Verify:** Run `pnpm build` and check the `.next/static/chunks/` directory — no `.map` files should exist.

**Commit:** `security: explicitly disable production source maps`

---

## Task 3: Add Rate Limiting to Auth-Adjacent API Routes

**Why:** Without rate limiting, an attacker can brute-force login, spam listing creation, or flood checkout sessions. Supabase Auth has its own rate limiting on the auth endpoints, but our custom API routes (checkout, listing creation, contact form) don't.

**Approach:** Create a simple in-memory rate limiter utility. For a single-server Hetzner deployment, in-memory is fine (no need for Redis).

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: API route handlers that need protection

**Steps:**

1. Create `src/lib/rate-limit.ts` with a sliding window rate limiter:

```typescript
// Simple in-memory rate limiter for single-server deployment
// Uses IP address as the key
// Returns { success: boolean, remaining: number, reset: number }

interface RateLimitOptions {
  interval: number;   // Time window in milliseconds
  maxRequests: number; // Max requests per window
}
```

Implementation should:
- Use a `Map<string, { count: number; resetTime: number }>` for storage
- Clean up expired entries periodically (every 60 seconds) to prevent memory leaks
- Export a `rateLimit(options: RateLimitOptions)` factory that returns an async function `check(identifier: string)`
- The `check` function returns `{ success: boolean; remaining: number; resetTime: number }`

2. Create a helper to extract client IP from Next.js request headers:

```typescript
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
```

3. Apply rate limiting to these routes (adjust paths to match actual file locations):

| Route | Limit | Why |
|-------|-------|-----|
| `/api/checkout/*` or payment creation | 10 req/min per IP | Prevent checkout spam / reservation abuse |
| `/api/listings` (POST) | 5 req/min per IP | Prevent listing spam |
| `/api/contact` (if exists) | 3 req/min per IP | Prevent contact form spam |
| `/api/cron/*` | Already protected by CRON_SECRET | No change needed |

4. When rate limit is exceeded, return:
```typescript
return NextResponse.json(
  { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
  { status: 429, headers: { 'Retry-After': String(Math.ceil(resetTime / 1000)) } }
);
```

**Verify:** `pnpm build` passes. Optionally write a quick test for the rate limiter utility.

**Commit:** `security: add in-memory rate limiting to API routes`

---

## Task 4: RLS Audit — Verify No Anonymous Data Leaks

**Why:** The Supabase anon key is exposed in the client bundle (by design), which means anyone can query the REST API at `https://tfxqbtcdkzdwfgsivvet.supabase.co/rest/v1/`. RLS is the only thing preventing unauthorized data access. This task audits that every table is properly locked down.

**This task is a Supabase Dashboard task, not a code task.** But create documentation of the audit.

**File:** Create `docs/security/rls-audit.md`

**Steps:**

1. Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Find tables WITHOUT RLS enabled (these are wide open)
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE c.relrowsecurity = true
  );
```

If any tables appear, RLS must be enabled immediately.

2. For each table, verify the SELECT policy doesn't allow anonymous reads on sensitive data:

```sql
-- List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

3. Pay special attention to these tables:

| Table | Expected anonymous SELECT | Concern if wrong |
|-------|--------------------------|------------------|
| `profiles` | Only `display_name`, `country`, `created_at` | Email, phone, full address leaked |
| `orders` | None (buyer/seller only) | Order details, addresses, payment info leaked |
| `wallet_transactions` | None (owner only) | Financial data leaked |
| `checkout_sessions` | None (owner only) | Payment session data leaked |
| `listings` | Public read for active listings | Draft/deleted listings visible |
| `games` | Public read (catalog data) | Fine — this is public BGG data |
| `dac7_reports` | None (admin only) | Tax reporting data leaked |

4. Test anonymous access by running queries as the anon role:

```sql
-- Switch to anon role and try reading sensitive tables
SET ROLE anon;
SELECT * FROM orders LIMIT 1;        -- Should return 0 rows
SELECT * FROM wallet_transactions LIMIT 1;  -- Should return 0 rows
SELECT email, phone FROM profiles LIMIT 1;  -- Should return 0 rows or error
RESET ROLE;
```

5. Document findings in `docs/security/rls-audit.md` with date, status per table, and any fixes applied.

**Commit:** `docs: add RLS security audit results`

---

## Task 5: Verify Supabase Storage Bucket Policies

**Why:** The `listing-photos` bucket is correctly public (photos need to be viewable by anyone). But if there are other buckets (invoices, user documents, exports), they must be private.

**This is another Supabase Dashboard task.**

**Steps:**

1. Go to Supabase Dashboard → Storage → Policies.
2. List every bucket and its access policy.
3. Verify:
   - `listing-photos`: Public read is correct. Write should require `auth.uid() = bucket_owner` or similar.
   - Any other buckets: Should NOT be public unless there's a specific reason.
4. Add findings to `docs/security/rls-audit.md` under a "Storage Buckets" section.

**No commit needed if no code changes.**

---

## Task 6: Harden Cookie and Session Settings

**Why:** Supabase Auth cookies need proper settings to prevent session theft.

**File:** `src/middleware.ts` and/or `src/lib/supabase/server.ts`

**Steps:**

1. Verify the Supabase client in `src/lib/supabase/server.ts` uses `getAll()`/`setAll()` for cookies (not `get()`/`set()` — per CLAUDE.md this should already be done).

2. In `src/middleware.ts`, ensure the auth session refresh is happening on every request (not just protected routes). This ensures tokens are refreshed before they expire and stale sessions are caught early.

3. Check that the cookie options include:
   - `httpOnly: true` (Supabase default, but verify)
   - `secure: true` in production
   - `sameSite: 'lax'`
   - `path: '/'`

If the Supabase client library handles these automatically, document that in the audit file. If any are missing or overridden, fix them.

**Verify:** `pnpm build` passes.

**Commit:** `security: verify and document cookie/session settings` (only if code changes needed)

---

## Task 7: Add robots.txt Security Exclusions

**Why:** Search engines should not index API routes, auth pages, or admin paths. The current robots.txt (if it exists) should explicitly disallow sensitive paths.

**File:** `public/robots.txt` or `src/app/robots.ts`

**Steps:**

1. Find the existing robots.txt (referenced as done in Week 0 SEO work).
2. Ensure these paths are disallowed:

```
User-agent: *
Disallow: /api/
Disallow: /auth/
Disallow: /account/
Disallow: /checkout/
Disallow: /admin/
Allow: /
```

3. Keep the existing `Sitemap:` reference if present.

**Verify:** `pnpm build` passes. Visit `/robots.txt` locally.

**Commit:** `security: add sensitive path exclusions to robots.txt`

---

## Task 8: Create Breach Notification Runbook

**Why:** GDPR requires notification to the Latvian DPA (Datu valsts inspekcija) within 72 hours of discovering a personal data breach. Having the process documented before an incident saves critical time.

**File:** Create `docs/security/breach-response.md`

**Content:**

```markdown
# Breach Response Runbook

## Classification

A personal data breach is any incident where personal data is accidentally or unlawfully:
- Accessed by unauthorized parties
- Lost or destroyed
- Altered without authorization

STG stores: names, email addresses, shipping addresses (via Unisend), country of residence, order history, wallet balances.

## Response Timeline (GDPR Article 33/34)

| Deadline | Action |
|----------|--------|
| Immediately | Contain the breach (revoke keys, disable affected endpoints) |
| Within 24 hours | Assess scope: which users, what data, how it happened |
| Within 72 hours | Notify Datu valsts inspekcija (dvi@dvi.gov.lv) if risk to users |
| Without undue delay | Notify affected users if high risk to their rights/freedoms |

## What to Report to DVI

- Nature of the breach
- Categories and approximate number of affected users
- Contact details of the data controller (you)
- Likely consequences
- Measures taken to address and mitigate

## Key Contacts

- Datu valsts inspekcija: dvi@dvi.gov.lv, +371 67223131
- Supabase incident response: security@supabase.io
- EveryPay support: (add from dashboard)

## Immediate Actions Checklist

- [ ] Rotate Supabase service_role key if database compromised
- [ ] Rotate EveryPay API credentials if payment data affected
- [ ] Rotate CRON_SECRET
- [ ] Review Supabase Auth logs for unauthorized access
- [ ] Check Supabase storage access logs
- [ ] Disable affected API routes if needed
- [ ] Draft user notification email (use Resend)
```

**Commit:** `docs: add GDPR breach response runbook`

---

## Summary Checklist

| # | Task | Type | Priority |
|---|------|------|----------|
| 1 | HTTP security headers | Code | Critical |
| 2 | Disable source maps | Code | High |
| 3 | Rate limiting on API routes | Code | High |
| 4 | RLS audit | Supabase Dashboard + docs | High |
| 5 | Storage bucket audit | Supabase Dashboard | Medium |
| 6 | Cookie/session hardening | Code (verify) | Medium |
| 7 | robots.txt exclusions | Code | Low |
| 8 | Breach notification runbook | Docs | Medium |

After all tasks: run `pnpm build` + `pnpm test` to verify everything passes.

---

## Manual Follow-ups (Not for Claude Code)

These require Supabase Dashboard or Cloudflare Dashboard access:

1. **Supabase Auth → Settings:** Increase minimum password length from 6 to 8+ characters
2. **Cloudflare Dashboard:** Consider enabling orange-cloud proxy mode for basic DDoS protection (currently DNS-only / grey cloud)
3. **Cloudflare Turnstile:** Set up site key + secret key and plan integration into sign-in/sign-up forms (originally Week 4, consider moving earlier)
4. **securityheaders.com:** After deploying Task 1, scan secondturn.games to verify the grade improved
