# Pre-Launch Audit — 2026-04-13

## Summary

| Severity | Count |
|----------|-------|
| Critical | 6 |
| Should-fix | 22 |
| Nice-to-have | 18 |

**Critical items that block launch:**
1. `expire_stale_reservations` regression — can double-sell reserved listings
2. Wallet balance + transaction insert non-atomic — 2 wallets already have phantom balances
3. Wallet transaction idempotency not DB-enforced — duplicate credits possible
4. No UNIQUE on `orders.everypay_payment_reference` — double-callback race
5. Wallet balance check → debit not atomic in cart-wallet-pay — concurrent overdraw
6. `listings.seller_id ON DELETE CASCADE` can orphan active orders

---

## Phase 1: Build Gates

### Build
**Status: PASS** — Clean production build, 48 static pages, all routes compiled.

### Tests
**Status: PASS** — 24 test files, 323 tests, all passing.

### Lint
**Status: PASS (33 warnings, 0 errors)** — All warnings are React Compiler diagnostics:
- 12x `set-state-in-effect` (setState in useEffect — standard React patterns for hydration/sync)
- 9x `refs` (ref access during render — dirty detection, portal, gesture refs)
- 3x `purity` (Date.now() during render — auction timers, review window)
- 1x `immutability` (variable accessed before declaration — polling callback)
- 1x `preserve-manual-memoization` (useMemo dependency mutation)
- 1x `static-components` (component created during render — notification icon)
- 1x `exhaustive-deps` (missing useEffect dependency)

**Files:** EditShelfItemModal, ImportFromBGG, cart/page, ListingNavigation, EditListingForm, useTouchGestures, orders/[id]/page, ListingCreationFlow, BidPanel, PaymentMethodLogos, SiteHeader, RemoveListingModal, NotificationDropdown, NotificationItem, MakeOfferModal, OrderDetailClient, MapMarker, CartContext, PendingActionsContext, useUnreadNotificationCount

### Dependency Audit
**Status: 12 vulnerabilities (6 high, 6 moderate)**

| Package | Severity | Path | Risk |
|---------|----------|------|------|
| `next-intl` < 4.9.1 | moderate | runtime | **Open redirect** — SHOULD-FIX |
| `vite` (3 CVEs) | high+moderate | vitest (dev only) | Dev-only, low risk |
| `flatted` | high | eslint (dev only) | Dev-only, prototype pollution |
| `picomatch` (4 CVEs) | high+moderate | eslint-config-next (dev only) | Dev-only, ReDoS |
| `balanced-match` | moderate | eslint/minimatch (dev only) | Dev-only |

---

## 1. Security — RLS & Auth (Agent A)

### [SHOULD-FIX] Storage buckets have no file size or MIME type limits
**File(s):** Supabase Storage bucket config
**Description:** All three buckets (`listing-photos`, `dispute-photos`, `avatars`) have `file_size_limit: null` and `allowed_mime_types: null`. Any authenticated user can upload files of arbitrary size and type at the bucket level. App-level validation exists (magic-byte checks, size limits) but bucket-level constraints are defense-in-depth.
**Recommendation:** Set bucket-level constraints: `listing-photos` and `dispute-photos` 10MB + `image/jpeg,image/png,image/webp`; `avatars` 5MB + same MIME types.

### [SHOULD-FIX] `dispute-photos` bucket is publicly readable
**File(s):** Storage RLS policy `Anyone can view dispute photos`
**Description:** Anyone who knows or guesses a file path can view dispute evidence photos. Unlike listing photos (inherently public), dispute photos may contain sensitive information.
**Recommendation:** Replace public SELECT with authenticated-only access, or serve through an authenticated API route scoped to dispute participants and staff.

### [SHOULD-FIX] `checkout/payment-methods` API route has no auth or rate limiting
**File(s):** `src/app/api/checkout/payment-methods/route.ts`
**Description:** Exposes EveryPay payment method configuration to unauthenticated users.
**Recommendation:** Add `requireAuth()` and rate limiting.

### [SHOULD-FIX] `cart/validate` API route has no auth or rate limiting
**File(s):** `src/app/api/cart/validate/route.ts`
**Description:** POST endpoint returns listing availability, seller profiles, auction winner status. No auth or rate limiting.
**Recommendation:** Add rate limiting at minimum. Consider `requireAuth()`.

---

## 2. Security — Payments & Wallet (Agent B)

### [CRITICAL] No UNIQUE constraint on `orders.everypay_payment_reference`
**File(s):** `supabase/migrations/001_mvp_schema.sql`, `src/lib/services/payment-fulfillment.ts`
**Description:** `idx_orders_payment_ref` is a regular index, not unique. The idempotency check in `fulfillCartPayment` is a SELECT-then-INSERT (TOCTOU). Two concurrent callbacks (EveryPay redirect + reconciliation cron) can both find zero existing orders and create duplicates.
**Recommendation:** Add `CREATE UNIQUE INDEX ON orders(everypay_payment_reference) WHERE everypay_payment_reference IS NOT NULL`. Also implement a mutex pattern: `UPDATE cart_checkout_groups SET status = 'completing' WHERE id = $1 AND status = 'pending'` — if 0 rows affected, another caller already claimed it.

### [CRITICAL] Wallet balance check → debit not atomic in `cart-wallet-pay`
**File(s):** `src/app/api/payments/cart-wallet-pay/route.ts` (lines 124 vs 186)
**Description:** Balance read at line 124, order created over ~60 lines, debit at line 186. Two concurrent wallet-pay requests can both pass the balance check and overdraw. The optimistic lock catches the second debit, but by then the order exists and the rollback path deletes it — seller may already be notified.
**Recommendation:** Debit the wallet BEFORE creating the order. If order creation fails, refund internally.

### [SHOULD-FIX] Fire-and-forget payment reference storage in `cart-create`
**File(s):** `src/app/api/payments/cart-create/route.ts` (lines 227-232)
**Description:** `everypay_payment_reference` stored via `void` call. If this fails, the reconciliation cron (which filters by non-null reference) will never find the group. Buyer's payment is captured but no order created.
**Recommendation:** Make this `await` instead of `void`.

### [SHOULD-FIX] No HMAC signature validation on EveryPay callback
**File(s):** `src/app/api/payments/callback/route.ts`
**Description:** Relies on callback_token (unguessable UUID) + server-side `getPaymentStatus()` verification. Functionally secure, but HMAC would add defense-in-depth and reduce unnecessary API calls from spoofed callbacks.
**Recommendation:** Add EveryPay HMAC verification as a secondary check.

### [SHOULD-FIX] Reconciliation cron lacks row-level locking
**File(s):** `src/app/api/cron/reconcile-payments/route.ts`
**Description:** Two concurrent cron runs grab the same pending groups. Combined with the TOCTOU in `fulfillCartPayment`, this amplifies the double-order risk.
**Recommendation:** Use atomic status claim: `UPDATE ... SET status = 'reconciling' WHERE status = 'pending' RETURNING *`.

### [SHOULD-FIX] Wallet idempotency checks are application-level only
**File(s):** `src/lib/services/wallet.ts`
**Description:** SELECT-then-INSERT pattern for idempotency. No `UNIQUE(order_id, type)` constraint. Concurrent calls can both pass the check.
**Recommendation:** Add `CREATE UNIQUE INDEX ON wallet_transactions(order_id, type) WHERE order_id IS NOT NULL` and `UNIQUE(withdrawal_id, type) WHERE withdrawal_id IS NOT NULL`.

### [SHOULD-FIX] No Unisend webhook — tracking is poll-only (15min delay)
**File(s):** `src/app/api/cron/sync-tracking/route.ts`
**Description:** Delivery status updates delayed up to 15 minutes. Functional but suboptimal UX.
**Recommendation:** Consider adding Unisend webhook for real-time tracking. Low priority for launch.

---

## 3. Security — HTTP Headers, Validation, OWASP (Agent C)

### [SHOULD-FIX] CSP missing `upgrade-insecure-requests`
**File(s):** `src/lib/csp.ts`
**Description:** Mixed content won't be auto-upgraded to HTTPS on the self-hosted VPS.
**Recommendation:** Add `'upgrade-insecure-requests'` as first CSP directive.

### [SHOULD-FIX] Dispute photo URLs stored without origin validation
**File(s):** `src/app/api/orders/[id]/dispute/route.ts`, `src/lib/services/dispute.ts`
**Description:** Accepts arbitrary URL strings from client and stores them. A malicious client could POST `javascript:` or tracking pixel URLs that are later rendered as `<Image>` and `<a>`.
**Recommendation:** Validate URLs match expected Supabase storage pattern before storing.

### [SHOULD-FIX] Newsletter subscribe lacks Turnstile bot protection
**File(s):** `src/app/api/newsletter/subscribe/route.ts`
**Description:** Has CSRF + rate limiting but no Turnstile. Distributed bots bypass per-IP rate limiting.
**Recommendation:** Add Turnstile verification.

### [SHOULD-FIX] Avatar upload missing rate limiting
**File(s):** `src/app/api/profile/avatar/route.ts`
**Description:** No rate limiter. User could spam uploads consuming storage and sharp CPU.
**Recommendation:** Add `applyRateLimit(photoUploadLimiter, request)`.

### [SHOULD-FIX] Order action routes lack rate limiting
**File(s):** All `src/app/api/orders/[id]/*/route.ts` (accept, decline, ship, deliver, dispute, review, complete, escalate, withdraw, accept-refund)
**Description:** Auth + CSRF but no rate limiting. Could generate excessive DB load and notification spam.
**Recommendation:** Add shared order-action rate limiter (10 req/min per IP).

### [SHOULD-FIX] No pixel-limit guard on sharp image processing
**File(s):** `src/lib/images/process.ts`
**Description:** `sharp()` called without `limitInputPixels`. Default is 268MP — a crafted small file could decompress to enormous dimensions, causing OOM on the VPS.
**Recommendation:** Set `sharp(buffer, { limitInputPixels: 25_000_000 })` (25MP).

### [SHOULD-FIX] Withdrawal amount not validated as integer or bounded
**File(s):** `src/app/api/wallet/withdraw/route.ts`
**Description:** `amountCents` checked for `> 0` but not `Number.isInteger()` or max bound. Violates integer-cents invariant.
**Recommendation:** Add integer check and reasonable max bound.

**Positive findings:** Security headers comprehensive (HSTS+preload, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy), CSP well-architected with nonce+strict-dynamic, CSRF via `requireBrowserOrigin()` on all state-changing routes, no SQL injection (all through Supabase client), no XSS (React auto-escaping, no dangerouslySetInnerHTML on UGC), file uploads have magic-byte validation + EXIF stripping + UUID filenames + per-user quotas, Turnstile on all critical forms.

---

## 4. Code Review — Logic & Race Conditions (Agent D)

### [CRITICAL] `expire_stale_reservations` regression — double-sell risk
**File(s):** `supabase/migrations/061_fix_rpc_search_path_refs.sql`
**Description:** Migration 039 fixed the function to check both `orders.listing_id` (legacy) and `order_items.listing_id` (cart flow). Migration 061 rewrote the function for schema qualification but **dropped the `order_items` subquery entirely**. The cron now reverts reserved listings to `active` even when a valid cart-flow order exists — enabling double-selling.
**Recommendation:** New migration restoring the `order_items` check with `public.` schema-qualified references.

### [CRITICAL] Wallet balance update and transaction insert are non-atomic
**File(s):** `src/lib/services/wallet.ts`
**Description:** `creditWallet`, `debitWallet`, `refundToWallet` do a Supabase UPDATE (balance) then a separate INSERT (transaction). If the process crashes between them, balance changes with no audit trail. Agent F confirmed this has already happened: **2 wallets have phantom balances (EUR 51.46 and EUR 18.09) with zero transactions.**
**Recommendation:** Move wallet operations into a Postgres RPC that performs both within a single SQL transaction.

### [SHOULD-FIX] Auction payment deadline cron: batch notification race
**File(s):** `src/app/api/cron/auction-payment-deadline/route.ts`
**Description:** Batch cancels expired auctions, then sends notifications based on original query results — not actually-affected rows. Concurrent runs send duplicate notifications.
**Recommendation:** Use `.select('id')` on the update and only notify actually-affected rows.

### [SHOULD-FIX] Auction payment reminder: no optimistic lock on flag
**File(s):** `src/app/api/cron/auction-payment-deadline/route.ts`
**Description:** Updates `auction_payment_reminder_sent` without checking current value. Concurrent runs both send the reminder.
**Recommendation:** Add `.eq('auction_payment_reminder_sent', false)` to the update.

### [SHOULD-FIX] `getMyBids` query has no limit
**File(s):** `src/lib/auctions/actions.ts` (line 187)
**Description:** Fetches all bids for a user with no `.limit()`. Client-side deduplication discards most data.
**Recommendation:** Add `.limit(200)` or server-side deduplication.

### [SHOULD-FIX] `getMyOffers` and `getSellerOffers` have no limit
**File(s):** `src/lib/offers/actions.ts` (line 384)
**Description:** Both fetch all offers without pagination or limit.
**Recommendation:** Add `.limit(100)` at minimum.

### [SHOULD-FIX] `getUserWithFavorites` has no limit
**File(s):** `src/lib/favorites/actions.ts` (line 69)
**Description:** Acknowledged TODO — unbounded for users with many favorites.
**Recommendation:** Add `.limit(500)` safety cap.

### [SHOULD-FIX] `end-auctions` cron: N+1 profile fetches inside loop
**File(s):** `src/app/api/cron/end-auctions/route.ts`
**Description:** 1-3 `fetchProfiles` calls per auction inside a loop. Batch limit 50 = up to 150 profile fetches per run.
**Recommendation:** Collect all user IDs upfront, fetch once, distribute from a map.

### [SHOULD-FIX] Crons not safe for concurrent execution
**File(s):** All cron routes
**Description:** No `FOR UPDATE SKIP LOCKED` or distributed locks. Concurrent runs process the same records. Optimistic locks prevent data corruption but cause duplicate emails/notifications and wasted API calls.
**Recommendation:** Acceptable at launch scale. Add advisory locks or `SKIP LOCKED` as volume grows.

### [SHOULD-FIX] `select('*')` overuse in wallet service
**File(s):** `src/lib/services/wallet.ts`
**Description:** 12 instances of `.select('*')` when only specific fields needed (e.g., idempotency checks only need `id`).
**Recommendation:** Replace with explicit column lists.

**Positive findings:** Order state machine validates current state on every transition. Bid-vs-auction-end race properly handled with `FOR UPDATE` in `place_bid` RPC. Offer optimistic locking is sound. Timezone handling consistently UTC throughout. `Date.now()` and `.toISOString()` used correctly in all deadline code. All timestamps are `timestamptz`.

---

## 5. Code Hygiene & Production Readiness (Agent E)

### [SHOULD-FIX] Missing `loading.tsx` for most account sub-routes
**File(s):** `src/app/[locale]/account/` (favorites, offers, bids, shelf, settings, wallet, tax, notifications, wanted)
**Description:** Only `account/orders` and `account/listings` have loading states. All other account pages show no feedback during data fetch.
**Recommendation:** Add Skeleton-based `loading.tsx` to highest-traffic routes: favorites, offers, wallet, notifications.

### [SHOULD-FIX] Missing `loading.tsx` for cart, wanted, and staff routes
**File(s):** `cart/`, `wanted/`, `wanted/[id]/`, `staff/*`
**Description:** Public-facing pages that fetch data have no loading states.
**Recommendation:** Add `loading.tsx` for cart and wanted pages at minimum.

### [SHOULD-FIX] No pagination on account list pages
**File(s):** `account/favorites`, `account/offers`, `account/bids`, `account/shelf`, wallet transactions, notifications
**Description:** All load full result sets in a single query. Combined with the missing `.limit()` calls from Agent D findings.
**Recommendation:** Add pagination to favorites and notifications (highest volume). Add `.limit(100)` safety caps to all others.

### [NICE-TO-HAVE] Unisend PII in server logs
**File(s):** `src/lib/services/unisend/client.ts` (lines 279, 285)
**Description:** Logs full JSON parcel payloads including names and phone numbers.
**Recommendation:** Redact PII fields in log output.

### [NICE-TO-HAVE] Newsletter subscribe logs email addresses
**File(s):** `src/app/api/newsletter/subscribe/route.ts` (line 49)
**Recommendation:** Remove or redact. Minor GDPR concern.

### [NICE-TO-HAVE] Invoice numbering TODO
**File(s):** `src/lib/services/document-service.ts`
**Description:** Sequential numbering not implemented; uses order_number. VID expects proper numbering for credit notes.
**Recommendation:** Address before significant volume or VAT audit.

### [NICE-TO-HAVE] i18n hardcoded strings in pending actions
**File(s):** `src/lib/pending-actions/types.ts`
**Recommendation:** Address before Latvian locale.

### [NICE-TO-HAVE] Dead code — unused ReviewStep component
**File(s):** `src/app/[locale]/sell/_components/ReviewStep.tsx`
**Recommendation:** Delete.

### [NICE-TO-HAVE] No root-level `not-found.tsx`
**File(s):** `src/app/not-found.tsx` (missing)
**Description:** Requests outside locale prefix may show bare Next.js 404.
**Recommendation:** Add minimal root `not-found.tsx`.

### [NICE-TO-HAVE] Browse page missing `generateMetadata`
**File(s):** `src/app/[locale]/browse/page.tsx`
**Description:** Search queries not reflected in page title.
**Recommendation:** Add `generateMetadata` with search query in title.

### [NICE-TO-HAVE] `RESEND_AUDIENCE_ID` and `ADMIN_EMAIL` not validated in env schema
**File(s):** `src/lib/env.ts`
**Recommendation:** Add to `optional` list in schema.

### [NICE-TO-HAVE] Cookie consent — not required currently
**File(s):** `src/app/[locale]/layout.tsx` (comment at line 23-25)
**Description:** Only Supabase auth session cookies (strictly necessary, GDPR-exempt). Valid justification. Must revisit if analytics added.

**Positive findings:** Privacy Policy, ToS, Seller Terms pages all exist. Account deletion (`/api/account/delete`) and data export (`/api/account/export-data`) both implemented. Error pages well-covered (locale not-found, error, global-error, plus route-specific boundaries). SEO comprehensive (JSON-LD, sitemap, OG tags, robots, per-page metadata on listings/sellers/wanted). All images use `next/image` (except favicon SVG). Env validation solid.

---

## 6. Data Integrity (Agent F)

### [CRITICAL] Wallet balance drift — 2 wallets have phantom balances
**File(s):** `wallets` table, `wallet_transactions` table
**Description:** Two wallets have non-zero `balance_cents` with zero transactions:
- Wallet `90803eff...` (user `7d1058...`): EUR 51.46 with no transactions
- Wallet `fe2361ff...` (user `9f8d34...`): EUR 18.09 with no transactions

This is real-world evidence of the non-atomic wallet mutation (Agent D Critical finding).
**Recommendation:** (1) Investigate and correct these two wallets immediately. (2) Add a `reconcile-wallets` cron that alerts on drift. (3) Make wallet operations atomic via Postgres RPC.

### [CRITICAL] `listings.seller_id ON DELETE CASCADE` can orphan orders
**File(s):** `listings.seller_id` FK
**Description:** If a seller's `user_profiles` row is deleted and all their orders are completed, CASCADE silently deletes all listings — destroying historical data that `order_items.listing_id` references.
**Recommendation:** Change from `CASCADE` to `RESTRICT`. Seller deletion should be a controlled process (soft-delete/anonymize), not a cascade.

### [SHOULD-FIX] No CHECK constraints on orders monetary columns
**File(s):** `orders` table
**Description:** `total_amount_cents`, `items_total_cents`, `shipping_cost_cents`, `platform_commission_cents`, `seller_wallet_credit_cents`, `buyer_wallet_debit_cents`, `refund_amount_cents` all lack `CHECK (>= 0)`. By contrast, `wallets.balance_cents`, `listings.price_cents`, and `wallet_transactions.amount_cents` all have checks.
**Recommendation:** Add `CHECK (column >= 0)` to all monetary columns.

### [SHOULD-FIX] No CHECK constraint on `order_items.price_cents`
**File(s):** `order_items` table
**Recommendation:** Add `CHECK (price_cents > 0)`.

### [SHOULD-FIX] Order status transitions not enforced at DB level
**File(s):** `orders` table
**Description:** Valid values enforced via CHECK, but no trigger prevents invalid transitions (e.g., `completed` → `pending_seller`). All logic in application code.
**Recommendation:** Add `BEFORE UPDATE` trigger enforcing terminal states (`completed`, `refunded`) cannot transition.

### [SHOULD-FIX] No CHECK on `orders.cancellation_reason`
**File(s):** `orders` table
**Description:** Free text, but app defines 4 valid values.
**Recommendation:** Add `CHECK (cancellation_reason IS NULL OR cancellation_reason IN ('declined','response_timeout','shipping_timeout','system'))`.

### [SHOULD-FIX] `orders.cart_group_id` has no FK to `cart_checkout_groups`
**File(s):** `orders` table
**Recommendation:** Add FK with `ON DELETE SET NULL`.

### [SHOULD-FIX] Schema drift — 6 local migrations not in remote
**File(s):** `supabase/migrations/` vs `supabase_migrations.schema_migrations`
**Description:** Migrations 039, 040, 048, 058, 059, 066 have no entry in remote schema_migrations. Likely applied manually or superseded.
**Recommendation:** Record manually-applied migrations. Apply 066 if intended. Update 048 to match actual DB constraint.

### [SHOULD-FIX] User deletion blocked by many NO ACTION FKs
**File(s):** Multiple tables
**Description:** Any user with orders, bids, reviews, or offers can never be hard-deleted. Some tables CASCADE (listings, wallets), others block (orders, bids, reviews). Contradictory behavior.
**Recommendation:** Acceptable for launch (marketplace should not delete users with financial history). Document as intended. Build soft-delete/anonymize flow.

**Positive findings:** All 68 timestamp columns use `timestamptz`. Key unique constraints in place (one wallet per user, one review per order, unique order numbers, no duplicate favorites). `wallets.balance_cents CHECK >= 0` exists.

---

## 7. Infrastructure & Ops (Agent G)

### [CRITICAL] Verify `RESEND_FROM_EMAIL` uses verified custom domain
**File(s):** `src/lib/env.ts` (runtime config)
**Description:** From-address is environment-configured. If set to `@resend.dev` in production, emails have poor deliverability (SPF/DKIM won't align).
**Recommendation:** Verify manually: Coolify env has custom domain address. Resend dashboard shows passing SPF/DKIM/DMARC. Run `dig TXT secondturngames.com` to confirm DMARC.

### [SHOULD-FIX] Global `Cache-Control: no-store` prevents Cloudflare edge caching
**File(s):** `next.config.mjs`
**Description:** Catch-all `source: '/(.*)'` sets `no-cache, no-store, must-revalidate` on all responses including public pages. Cloudflare CDN cannot cache anything.
**Recommendation:** Narrow to authenticated routes only. Use `s-maxage` with `stale-while-revalidate` for public pages. Or verify Cloudflare cache rules override the origin header.

### [SHOULD-FIX] HSTS preload — verify Cloudflare alignment
**File(s):** `next.config.mjs`
**Description:** App sets HSTS with `preload`. If Cloudflare also sets HSTS, there are duplicate headers (harmless but messy). The `preload` directive means the domain should be submitted to hstspreload.org.
**Recommendation:** Check Cloudflare HSTS settings. Submit to hstspreload.org or remove `; preload`.

### [SHOULD-FIX] No Reply-To header on transactional emails
**File(s):** `src/lib/email/service.ts`
**Description:** Users replying to order/dispute emails get a bounce if from-address is noreply@.
**Recommendation:** Add `replyTo: 'support@secondturngames.com'`.

### [SHOULD-FIX] No bounce/complaint webhook handling
**File(s):** Missing `/api/webhooks/resend/`
**Description:** No visibility into hard bounces or complaints. Failed sends silently drop notifications.
**Recommendation:** Create Resend webhook endpoint for `email.bounced` and `email.complained`. Flag affected users.

### [NICE-TO-HAVE] Dockerfile missing HEALTHCHECK instruction
**File(s):** `Dockerfile`
**Recommendation:** Add `HEALTHCHECK` using the existing `/api/health` endpoint.

### [NICE-TO-HAVE] Node 20 reaches EOL this month
**File(s):** `Dockerfile`
**Recommendation:** Upgrade to `node:22-alpine`.

### [NICE-TO-HAVE] Health endpoint could include version/uptime
**File(s):** `src/app/api/health/route.ts`
**Recommendation:** Add `version` from build-time git SHA and `uptime` from `process.uptime()`.

### [NICE-TO-HAVE] No proxy config in repo
**Description:** Traefik/Coolify config is UI-only, not version-controlled.
**Recommendation:** Export and store as reference file.

### Manual Verification Checklist (outside codebase)
1. SSH key-only authentication (`PasswordAuthentication no`)
2. UFW: only ports 22, 80, 443 open
3. fail2ban active for SSH
4. Coolify admin 2FA enabled
5. 1-2GB swap configured
6. Supabase PITR enabled
7. Resend domain SPF/DKIM/DMARC passing
8. Cloudflare SSL mode: Full (strict)
9. Cloudflare HSTS settings checked against app-level
10. Docker log rotation configured

---

## 8. Dependency Vulnerabilities (Phase 1)

### [SHOULD-FIX] `next-intl` < 4.9.1 open redirect
**File(s):** `package.json`
**Description:** Runtime dependency with moderate open redirect vulnerability.
**Recommendation:** Upgrade `next-intl` to >= 4.9.1.

### [NICE-TO-HAVE] Dev dependency vulnerabilities (vite, flatted, picomatch, balanced-match)
**Description:** 11 vulnerabilities in dev-only dependencies (eslint, vitest chains). Not shipped to production.
**Recommendation:** Update when compatible versions available. Not launch-blocking.

---

## 9. Lint Warnings (Phase 1)

### [NICE-TO-HAVE] 33 React Compiler warnings
**Description:** All warnings are React Compiler diagnostics (set-state-in-effect, ref access during render, impure functions). These are standard React patterns that the compiler flags for future optimization but do not cause bugs.
**Recommendation:** Address incrementally post-launch. The `Date.now()` purity warnings in auction/order components are the most straightforward to fix (move to useEffect or useMemo).
