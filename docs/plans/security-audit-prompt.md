# Security Audit — Claude Code Prompt

> **Mode: READ-ONLY AUDIT.** Do NOT modify any files. Produce a single markdown report at `docs/security-audit-report.md` with findings, severity ratings, and recommended fixes.

## Context

This is a peer-to-peer board game marketplace handling real payments (EveryPay/Swedbank), personal data (EU/GDPR), and physical shipping (Unisend) across three Baltic countries. It is self-hosted on Hetzner VPS via Coolify/Docker — meaning we do NOT get Vercel's automatic security headers or edge protections. Every HTTP-layer defense must be explicitly configured.

Read `CLAUDE.md` for full project context before starting.

---

## Audit Scope

Work through each section below sequentially. For each finding, assign a severity:

- **CRITICAL** — Exploitable now, data breach or financial loss risk
- **HIGH** — Significant vulnerability, needs fix before launch
- **MEDIUM** — Should be fixed, but not immediately exploitable
- **LOW** — Hardening improvement, defense-in-depth
- **INFO** — Observation, no action needed

---

### 1. HTTP Security Headers

Check `src/middleware.ts` and `next.config.js` (or `next.config.mjs`) for response headers.

Verify presence and correctness of:
- `Content-Security-Policy` (CSP) — should restrict script sources, disallow unsafe-inline where possible
- `Strict-Transport-Security` (HSTS) — max-age ≥ 31536000, includeSubDomains
- `X-Frame-Options` — DENY or SAMEORIGIN
- `X-Content-Type-Options` — nosniff
- `Referrer-Policy` — strict-origin-when-cross-origin or stricter
- `Permissions-Policy` — restrict camera, microphone, geolocation, payment
- `X-DNS-Prefetch-Control` — off

Flag any missing headers as HIGH (self-hosted = no defaults).

---

### 2. Supabase RLS Policy Audit

This is the most critical section. RLS is our primary data access control layer.

**2a. Check for unprotected tables:**
- Query the Supabase migration files in `supabase/migrations/` for every `CREATE TABLE` statement
- For each table, verify a corresponding `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` exists
- For each table, verify at least one RLS policy exists for SELECT, INSERT, UPDATE, DELETE as appropriate
- Flag any table with RLS not enabled as CRITICAL

**2b. Verify policy logic for key tables:**
- `listings` — Can a user modify/delete another user's listing? Can a non-owner change status?
- `orders` / `order_items` — Can a buyer see other buyers' orders? Can a seller see orders they're not part of?
- `wallets` / `wallet_transactions` — Can anyone read/modify another user's wallet balance? This is financial data — CRITICAL if exposed
- `messages` / `conversations` — Can a user read conversations they're not a participant in?
- `profiles` — What fields are publicly readable? Are email, phone, or address exposed via the anon key?
- `reviews` — Can a user post a review for an order they didn't participate in?
- `notifications` — Can a user read another user's notifications?
- `favorites` — Low risk but verify user scoping

**2c. Service role key usage:**
- Search the entire `src/` directory for `SUPABASE_SERVICE_ROLE_KEY` or `createServiceClient` or `supabaseAdmin`
- Every usage should be in a server-only context (API route, server action, cron) — never importable from a client component
- Verify the service role key is not exposed in any `NEXT_PUBLIC_*` variable

---

### 3. Authentication & Authorization

**3a. Middleware auth checks:**
- Read `src/middleware.ts` — what routes are protected? What routes are public?
- Are dashboard/seller/order/wallet routes properly gated behind auth?
- Is there a redirect loop risk between auth pages and protected routes?

**3b. API route auth:**
- Scan ALL files in `src/app/api/` recursively
- For each route handler (GET, POST, PUT, PATCH, DELETE), verify it checks `supabase.auth.getUser()` before processing
- Flag any non-cron API route that processes mutations without auth as CRITICAL
- Check that auth uses `getUser()` (server-verified) not `getSession()` (client-provided, spoofable)

**3c. Server action auth:**
- Scan ALL `'use server'` files/functions in `src/`
- For each server action, verify it checks auth before performing any database mutation
- Flag unprotected server actions that modify data as CRITICAL

**3d. Cron route protection:**
- Verify all `/api/cron/*` routes check `Authorization: Bearer ${CRON_SECRET}`
- Verify cron routes are POST-only (not accessible via browser GET)
- Verify `CRON_SECRET` is not in any `NEXT_PUBLIC_*` variable

---

### 4. Payment Security (EveryPay)

- Find the EveryPay payment callback/webhook handler
- Verify it validates the callback authenticity (signature verification, or server-side payment status check via EveryPay API)
- Check that payment amounts are verified server-side against the expected order total (not trusting client-provided amounts)
- Verify that order creation only happens AFTER payment confirmation (as per architecture: no pending_payment status)
- Check for TOCTOU (time-of-check-time-of-use) between reservation and payment — can a listing price be changed between checkout initiation and payment confirmation?
- Check the wallet credit flow: after payment confirmed, is the seller wallet credit amount derived from the server-side order record, or could it be manipulated?

---

### 5. Input Validation & Injection

**5a. XSS vectors:**
- Check listing creation/edit forms — are title, description, and other user inputs sanitized before rendering?
- Check the messaging system — is message content escaped when displayed?
- Check review text rendering
- Check profile display name rendering
- In Next.js/React, JSX auto-escapes, but check for any use of `dangerouslySetInnerHTML`, raw HTML injection, or URL-based XSS (javascript: protocol in links)

**5b. SQL injection:**
- Supabase client uses parameterized queries by default, but check for any raw SQL via `.rpc()` calls or string interpolation in queries
- Check Postgres RPC functions in migrations for SQL injection in function bodies

**5c. Server action input validation:**
- For each server action that accepts user input, check if inputs are validated (zod schema, type checks, length limits)
- Flag any server action that passes user input directly to a database query without validation as HIGH

---

### 6. File Upload Security

- Find Supabase storage bucket configuration and policies
- Check: Are file types restricted (e.g., only images for listing photos)?
- Check: Are file sizes limited?
- Check: Are uploaded files served from a separate domain/path to prevent XSS via SVG uploads?
- Check: Is EXIF data stripped from uploaded images? (Privacy concern — location data in photos)
- Check storage bucket RLS: can a user delete another user's uploaded files?

---

### 7. Rate Limiting

- Check if any rate limiting exists on:
  - Login/registration attempts
  - Listing creation
  - Message sending
  - API routes in general
  - BGG API proxy routes (could be used to abuse BGG's rate limits via our server)
- On self-hosted Coolify/Docker without a WAF, rate limiting must be application-level
- Flag absence of rate limiting on auth endpoints as HIGH

---

### 8. Environment Variable Exposure

- Read `src/lib/env.ts` — verify that server-only secrets are not prefixed with `NEXT_PUBLIC_`
- Search all files in `src/` for direct references to `process.env` — verify no server secrets are accessed in client components
- Check `next.config.js` / `next.config.mjs` for any `env` block that might expose secrets
- Verify `.env` / `.env.local` are in `.gitignore`

---

### 9. CSRF Protection

- Next.js Server Actions have built-in CSRF protection via origin checking. Verify this is not disabled.
- For API routes that accept POST/PUT/DELETE, check if they rely solely on cookies for auth (vulnerable to CSRF) or use Authorization headers / Supabase session tokens (not vulnerable)
- Check that no API route uses GET for state-changing operations

---

### 10. Dependency Vulnerabilities

- Run `pnpm audit` and report any HIGH or CRITICAL vulnerabilities
- Check if `package.json` pins exact versions or uses ranges
- Flag any known-vulnerable packages

---

### 11. GDPR & Data Privacy

- Check if user deletion/account cleanup is implemented — can a user delete their account and have their personal data removed?
- Check what personal data is stored in `profiles` and whether it's the minimum necessary
- Check if newsletter signup has explicit consent (not pre-checked)
- Check if listing photos could leak location data (EXIF stripping)
- Check cookie consent implementation (if any)
- Note: This is an EU/Baltic platform — GDPR compliance is legally required

---

### 12. Denial of Service Vectors

- Check for any unbounded queries (e.g., listing search without pagination/limits)
- Check for expensive operations triggered by unauthenticated users (e.g., BGG API lookups)
- Check if image upload accepts arbitrarily large files
- Check if the messaging system allows unbounded message history loading

---

## Report Format

Produce the report at `docs/security-audit-report.md` with this structure:

```markdown
# Security Audit Report — Second Turn Games
**Date:** [today]
**Auditor:** Claude Code
**Codebase commit:** [current HEAD SHA]

## Executive Summary
[2-3 sentence overview: total findings by severity, most critical issues]

## Findings

### [SEVERITY] Finding title
- **Location:** `path/to/file.ts:line`
- **Description:** What the issue is
- **Risk:** What could happen if exploited
- **Recommendation:** How to fix it
- **Effort:** S/M/L

[repeat for each finding, grouped by section]

## Summary Table
| # | Severity | Finding | Location | Effort |
|---|----------|---------|----------|--------|

## Recommended Fix Order
[Prioritized list: what to fix first based on severity × effort]
```

After writing the report, run `pnpm build` to confirm the audit didn't accidentally break anything (it shouldn't, since this is read-only — but verify).
