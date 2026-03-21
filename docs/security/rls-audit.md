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

**Result:** Success. No rows returned

## 2. All RLS Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**Result:** | schemaname | tablename           | policyname                               | permissive | roles    | cmd    | qual                                                                                                                                                                                   | with_check                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------- | ---------------------------------------- | ---------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| public     | checkout_sessions   | Buyers can view own sessions             | PERMISSIVE | {public} | SELECT | (auth.uid() = buyer_id)                                                                                                                                                                | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | conversations       | Buyers can start conversations           | PERMISSIVE | {public} | INSERT | null                                                                                                                                                                                   | (auth.uid() = buyer_id)                                                                                                                                                                                                                                                                                                                                             |
| public     | conversations       | Participants can view conversations      | PERMISSIVE | {public} | SELECT | ((auth.uid() = buyer_id) OR (auth.uid() = seller_id))                                                                                                                                  | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | conversations       | Participants can update conversations    | PERMISSIVE | {public} | UPDATE | ((auth.uid() = buyer_id) OR (auth.uid() = seller_id))                                                                                                                                  | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | favorites           | Users can remove favorites               | PERMISSIVE | {public} | DELETE | (auth.uid() = user_id)                                                                                                                                                                 | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | favorites           | Users can add favorites                  | PERMISSIVE | {public} | INSERT | null                                                                                                                                                                                   | (auth.uid() = user_id)                                                                                                                                                                                                                                                                                                                                              |
| public     | favorites           | Users can view own favorites             | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id)                                                                                                                                                                 | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | games               | Games are publicly readable              | PERMISSIVE | {public} | SELECT | true                                                                                                                                                                                   | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | listings            | Authenticated users can create listings  | PERMISSIVE | {public} | INSERT | null                                                                                                                                                                                   | (auth.uid() = seller_id)                                                                                                                                                                                                                                                                                                                                            |
| public     | listings            | Anyone can view active listings          | PERMISSIVE | {public} | SELECT | ((status = 'active'::text) OR (seller_id = auth.uid()))                                                                                                                                | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | listings            | Sellers can update own listings          | PERMISSIVE | {public} | UPDATE | (auth.uid() = seller_id)                                                                                                                                                               | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | messages            | Participants can send messages           | PERMISSIVE | {public} | INSERT | null                                                                                                                                                                                   | ((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.buyer_id = auth.uid()) OR (c.seller_id = auth.uid()))))))                                                                                                                                                                               |
| public     | messages            | Participants can view messages           | PERMISSIVE | {public} | SELECT | (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.buyer_id = auth.uid()) OR (c.seller_id = auth.uid())))))                                 | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | messages            | Recipients can mark messages as read     | PERMISSIVE | {public} | UPDATE | ((sender_id <> auth.uid()) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.buyer_id = auth.uid()) OR (c.seller_id = auth.uid())))))) | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | orders              | Buyers and sellers can view their orders | PERMISSIVE | {public} | SELECT | ((auth.uid() = buyer_id) OR (auth.uid() = seller_id))                                                                                                                                  | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | orders              | Participants can update orders           | PERMISSIVE | {public} | UPDATE | ((auth.uid() = buyer_id) OR (auth.uid() = seller_id))                                                                                                                                  | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | reviews             | reviews_insert                           | PERMISSIVE | {public} | INSERT | null                                                                                                                                                                                   | ((auth.uid() = reviewer_id) AND (EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = reviews.order_id) AND (orders.buyer_id = auth.uid()) AND (orders.seller_id = reviews.seller_id) AND (orders.status = ANY (ARRAY['delivered'::text, 'completed'::text])) AND (orders.delivered_at IS NOT NULL) AND (orders.delivered_at > (now() - '30 days'::interval)))))) |
| public     | reviews             | reviews_select                           | PERMISSIVE | {public} | SELECT | true                                                                                                                                                                                   | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | user_profiles       | Users can view any profile               | PERMISSIVE | {public} | SELECT | true                                                                                                                                                                                   | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | user_profiles       | Users can update own profile             | PERMISSIVE | {public} | UPDATE | (auth.uid() = id)                                                                                                                                                                      | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | wallet_transactions | Users can view own transactions          | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id)                                                                                                                                                                 | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | wallet_transactions | Staff can view all transactions          | PERMISSIVE | {public} | SELECT | (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_staff = true))))                                                               | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | wallets             | Staff can view all wallets               | PERMISSIVE | {public} | SELECT | (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_staff = true))))                                                               | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | wallets             | Users can view own wallet                | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id)                                                                                                                                                                 | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | withdrawal_requests | Users can create own withdrawals         | PERMISSIVE | {public} | INSERT | null                                                                                                                                                                                   | (auth.uid() = user_id)                                                                                                                                                                                                                                                                                                                                              |
| public     | withdrawal_requests | Staff can view all withdrawals           | PERMISSIVE | {public} | SELECT | (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_staff = true))))                                                               | null                                                                                                                                                                                                                                                                                                                                                                |
| public     | withdrawal_requests | Users can view own withdrawals           | PERMISSIVE | {public} | SELECT | (auth.uid() = user_id)                                                                                                                                                                 | null                                                                                                                                                                                                                                                                                                                                                                |

## 3. Table-by-Table Access Matrix (Verified 2026-03-21)

| Table | Anon SELECT | Auth SELECT | Auth INSERT | Auth UPDATE | Auth DELETE | Status |
|-------|-------------|-------------|-------------|-------------|-------------|--------|
| `user_profiles` | **ALL columns (VULNERABLE)** | Any profile | Own profile | Own profile | No | ACTION REQUIRED |
| `listings` | Active only | Active + own | Own (authenticated) | Own | No | PASS |
| `games` | Public (catalog) | Public | Service role only | Service role only | Service role only | PASS |
| `orders` | None | Buyer/seller only | Service role only | Participants only | No | PASS |
| `checkout_sessions` | None | Own (buyer_id) | Service role only | Service role only | No | PASS |
| `wallets` | None | Own + staff | Service role only | Service role only | No | PASS |
| `wallet_transactions` | None | Own + staff | Service role only | Service role only | No | PASS |
| `withdrawal_requests` | None | Own + staff | Own | Service role only | No | PASS |
| `conversations` | None | Buyer/seller only | Buyer only | Participants only | No | PASS |
| `favorites` | None | Own only | Own only | No | Own only | PASS |
| `messages` | None | Participants only | Participants only | Recipients only | No | PASS |
| `reviews` | Public | Public | Reviewer + order validation | No | No | PASS |
| `audit_log` | None | None | Service role only | None | None | NOT YET DEPLOYED |

### ACTION REQUIRED: `user_profiles` exposes PII to anonymous users

The `"Users can view any profile"` SELECT policy uses `qual: true`, which allows the anon role (exposed via the public Supabase REST API key) to read ALL columns of ALL profiles:

- `email` — personal email addresses
- `phone` — phone numbers
- `is_staff` — reveals admin accounts
- `country_confirmed` — internal flag

**Verified:** `SET ROLE anon; SELECT email, phone FROM user_profiles;` returns real user data.

**Fix options:**
1. Replace the public SELECT policy with two policies: one for authenticated users (`auth.uid() IS NOT NULL`) granting full access, and one for anon granting access to only safe columns via a database view
2. Restrict the SELECT policy to authenticated users only (`auth.uid() IS NOT NULL`) — simplest fix, anon doesn't need profile data since listings already embed `game_name` and the browse page doesn't show seller profiles

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

**Results (verified 2026-03-21):**
- `SELECT * FROM orders LIMIT 1` — 0 rows (PASS)
- `SELECT * FROM wallet_transactions LIMIT 1` — 0 rows (PASS)
- `SELECT email, phone FROM user_profiles LIMIT 1` — **RETURNED DATA (FAIL)** — see action item above
- `SELECT * FROM checkout_sessions LIMIT 1` — 0 rows (PASS)
- `SELECT * FROM wallets LIMIT 1` — 0 rows (PASS)
- `SELECT * FROM conversations` — 0 rows (PASS)
- `SELECT * FROM favorites` — 0 rows (PASS)
- `SELECT * FROM messages` — 0 rows (PASS)
- `SELECT * FROM audit_log LIMIT 1` — table does not exist yet (migration 020 not applied)

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
