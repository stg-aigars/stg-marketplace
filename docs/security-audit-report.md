# Security Audit Report — Second Turn Games

**Date:** 2026-03-30
**Auditor:** Claude Code
**Codebase commit:** `d3f0a85df53d9d1965580b144ed2851c63debbfa`

**Caveat — RLS audit scope:** This audit reviews migration files (intended state). If RLS policies were ever modified directly via Supabase dashboard, migrations may not reflect the deployed state. For production verification, run `supabase db dump --schema public` against the live database and diff against migration files.

---

## Executive Summary

**Total findings: 38** — 2 CRITICAL, 4 HIGH, 12 MEDIUM, 14 LOW, 6 INFO.

The most urgent issues are two RLS policy gaps that allow any authenticated user to escalate to staff (accessing all financial data) and to manipulate order amounts directly via the Supabase REST API. These are exploitable today with minimal technical skill. The payment infrastructure is well-architected but has a known gap where browser-close after payment leaves no order record. GDPR compliance has two gaps (no EXIF stripping, no cookie consent). HTTP headers, CSP, auth patterns, and input validation are all solid.

---

## Findings

### 1. HTTP Security Headers

#### [MEDIUM] F1: HSTS missing `preload` directive
- **Location:** `next.config.mjs:20`
- **Description:** HSTS is `max-age=31536000; includeSubDomains` but missing `preload`. First-time visitors are vulnerable to SSL stripping until they receive the header.
- **Risk:** First-visit MITM on self-hosted infra without edge protection.
- **Recommendation:** Add `; preload` and submit to hstspreload.org after auditing all subdomains.
- **Effort:** S

#### [MEDIUM] F2: Permissions-Policy missing `payment` restriction
- **Location:** `next.config.mjs:19`
- **Description:** `Permissions-Policy: camera=(), microphone=(), geolocation=()` does not restrict `payment`. A marketplace processing real payments should deny the Payment Request API (EveryPay uses redirect-based flow, not browser Payment Request API).
- **Risk:** XSS payload could invoke Payment Request API without restriction.
- **Recommendation:** Change to `camera=(), microphone=(), geolocation=(), payment=()`.
- **Effort:** S

#### [LOW] F3: X-DNS-Prefetch-Control set to `on`
- **Location:** `next.config.mjs:21`
- **Description:** Set to `on`, leaking link presence to DNS resolvers. Security-hardened default is `off`.
- **Risk:** Minimal. Browsing pattern disclosure at network layer.
- **Recommendation:** Change to `off`.
- **Effort:** S

#### [LOW] F4: Permissions-Policy missing common restrictions
- **Location:** `next.config.mjs:19`
- **Description:** `interest-cohort`, `usb`, `bluetooth` unrestricted. Third-party scripts (if any bypass CSP) could enroll users in ad tracking.
- **Recommendation:** Add `interest-cohort=(), usb=(), bluetooth=()`.
- **Effort:** S

#### Passing: CSP (nonce + strict-dynamic, `unsafe-eval` dev-only), X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), X-Powered-By (suppressed), API routes (minimal CSP `default-src 'none'`).

---

### 2. Supabase RLS Policy Audit

#### [CRITICAL] F5: Users can self-promote to staff via `user_profiles` UPDATE
- **Location:** `supabase/migrations/001_mvp_schema.sql:63-65`
- **Description:** The UPDATE policy on `user_profiles` is `USING (auth.uid() = id)` with **no column restrictions**. The `is_staff` boolean is writable. Any authenticated user can execute `UPDATE user_profiles SET is_staff = true WHERE id = auth.uid()` via the Supabase REST API, gaining staff access to all wallets, all wallet transactions (including IBAN numbers in withdrawal requests), and all disputes.
- **Risk:** Full privilege escalation. Complete financial data exposure across all users. Exploitable with a single API call.
- **Recommendation:** Either: (a) add a BEFORE UPDATE trigger that prevents `is_staff` changes, (b) add a WITH CHECK clause enforcing `is_staff = (SELECT is_staff FROM user_profiles WHERE id = auth.uid())`, or (c) move `is_staff` to a separate `staff_roles` table writable only via service role.
- **Effort:** S

#### [CRITICAL] F6: Orders UPDATE policy allows financial field manipulation
- **Location:** `supabase/migrations/001_mvp_schema.sql:215-217`
- **Description:** The policy `USING (auth.uid() = buyer_id OR auth.uid() = seller_id)` allows either party to UPDATE **any column** including `total_amount_cents`, `platform_commission_cents`, `seller_wallet_credit_cents`, `refund_amount_cents`, `status`, and `everypay_payment_reference`.
- **Risk:** A malicious buyer or seller can directly manipulate order financial fields via the Supabase REST API — zeroing commissions, changing amounts, or marking orders as completed to trigger wallet credits.
- **Recommendation:** Remove the user-facing UPDATE policy entirely. All order state transitions already go through service role in application code.
- **Effort:** S

#### [MEDIUM] F7: `expire_stale_reservations` callable by any user including anon
- **Location:** `supabase/migrations/017_reservation_timer.sql:12-25`
- **Description:** `SECURITY DEFINER` function with no `REVOKE` from `public`. Accepts a `cutoff` timestamp. An anonymous caller can invoke `SELECT expire_stale_reservations(NOW() + interval '1 year')` to expire all active reservations instantly.
- **Risk:** Marketplace-wide checkout disruption. All buyers mid-payment lose their reservations.
- **Recommendation:** `REVOKE EXECUTE ON FUNCTION expire_stale_reservations FROM public, anon, authenticated`.
- **Effort:** S

#### [MEDIUM] F8: `reserve_listings_atomic` / `unreserve_listings` callable by any authenticated user
- **Location:** `supabase/migrations/025_cart_checkout.sql:38-100`
- **Description:** No access restriction or `auth.uid()` guard. Any authenticated user can reserve/unreserve listings with an arbitrary `p_buyer_id`.
- **Risk:** DoS by mass-reserving all active listings (30-minute locks). Checkout disruption by unreserving others' reservations.
- **Recommendation:** `REVOKE` from public or add `auth.uid() = p_buyer_id` guard.
- **Effort:** S

#### [MEDIUM] F9: Listings UPDATE allows seller to manipulate all columns
- **Location:** `supabase/migrations/001_mvp_schema.sql:158-159`
- **Description:** `USING (auth.uid() = seller_id)` with no column restrictions. Seller can change `status`, `seller_id` (transfer ownership), `price_cents`, `reserved_by`, `current_bid_cents`, and auction fields directly.
- **Risk:** Re-activate sold listings, manipulate auction state, transfer listing ownership.
- **Recommendation:** Restrict updatable columns or route all mutations through service role.
- **Effort:** M

#### Passing: wallets/wallet_transactions (SELECT-only for owner+staff, writes via service role, CHECK balance >= 0), messages/conversations (participant-scoped with EXISTS subquery), reviews (buyer-only INSERT with order check + 30-day window, immutable), notifications (user-scoped), favorites (user-scoped), shelf_items (public SELECT, user-scoped CUD), offers/wanted_offers (user-scoped, no self-offers), bids (public SELECT, user-scoped INSERT), disputes (participants+staff SELECT, writes via service role), audit_log (no policies = service-only), order_items (participant SELECT via join, writes via service role). All 22 tables have RLS enabled. Service role usage in 39 files, all server-only. SERVICE_ROLE_KEY not in any NEXT_PUBLIC_ variable.

---

### 3. Authentication & Authorization

#### [MEDIUM] F10: Turnstile graceful degradation allows bypass
- **Location:** `src/lib/turnstile.ts:20, 51-53`
- **Description:** Two skip paths: (1) missing `TURNSTILE_SECRET_KEY` returns `success: true`, (2) Cloudflare verification network error returns `success: true`. An attacker who forces Turnstile unavailability bypasses all bot protection on login, signup, listing creation, payments, and bidding.
- **Risk:** Credential stuffing, spam listings, bid manipulation, bulk offer flooding.
- **Recommendation:** Return `success: false` on network errors with a user-friendly retry message. Log a production warning at startup if secret key is missing.
- **Effort:** S

#### [LOW] F11: Auction state endpoint exposes `highest_bidder_id` UUID
- **Location:** `src/app/api/auctions/[id]/state/route.ts:24`
- **Description:** Returns the full Supabase user UUID of the highest bidder to any unauthenticated caller.
- **Risk:** User UUID enumeration across auctions. Minimal direct exploitability.
- **Recommendation:** Return `isCurrentUserHighestBidder` boolean instead.
- **Effort:** S

#### Passing: Middleware protects `/account`, `/sell`, `/orders`, `/messages`, `/checkout`, `/staff`. All server actions check `getUser()`. All 9 cron routes POST-only with Bearer token. No `getSession()` in auth-critical paths. All 22 non-cron mutation API routes have auth checks. Staff routes use `requireStaffAuth()`.

---

### 4. Payment Security (EveryPay)

#### [HIGH] F12: Missing server-to-server webhook — paid but no order created
- **Location:** `src/app/api/payments/callback/route.ts:1-12` (TODO comment)
- **Description:** The browser redirect callback is the **only** mechanism that creates orders after EveryPay payment. If the buyer's browser closes after payment capture but before redirect, the payment is captured but no order exists in STG. The buyer loses money with no platform record.
- **Risk:** Financial loss for customers. No automated detection or recovery. Manual intervention required to discover and resolve. Potential chargebacks and legal exposure.
- **Recommendation:** Implement a reconciliation cron that queries pending `checkout_sessions` older than N minutes and checks their payment status via `getPaymentStatus()`, creating orders for confirmed payments.
- **Effort:** M

#### [HIGH] F13: Payment callback has no rate limiting or IP allowlisting
- **Location:** `src/app/api/payments/callback/route.ts:56`
- **Description:** Public GET endpoint with no rate limiting (only POST routes are rate-limited). No IP allowlisting for EveryPay's IP range. While the callback token + server-side EveryPay API check prevents fabricated orders, an attacker can probe the endpoint to trigger unnecessary EveryPay API calls and enumerate payment references.
- **Risk:** Enumeration attacks, EveryPay API quota consumption, potential replay of intercepted callback URLs.
- **Recommendation:** Add rate limiting to the GET callback. When implementing the webhook, use EveryPay's HMAC signature verification.
- **Effort:** S

#### [MEDIUM] F14: Cart callback does not verify `order_reference`
- **Location:** `src/app/api/payments/callback/route.ts:410-443`
- **Description:** Single-item callback verifies `paymentStatus.order_reference !== session.order_number` (line 191-198) and refunds on mismatch. The cart callback handler skips this check entirely.
- **Risk:** A payment from a different checkout flow could theoretically be applied to the wrong cart group.
- **Recommendation:** Add `order_reference` verification matching the single-item pattern.
- **Effort:** S

#### [MEDIUM] F15: Legacy callback token null bypass
- **Location:** `src/app/api/payments/callback/route.ts:125-127`
- **Description:** Token validation: `if (session.callback_token && session.callback_token !== callbackToken)`. If `callback_token` is null (legacy sessions), the check is skipped. The cart path (line 402) does NOT have this bypass.
- **Risk:** Legacy checkout sessions with null tokens are vulnerable to callback forgery (still limited by EveryPay API verification).
- **Recommendation:** Change to `if (!callbackToken || session.callback_token !== callbackToken)`. Run data migration to ensure all pending sessions have tokens.
- **Effort:** S

#### [MEDIUM] F16: Wallet debit failure silently continues in card payment flow
- **Location:** `src/app/api/payments/callback/route.ts:267-283`
- **Description:** When split payment (card + wallet) succeeds at EveryPay but wallet debit fails, the order is still created with `buyer_wallet_debit_cents = 0`. The buyer effectively gets a discount. Relies on staff dashboard discovery for reconciliation.
- **Risk:** A buyer causing concurrent wallet spend between payment capture and debit could pay less than the order total.
- **Recommendation:** Implement a reconciliation cron that retries failed wallet debits, or create staff alerts when this occurs.
- **Effort:** S (alerting) / M (retry cron)

#### [MEDIUM] F17: Cart wallet payment partial failure — no rollback
- **Location:** `src/app/api/payments/cart-wallet-pay/route.ts:179-186`
- **Description:** Multi-seller cart creates orders in a loop. If the Nth order fails, previous orders and wallet debits are NOT rolled back.
- **Risk:** Buyer has some orders created and wallet debited, remaining items unreserved. Inconsistent state.
- **Recommendation:** Implement rollback or accept partial fulfillment with clear buyer communication.
- **Effort:** M

#### [LOW] F18: Callback token exposed in URL query parameter
- **Location:** `src/app/api/payments/create/route.ts:202`
- **Description:** Token in URL query can appear in server logs, browser history, referrer headers. Mitigated by idempotency checks.
- **Effort:** N/A (accept risk)

#### [LOW] F19: No reconciliation for wallet-only payment crash window
- **Location:** `src/app/api/payments/wallet-pay/route.ts:1-11`
- **Description:** Process crash between reservation and order creation could leave listing stuck as reserved with no order. `expire-reservations` cron (30 min) provides eventual recovery.
- **Effort:** S

#### Passing: Server-side EveryPay API verification, amount recalculation, order creation only after confirmation, reservation system (30-min TTL), wallet optimistic locking + CHECK constraint, idempotency on credit/debit/refund, self-purchase prevention, CSRF on all payment routes, rate limiting + Turnstile on payment initiation.

---

### 5. Input Validation & Injection

#### [MEDIUM] F20: `/api/games/enrich-batch` missing CSRF + rate limiting
- **Location:** `src/app/api/games/enrich-batch/route.ts:14`
- **Description:** POST route that writes to `games` table using service client. Has auth but no `requireBrowserOrigin()` (unlike the single-game variant) and no rate limiting.
- **Risk:** CSRF could trigger BGG API quota consumption and unnecessary database writes.
- **Recommendation:** Add `requireBrowserOrigin(request)` and rate limiting.
- **Effort:** S

#### [LOW] F21: `.ilike()` does not escape wildcard characters
- **Location:** `src/app/api/games/search/route.ts:20`, `src/app/[locale]/browse/page.tsx:103`
- **Description:** User search strings passed to `.ilike('name', '%${q}%')` without escaping `%` and `_`. A search for `%` matches all rows.
- **Risk:** Functional correctness issue. Game search is rate-limited (30/min).
- **Recommendation:** Escape wildcards: `q.replace(/%/g, '\\%').replace(/_/g, '\\_')`.
- **Effort:** S

#### [LOW] F22: Display name length not validated at signup
- **Location:** `src/lib/auth/actions.ts:40-70` (signUpWithEmail), `src/lib/auth/actions.ts:114-147` (updateProfile)
- **Description:** `signUpWithEmail` and `updateProfile` accept arbitrarily long display names. The dedicated `updateDisplayName` action enforces 100 chars.
- **Recommendation:** Add `if (displayName.length > 100) return { error: '...' }`.
- **Effort:** S

#### [INFO] F23: No Zod schema validation for server actions
- **Description:** All validation is manual if/else checks. Functional but fragile for future additions. Current manual validation is thorough.
- **Recommendation:** Consider incremental Zod adoption for new actions.

#### Passing: Zero `dangerouslySetInnerHTML`. Zero `javascript:` protocol hrefs. Zero SQL injection vectors — all RPC calls parameterized, all DB access via query builder. All Postgres functions use parameterized inputs. 22/24 non-cron mutation routes have CSRF. Server Actions have Next.js built-in origin checking (not disabled). Auth actions use `safeReturnUrl()` preventing open redirects.

---

### 6. File Upload Security

#### [HIGH] F24: No EXIF stripping — GPS location data in user photos
- **Location:** `src/app/api/listings/photos/route.ts:125-127`, `src/app/api/disputes/photos/route.ts:124-126`
- **Description:** Uploaded JPEG images stored with original EXIF metadata intact. EXIF commonly contains GPS coordinates, device info, and timestamps. All listing photos are publicly accessible.
- **Risk:** Sellers unknowingly publish their home address via GPS coordinates in listing photos. GDPR Article 5(1)(c) data minimization violation.
- **Recommendation:** Strip EXIF before storage using `sharp` (already a Next.js dependency): `sharp(buffer).rotate().toBuffer()` preserves orientation while removing metadata.
- **Effort:** S

#### [LOW] F25: Dispute photo bucket policies commented out
- **Location:** `supabase/migrations/022_disputes.sql:91-106`
- **Description:** Storage bucket creation and RLS policies for `dispute-photos` are commented out ("done via Supabase dashboard"). No DELETE policy exists. Security config not tracked in version control.
- **Risk:** Drift between environments. Storage bloat (no user cleanup).
- **Recommendation:** Uncomment and include in migration. Add DELETE policy.
- **Effort:** S

#### Passing: Magic-byte detection (JPEG/PNG/WebP/AVIF), SVG blocked, 10MB Content-Length pre-check, per-user 100-photo quota, user-scoped storage paths with RLS, rate-limited uploads. Files served from `*.supabase.co` (different origin).

---

### 7. Rate Limiting

#### [MEDIUM] F26: Login and registration have no rate limiting
- **Location:** `src/lib/auth/actions.ts:18-38, 40-71`
- **Description:** Auth actions rely solely on Turnstile. No per-IP rate limiting. Password reset (`resetPassword`) also unprotected — can spam arbitrary email addresses.
- **Risk:** Credential stuffing attacks. Turnstile prevents bots but not human attackers or CAPTCHA-solving services.
- **Recommendation:** Add per-IP rate limiter (10 login/min, 5 signup/min, 3 reset/min).
- **Effort:** M

#### [MEDIUM] F27: Message sending has no rate limiting
- **Location:** `src/lib/messages/actions.ts:95-145`
- **Description:** `sendMessage` has no rate limiting or Turnstile (only `startConversation` has Turnstile). A user can flood another user's inbox.
- **Risk:** Harassment via message spam.
- **Recommendation:** Add per-user rate limiter (20 messages/min).
- **Effort:** S

#### [LOW] F28: Listing creation and offer submission have no rate limiting
- **Location:** `src/lib/listings/actions.ts:87-130`, `src/lib/offers/actions.ts:31-89`
- **Description:** Both have Turnstile but no rate limiting. Auth required, so lower risk.
- **Recommendation:** Add per-user rate limiters (5 listings/hour, 10 offers/hour).
- **Effort:** S

#### [LOW] F29: In-memory rate limiter resets on server restart
- **Location:** `src/lib/rate-limit.ts:31`
- **Description:** Uses in-memory `Map`. Deployments and crashes reset all counters.
- **Risk:** Brief post-restart window without rate limits. Acceptable for single-server.
- **Recommendation:** Acceptable at current scale. Migrate to Redis if scaling.
- **Effort:** N/A

#### Passing: 10 configured limiters covering payments, uploads, withdrawals, profile updates, data export, account deletion, newsletter, thumbnails, game search, BGG collection import. IP extraction correct for Traefik reverse proxy.

---

### 8. Environment Variable Exposure

#### Passing: All secrets (SERVICE_ROLE_KEY, EVERYPAY_API_SECRET, RESEND_API_KEY, UNISEND_PASSWORD, CRON_SECRET, TURNSTILE_SECRET_KEY) are NOT in `NEXT_PUBLIC_`. Zero client components reference server secrets. No `env` block in `next.config.mjs`. `.env` files in `.gitignore`. `validateEnv()` checks all required vars at startup.

---

### 9. CSRF Protection

Covered in Section 5 findings. Summary: 22/24 non-cron mutation routes protected via `requireBrowserOrigin()`. Server Actions use Next.js built-in origin checking. One gap: `/api/games/enrich-batch` (F20).

---

### 10. Dependency Vulnerabilities

#### [HIGH] F30: `fast-xml-parser` — entity expansion bypass (production dependency)
- **Package:** `fast-xml-parser >=5.0.0 <5.5.6` (direct dependency, used for BGG XML API)
- **Advisory:** GHSA-8gc5-j5rx-235r — numeric entity expansion bypasses all limits (incomplete fix for CVE-2026-26278)
- **Additional:** GHSA-jp2q-39xq-3w4g (moderate) — entity expansion limits bypassed when set to zero
- **Risk:** Malicious XML from BGG API (or MITM) could cause memory exhaustion via entity expansion.
- **Recommendation:** Update to `fast-xml-parser >=5.5.7`.
- **Effort:** S

#### [LOW] F31: Dev-only dependency vulnerabilities (3 packages)
- `flatted <=3.4.1` (via eslint) — prototype pollution via `parse()`
- `picomatch <2.3.2, >=4.0.0 <4.0.4` (via eslint-config-next) — ReDoS + method injection
- `brace-expansion <1.1.13, >=4.0.0 <5.0.5` (via eslint) — zero-step sequence DoS
- **Risk:** These are all in the ESLint toolchain (dev-only). Not present in production builds.
- **Recommendation:** Update ESLint dependencies when convenient. Not urgent.
- **Effort:** S

#### [LOW] F32: Caret `^` version pinning across all dependencies
- **Location:** `package.json`
- **Description:** All dependencies use caret ranges (e.g., `"next": "^16.2.1"`), allowing automatic minor version drift.
- **Risk:** Minor version updates could introduce regressions. Mitigated by `pnpm-lock.yaml`.
- **Recommendation:** Consider tilde `~` (patch-only) for production stability.
- **Effort:** S

---

### 11. GDPR & Data Privacy

#### [MEDIUM] F33: No cookie consent banner
- **Location:** Project-wide (confirmed absent)
- **Description:** No cookie consent component exists. The app uses Supabase auth cookies and Sentry tracking. Under GDPR/ePrivacy Directive, cookie consent is required for non-essential cookies in EU/EEA. All three target markets (LV, LT, EE) are EU member states.
- **Risk:** Regulatory non-compliance. Auth session cookies are exempt (strictly necessary), but Sentry tracking cookies require consent.
- **Recommendation:** Add cookie consent banner. Make Sentry conditional on consent.
- **Effort:** M

#### [LOW] F34: GDPR data export missing shelf items, offers, notifications
- **Location:** `src/lib/services/account.ts:116-194`
- **Description:** `gatherUserData()` omits shelf items, offers (made and received), notifications, and audit log entries. Under GDPR Article 15, users have the right to access all personal data.
- **Risk:** Incomplete Subject Access Request response.
- **Recommendation:** Add missing data types to export.
- **Effort:** S

#### [LOW] F35: Account deletion does not clean up offers, shelf items, notifications
- **Location:** `src/lib/services/account.ts:305-335`
- **Description:** Deletion cleans up listings, favorites, and photos but not shelf items, offers, or notifications. Orphaned records may contain personal context.
- **Risk:** Data retained beyond necessity (GDPR Article 5(1)(e) storage limitation).
- **Recommendation:** Add cleanup for shelf_items, active offers, and notifications.
- **Effort:** S

#### Passing: Account deletion implemented with eligibility checks, profile anonymization, storage cleanup, 7-year tax retention for financial records. GDPR data export exists with message redaction. Newsletter is explicit opt-in (no pre-checked boxes). EXIF stripping covered in F24.

---

### 12. Denial of Service Vectors

#### [MEDIUM] F36: Game search `%term%` defeats indexes on 170k-row table
- **Location:** `src/app/api/games/search/route.ts:20`, `src/app/[locale]/browse/page.tsx:103`
- **Description:** `.ilike('name', '%${q}%')` produces leading-wildcard LIKE queries that cause sequential scans. Game search is rate-limited (30/min) but browse page search is not (server component page load).
- **Risk:** Under load, concurrent search queries could saturate database CPU.
- **Recommendation:** Add `pg_trgm` GIN index: `CREATE INDEX idx_games_name_trgm ON games USING gin (name gin_trgm_ops)`.
- **Effort:** S

#### [LOW] F37: Messages loaded without pagination
- **Location:** `src/lib/messages/actions.ts:271-303`
- **Description:** `getMessages()` loads all messages for a conversation with no `.limit()`. Combined with no message send rate limiting (F27), a spammer could create expensive loads.
- **Recommendation:** Add cursor-based pagination (e.g., last 100 messages).
- **Effort:** M

#### [LOW] F38: Conversation list fetches all messages for preview
- **Location:** `src/lib/messages/actions.ts:206-211`
- **Description:** `getConversations()` fetches messages across all conversations with `.in()` and no limit, just to extract last message per conversation.
- **Recommendation:** Add `last_message_content` column to conversations (updated by trigger) or use `DISTINCT ON`.
- **Effort:** M

#### Passing: Browse pagination bounded (PAGE_SIZE=24 with `.range()`). Photo uploads bounded (10MB pre-check, 100-photo quota). BGG API protected (1s delay, exponential backoff, LRU cache, 30/min rate limit).

---

## Summary Table

| # | Severity | Finding | Location | Effort |
|---|----------|---------|----------|--------|
| F5 | CRITICAL | Users can self-promote to staff (is_staff writable) | `001_mvp_schema.sql:63` | S |
| F6 | CRITICAL | Orders UPDATE allows financial field manipulation | `001_mvp_schema.sql:215` | S |
| F12 | HIGH | Missing payment webhook — paid but no order | `payments/callback/route.ts:1` | M |
| F13 | HIGH | Payment callback no rate limit or IP allowlist | `payments/callback/route.ts:56` | S |
| F24 | HIGH | No EXIF stripping — GPS data in photos | `listings/photos/route.ts:125` | S |
| F30 | HIGH | fast-xml-parser entity expansion vulnerability | `package.json` | S |
| F1 | MEDIUM | HSTS missing preload | `next.config.mjs:20` | S |
| F2 | MEDIUM | Permissions-Policy missing payment | `next.config.mjs:19` | S |
| F7 | MEDIUM | expire_stale_reservations callable by anon | `017_reservation_timer.sql:12` | S |
| F8 | MEDIUM | reserve/unreserve callable by any user | `025_cart_checkout.sql:38` | S |
| F9 | MEDIUM | Listings UPDATE no column restrictions | `001_mvp_schema.sql:158` | M |
| F10 | MEDIUM | Turnstile graceful degradation bypass | `turnstile.ts:20` | S |
| F14 | MEDIUM | Cart callback missing order_reference check | `payments/callback/route.ts:410` | S |
| F15 | MEDIUM | Legacy callback token null bypass | `payments/callback/route.ts:125` | S |
| F16 | MEDIUM | Wallet debit failure silently continues | `payments/callback/route.ts:267` | S |
| F17 | MEDIUM | Cart wallet partial failure no rollback | `cart-wallet-pay/route.ts:179` | M |
| F20 | MEDIUM | enrich-batch missing CSRF + rate limit | `enrich-batch/route.ts:14` | S |
| F26 | MEDIUM | Login/registration no rate limiting | `auth/actions.ts:18` | M |
| F27 | MEDIUM | Message sending no rate limiting | `messages/actions.ts:95` | S |
| F33 | MEDIUM | No cookie consent banner (GDPR) | Project-wide | M |
| F36 | MEDIUM | Game search defeats indexes (170k rows) | `games/search/route.ts:20` | S |
| F3 | LOW | X-DNS-Prefetch-Control on | `next.config.mjs:21` | S |
| F4 | LOW | Permissions-Policy missing extras | `next.config.mjs:19` | S |
| F11 | LOW | Auction exposes highest_bidder_id UUID | `auctions/[id]/state/route.ts:24` | S |
| F18 | LOW | Callback token in URL query param | `payments/create/route.ts:202` | N/A |
| F19 | LOW | Wallet-only crash window no reconciliation | `wallet-pay/route.ts:1` | S |
| F21 | LOW | ilike wildcard chars not escaped | `games/search/route.ts:20` | S |
| F22 | LOW | Display name length not validated at signup | `auth/actions.ts:40` | S |
| F25 | LOW | Dispute photo bucket policies commented out | `022_disputes.sql:91` | S |
| F28 | LOW | Listing/offer creation no rate limiting | `listings/actions.ts:87` | S |
| F29 | LOW | In-memory rate limiter resets on restart | `rate-limit.ts:31` | N/A |
| F31 | LOW | Dev-only dependency vulnerabilities (3 pkgs) | `package.json` | S |
| F32 | LOW | Caret version pinning | `package.json` | S |
| F34 | LOW | GDPR export missing shelf/offers/notifications | `account.ts:116` | S |
| F35 | LOW | Account deletion missing shelf/offer cleanup | `account.ts:305` | S |
| F37 | LOW | Messages loaded without pagination | `messages/actions.ts:271` | M |
| F38 | LOW | Conversation list fetches all messages | `messages/actions.ts:206` | M |
| F23 | INFO | No Zod for server action validation | Project-wide | M |

---

## Recommended Fix Order

Prioritized by severity x effort. Fix the S-effort CRITICALs and HIGHs first — these are single-migration or single-file changes with outsized security impact.

### Immediate (this week)
1. **F5** — Add column restriction to `user_profiles` UPDATE policy (CRITICAL, S) — single migration
2. **F6** — Remove user-facing UPDATE policy on `orders` (CRITICAL, S) — single migration
3. **F7** — REVOKE execute on `expire_stale_reservations` (MEDIUM, S) — same migration
4. **F8** — REVOKE execute on `reserve_listings_atomic`/`unreserve_listings` (MEDIUM, S) — same migration
5. **F30** — Update `fast-xml-parser` to >=5.5.7 (HIGH, S) — `pnpm update`
6. **F24** — Add EXIF stripping with `sharp` (HIGH, S) — two file changes
7. **F13** — Add rate limiting to payment callback GET (HIGH, S) — one file change
8. **F15** — Fix legacy callback token null bypass (MEDIUM, S) — one line change

### Short-term (next 2 weeks)
9. **F14** — Add order_reference verification to cart callback (MEDIUM, S)
10. **F10** — Fail Turnstile on network errors instead of passing (MEDIUM, S)
11. **F16** — Add staff alerting for wallet debit failures (MEDIUM, S)
12. **F20** — Add CSRF + rate limiting to enrich-batch (MEDIUM, S)
13. **F27** — Add message send rate limiting (MEDIUM, S)
14. **F1** — Add HSTS preload (MEDIUM, S)
15. **F2** — Add payment to Permissions-Policy (MEDIUM, S)
16. **F9** — Restrict listings UPDATE columns (MEDIUM, M)

### Medium-term (next month)
17. **F12** — Implement payment reconciliation cron (HIGH, M)
18. **F26** — Add auth rate limiting (MEDIUM, M)
19. **F33** — Add cookie consent banner (MEDIUM, M)
20. **F17** — Cart wallet partial failure handling (MEDIUM, M)
21. **F36** — Add pg_trgm index for game search (MEDIUM, S)
22. **F34, F35** — Complete GDPR export and deletion coverage (LOW, S)
