# RLS Security Audit

**Date:** 2026-03-21
**Scope:** All public tables, storage buckets, cookie/session configuration

## Methodology

Audit all tables in the `public` schema for RLS enablement and policy coverage.
Verify anonymous access cannot reach sensitive data.

## 1. Tables Without RLS

Run this query in Supabase SQL Editor to find tables missing RLS:

```sql
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT c.relname FROM pg_class c
    WHERE c.relrowsecurity = true
  );
```

**Expected:** No rows returned (all tables have RLS enabled).

**Result:** _Run query and record results here_

## 2. All RLS Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**Result:** _Run query and record full policy list here_

## 3. Table-by-Table Access Matrix

| Table | Anon SELECT | Auth SELECT | Auth INSERT | Auth UPDATE | Auth DELETE | Notes |
|-------|-------------|-------------|-------------|-------------|-------------|-------|
| `user_profiles` | Public (display_name, country, created_at) | Own full profile | Own profile | Own profile | No | Verify email/phone not exposed to anon |
| `listings` | Active only | Active + own | Own (authenticated) | Own | No | Draft/deleted must not be visible |
| `games` | Public (catalog) | Public | Service role only | Service role only | Service role only | Public BGG data |
| `orders` | None | Buyer/seller only | Service role only | Participants only | No | Verify buyer_id/seller_id match |
| `checkout_sessions` | None | Own (buyer_id) | Service role only | Service role only | No | Contains payment data |
| `wallets` | None | Own + staff | Service role only | Service role only | No | Financial data |
| `wallet_transactions` | None | Own + staff | Service role only | Service role only | No | Financial data |
| `withdrawal_requests` | None | Own + staff | Own | Service role only | No | Staff approves/rejects |
| `audit_log` | None | None | Service role only | None | None | No policies = service role only |

## 4. Anonymous Access Tests

Run these queries to verify anon cannot access sensitive data:

```sql
-- Switch to anon role
SET ROLE anon;

-- Should return 0 rows
SELECT * FROM orders LIMIT 1;

-- Should return 0 rows
SELECT * FROM wallet_transactions LIMIT 1;

-- Should NOT return email or phone columns
SELECT email, phone FROM user_profiles LIMIT 1;

-- Should return 0 rows
SELECT * FROM checkout_sessions LIMIT 1;

-- Should return 0 rows
SELECT * FROM wallets LIMIT 1;

-- Should return 0 rows
SELECT * FROM audit_log LIMIT 1;

-- Reset
RESET ROLE;
```

**Result:** _Run queries and record results here_

## 5. Storage Buckets

| Bucket | Public Read | Write Policy | Status |
|--------|-------------|--------------|--------|
| `listing-photos` | Yes (photos must be viewable by anyone) | Auth required, path must match `{user_id}/...` | Expected |
| _Other buckets_ | _Check Dashboard_ | _Should not be public_ | _Verify_ |

**Action:** Check Supabase Dashboard > Storage > Policies for complete list.

## 6. Cookie/Session Security

| Setting | Status | Notes |
|---------|--------|-------|
| `getAll()`/`setAll()` | Correct | Verified in `src/lib/supabase/server.ts` and `middleware.ts` |
| Session refresh | Correct | `middleware.ts` calls `supabase.auth.getUser()` on every request |
| `httpOnly` | Automatic | `@supabase/ssr` sets this by default |
| `secure` | Automatic | `@supabase/ssr` sets `secure: true` in production, `false` in dev (verify via DevTools) |
| `sameSite` | Automatic | `@supabase/ssr` sets `lax` by default |
| `path` | Automatic | Set to `/` by default |

No code changes needed. Supabase SSR handles cookie security attributes automatically based on environment.
