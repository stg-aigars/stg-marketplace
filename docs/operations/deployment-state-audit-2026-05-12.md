# Deployment State Audit — 2026-05-12

> **Purpose:** snapshot of the gap between `feature/lifecycle-finale` (PR C in-flight) and production state, so reading this artifact answers "what would break if I deployed feature/lifecycle-finale to main today" without context-switching to dashboards.
>
> **Captured at:** 2026-05-12, after PR C commit 12 (`7d7b446`) landed locally on `feature/lifecycle-finale`. Origin branch ahead of `main` by 4 commits (9, 10, 11a, 11b, 12 stacked).
>
> **Scope:** production Supabase schema + migrations, Coolify env vars (user-verify), Coolify cron registrations (user-verify), deferred manual actions. Feeds commit 14's cutover runbook.

---

## 0. Bottom line

**What would break if `feature/lifecycle-finale` merged to main today and Coolify deployed it:**

1. **Migrations 108 + 109 would auto-apply** on deploy. Both are idempotent and additive (no destructive DDL). Safe.
2. **`ACCOUNTING_ENGINE_ENABLED` defaults to false** (per `env.ts:191`: `=== 'true'`); marketplace flows continue routing through the pre-PR-C legacy paths until staff sets the env var to `'true'`. **No production behavior change** from the merge alone.
3. **monthly-vat-close cron** (newly defined by commit 12) does NOT auto-register in Coolify — Coolify cron-job entries are dashboard-managed, not derived from code. **The cron route exists at `/api/cron/monthly-vat-close` after deploy, but it doesn't fire on a schedule until staff registers it.** Same gap as PR #296's monthly-depreciation; see §3 below.
4. **No env var changes required** for the merge itself. `ACCOUNTING_ENGINE_ENABLED` toggle is part of cutover stage 2/3, NOT part of merging the code.

**Deploy verdict:** **safe to merge any time;** marketplace flows unchanged; new cron route lives dormant until registered; engine stays gated by the OFF default flag.

---

## 1. Production schema state

**Source:** Supabase MCP `list_migrations` query against project `tfxqbtcdkzdwfgsivvet` (production), captured 2026-05-12.

**Last applied migration:** `20260512150340 seed_fixed_assets_it_2026_001` (corresponds to local `107_seed_fixed_assets_it_2026_001.sql`). Applied during the April 2026 backfill prep.

**Full applied list (95 migrations, sorted by version timestamp):**

| # | Version | Local filename match |
|---|---|---|
| 1-69 | 2026-03-16 … 2026-04-19 | Migrations 001-077 (MVP through seller_terms_acceptance) |
| 70 | 20260429072914 dsa_notices | 079_dsa_notices.sql |
| 71 | 20260429073833 seller_status | 080_seller_status.sql |
| 72 | 20260429074629 seller_trader_workflow | 081_seller_trader_workflow.sql |
| 73 | 20260429075626 orders_terms_version | 082_orders_terms_version.sql |
| 74 | 20260429092938 trader_signal_dismissal_sentinel | 083_trader_signal_dismissal_sentinel.sql |
| 75 | 20260429115858 audit_log_retention_class_add | 084_audit_log_retention_class_add.sql |
| 76 | 20260429141651 audit_log_retention_class_tighten | 085_audit_log_retention_class_tighten.sql |
| 77 | 20260429142813 orders_oss_evidence | 086_orders_oss_evidence.sql |
| 78 | 20260429153310 oss_submissions | 087_oss_submissions.sql |
| 79 | 20260429192201 audit_log_resource_index | 088_audit_log_resource_index.sql |
| 80 | 20260429195036 orders_refunded_at_index | 089_orders_refunded_at_index.sql |
| 81 | 20260430084316 login_activity | 090_login_activity.sql |
| 82 | 20260503150310 search_exact_match_priority | 091_search_exact_match_priority.sql |
| 83 | 20260506204716 search_extended_metadata | 092_search_extended_metadata.sql |
| 84 | 20260509071653 accounting_schema | 093_accounting_schema.sql |
| 85 | 20260509071721 accounting_triggers | 094_accounting_triggers.sql |
| 86 | 20260509071735 accounting_rls | 095_accounting_rls.sql |
| 87 | 20260509071828 accounting_seeds | 096_accounting_seeds.sql |
| 88 | 20260509094129 097_posting_engine_rpc | 097_posting_engine_rpc.sql |
| 89 | 20260509192053 period_status_trigger_generalization | 098_period_status_trigger_generalization.sql |
| 90 | 20260510082333 hardlock_atomic_rpc | 099_hardlock_atomic_rpc.sql |
| 91 | 20260510085141 enable_pg_trgm | 100_enable_pg_trgm.sql |
| 92 | 20260510085159 games_search_trigram_indexes | 101_games_search_trigram_indexes.sql |
| 93 | 20260510085224 search_games_by_name_trigram_rewrite | 102_search_games_by_name_trigram_rewrite.sql |
| 94 | 20260511085042 lifecycle_parent_rpcs | 103_lifecycle_parent_rpcs.sql |
| 95 | 20260511085126 lifecycle_choice2_signatures | 104_lifecycle_choice2_signatures.sql |
| 96 | 20260511085154 order_refund_rpc_body | 105_order_refund_rpc_body.sql |
| 97 | 20260511085240 completion_idempotency_guard_fix | 106_completion_idempotency_guard_fix.sql |
| 98 | 20260512150340 seed_fixed_assets_it_2026_001 | 107_seed_fixed_assets_it_2026_001.sql |

**Cross-check vs `supabase/migrations/` directory:** the full local set is 001 → 109. Migrations 001-107 are applied in production (verified by name match with prod's migration history). **Migrations 108 + 109 are NOT yet applied.**

---

## 2. feature/lifecycle-finale migrations NOT in production

**Two migrations local-only:**

| # | Filename | Shipped with | What it does | Idempotency / re-run safety |
|---|---|---|---|---|
| **108** | `108_cart_payment_rpc_body.sql` | PR C commit 9 (cart fulfillment wrap) | (a) `ALTER TABLE cart_checkout_groups ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ` — additive column; null-permissive. (b) `DROP FUNCTION IF EXISTS public.cart_complete_payment_with_event_atomic(uuid, uuid, jsonb, jsonb)` then `CREATE OR REPLACE FUNCTION ...` with the renamed param (`p_cart_group_id` instead of `p_payment_id`) + full body. | **Safe to re-run.** `ADD COLUMN IF NOT EXISTS` is idempotent. The function DROP + CREATE pattern is safe because: (i) the previous stub (migration 104) was never called in production (`ACCOUNTING_ENGINE_ENABLED=false` since PR A shipped — verified via `journal_entries` containing zero rows with `source_doc_type='cart_payment'`), (ii) CREATE OR REPLACE handles re-run. |
| **109** | `109_withdrawal_completion_rpc_body.sql` | PR C commit 10 (withdrawal completion wrap + C.4) | `DROP FUNCTION IF EXISTS public.wallet_withdrawal_complete_with_event_atomic(uuid, uuid, jsonb, jsonb)` then `CREATE OR REPLACE FUNCTION ...` with added `p_staff_notes text default null` parameter + full body. | **Safe to re-run.** Same DROP+CREATE pattern as 108; previous stub (also from migration 104) was never called in production. CREATE OR REPLACE handles re-run. |

**No destructive DDL.** No data migration. Both are RPC body fills + one additive column. Deploying these to prod produces no observable behavior change until the `ACCOUNTING_ENGINE_ENABLED` env var is set to `'true'` (which triggers the lifecycle wraps to call the new RPC bodies). Until then, the new RPCs sit unused in the database.

**Application order matters:** 108 must apply before 109 (no ordering dependency between them at the SQL level — both target different RPC functions — but Supabase's migration tracker applies in filename order; the order is naturally correct).

**No new migrations introduced by commits 11a / 11b / 12** — those commits were pure application code + tests + a CLAUDE.md doc update. No DDL changes.

---

## 3. Production env vars (Coolify — user-verify required)

**Method:** I cannot programmatically read Coolify env state from this environment. The list below is derived from `src/lib/env.ts` validation + `docs/dependencies.md` checklist. **Flagged items need user-verification via the Coolify dashboard.**

### Required env vars (from `src/lib/env.ts:69-79`)

These cause `assertEnv()` to throw if absent on any environment. Production must have all of them or the app won't boot:

| Var | Purpose | User-verify? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase connection (anon side) | Should be set (app boots in prod) — verify value matches `tfxqbtcdkzdwfgsivvet` URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Should be set; verify |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role for server-side writes | Should be set; **rotate after team membership changes** |
| `EVERYPAY_API_USERNAME`, `EVERYPAY_API_SECRET`, `EVERYPAY_API_URL`, `EVERYPAY_ACCOUNT_NAME` | EveryPay (Swedbank) payment | Should be set; verify in Coolify |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email | Should be set |
| `UNISEND_API_URL`, `UNISEND_USERNAME`, `UNISEND_PASSWORD` | Parcel locker shipping | Should be set |
| `NEXT_PUBLIC_APP_URL` | Public app origin (used for redirects, emails) | Should be `https://secondturn.games` |

### Required in production (from `src/lib/env.ts:81`)

| Var | Purpose | User-verify? |
|---|---|---|
| `CRON_SECRET` | Bearer-token auth for `/api/cron/*` routes | **Must be set in Coolify.** Verify value. If unset, all cron routes return 401 — cron jobs silently fail. |

### Optional / feature-disable-if-absent (from `src/lib/env.ts:82-99`)

| Var | Used by | Status to verify |
|---|---|---|
| `APP_ORIGIN` | CSRF check (CORS-equivalent for browser-origin enforcement) | Should be set in prod; verify matches `NEXT_PUBLIC_APP_URL` host |
| `RESEND_AUDIENCE_ID`, `RESEND_WEBHOOK_SECRET` | Newsletter audience + bounce webhook | Optional; verify if newsletter feature is active |
| `ADMIN_EMAIL` | Staff alert destinations | Verify |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile bot protection | Verify |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Sentry observability | Verify |
| `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_HOST` | PostHog analytics (cookieless mode) | Verify |
| `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` | Optional cache purge script | Verify |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Stable across deploys — rotating invalidates in-flight client bundles | **CRITICAL: must be set + stable.** Verify. |
| `NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED` | Facebook OAuth toggle | Verify |

### PR C-specific cutover env var (CRITICAL for this audit)

| Var | Purpose | Expected current value | When it changes |
|---|---|---|---|
| **`ACCOUNTING_ENGINE_ENABLED`** | Feature flag for PR C lifecycle integration | **`false` or unset** (defaults to OFF via `=== 'true'` strict equality) | Flipped to `'true'` during cutover stage 2 (production staff-only burn-in) per the round-3 brief §6(f) + commit 14's runbook. **User-verify in Coolify before merging PR C.** |

**If ACCOUNTING_ENGINE_ENABLED is unexpectedly `'true'` in prod today:** PR C wraps would activate immediately on deploy, posting C.1/C.2/C.4/etc. entries for live marketplace traffic. This would NOT be a destructive bug (entries land cleanly via the engine), but it would cutover ahead of schedule. **Verify the var's current value before merging.**

### User-verify checklist (Coolify dashboard)

- [ ] `ACCOUNTING_ENGINE_ENABLED` = `false` or unset (CRITICAL)
- [ ] `CRON_SECRET` is set and non-empty
- [ ] `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set and matches the value that was set at last deploy (rotation breaks in-flight client bundles)
- [ ] All "required" vars from §3.1 are set (sample check: `SUPABASE_SERVICE_ROLE_KEY`, `EVERYPAY_API_SECRET`, `RESEND_API_KEY`)

---

## 4. Production Coolify cron registrations (user-verify required)

**Method:** Coolify cron-job entries are dashboard-managed, not derived from code. **All entries below need user-verification.**

### Expected cron registrations per CLAUDE.md cron-route registry

| Cron name | Schedule | Coolify-registered? | Critical? |
|---|---|---|---|
| `expire-reservations` | every 5 min | **user-verify** | YES — listing-reservation timeout |
| `reconcile-payments` | every 5 min | **user-verify** | YES — orphaned cart group recovery |
| `auction-ending-soon` | every 5 min | **user-verify** | YES — auction notification |
| `end-auctions` | every 1 min | **user-verify** | YES — auction terminal transition |
| `cleanup-sessions` | every 10 min | **user-verify** | medium — orphan cart cleanup |
| `sync-tracking` | every 15 min | **user-verify** | YES — Unisend tracking sync |
| `auction-payment-deadline` | every 30 min | **user-verify** | YES — auction payment deadlines |
| `enforce-deadlines` | every 2 hours | **user-verify** | YES — order lifecycle deadlines (auto-decline, auto-cancel, auto-escalate) |
| `auto-complete` | every 6 hours | **user-verify** | YES — auto-complete delivered orders |
| `cleanup-photos` | every 6 hours | **user-verify** | medium — orphan listing-photo cleanup |
| `dac7-reconcile` | daily | **user-verify** | YES — DAC7 reconciliation + escalation |
| `trader-signals` | daily | **user-verify** | YES — trader signal detection |
| `verification-escalation` | daily | **user-verify** | YES — seller verification timeout |
| `cleanup-login-activity` | daily | **user-verify** | medium — GDPR 30-day retention on login_activity |
| `cleanup-notifications` | weekly | **user-verify** | low — notification table hygiene |
| `cleanup-audit-log` | weekly | **user-verify** | YES — operational audit-log 30-day retention |
| **`monthly-depreciation`** (PR #296) | **monthly day 1, 00:30 UTC, `30 0 1 * *`** | **⚠ user-verify** — the PR #296 smoke-test gap means this is unconfirmed | YES — P.6 depreciation entries for fixed assets |
| **`monthly-vat-close`** (PR C commit 12, **new with this merge**) | **monthly day 1, 01:00 UTC, `0 1 1 * *`** | **NEW — will need staff registration after PR C ships** | YES post-cutover — P.1 VAT consolidation for the previous month |

### Specifically the PR #296 + commit 12 question

**The smoke-test gap on PR #296** means we don't yet have confirmation that the `monthly-depreciation` Coolify cron job was registered in the dashboard. The first opportunity to verify was 2026-05-01 00:30 UTC (would have closed April 2026 by emitting the IT-2026-001 P.6 for April — month 4 of 36).

- **Was the April depreciation P.6 emitted by the cron?** Check via Supabase MCP `journal_entries` query: any row with `type_id='P.6'` AND `accounting_period='2026-04'` AND `posting_context->>'emission_source' = 'cron'`. If present: cron is registered + working. If absent: cron is NOT registered in Coolify; April depreciation was instead emitted by the April backfill script (Phase 0 chain handoff per the migration 107 + `phase0_entry_21` convention).
- **Recommended:** run this query before commit 14's runbook drafting:

```sql
SELECT type_id, source_doc_id, accounting_period, posting_context->>'emission_source' AS source
FROM journal_entries
WHERE type_id = 'P.6' AND accounting_period = '2026-04';
```

  If `source = 'cron'`: monthly-depreciation cron is operational; we have a reliable depreciation-cron precedent for commit 14's runbook to reference. If `source = 'backfill'` (or no rows): cron registration is still a deferred user-action.

### User-verify checklist (Coolify dashboard)

- [ ] `monthly-depreciation` cron job is registered with schedule `30 0 1 * *` and the canonical curl command
- [ ] If commit 12 merges to main and deploys: **register `monthly-vat-close`** with schedule `0 1 1 * *` and the canonical curl command. First fire expected 2026-06-01 01:00 UTC (closing May 2026).
- [ ] Other crons from the CLAUDE.md registry are all registered

---

## 5. Deferred manual actions queue

Items requiring user action, in roughly chronological order:

### Imminent (next 0-3 weeks)

1. **April 2026 PVN deklarācija filing — DEADLINE Wednesday 20 May 2026 (8 days from today).**
   - €0.30 net refund position
   - Output €0.38 → Line 52
   - Input €0.68 → Line 62
   - Foreign RC informational €0.40/€0.40 → Lines 56/57
   - OSS-EE €0.64 separate Q2 channel (deadline 31.07.2026 — NOT this filing)
   - **30 min via EDS portal.** User action.

2. **Verify monthly-depreciation cron in Coolify (smoke test gap from PR #296).**
   - Run the Supabase query in §4 to verify if April P.6 was emitted by cron or backfill.
   - If cron-emitted: confirm Coolify registration; no action needed.
   - If backfill-emitted (or no rows): register the cron in Coolify per CLAUDE.md schedule + curl command. **Target completion: before 1 June** (so the cron fires for May 2026 depreciation correctly).

3. **Push commit 12 from local to origin/feature/lifecycle-finale.**
   - Standard fast-forward push (1 commit ahead: `7d7b446`).
   - **NEW: agent-executed per the updated pushing-discipline carve-out.** Will execute after this audit lands.

### Medium-term (3-6 weeks)

4. **Accountant written sign-off paste — v1.4 completion-entry signoff.**
   - Verbal signoff received 2026-05-12 per CLAUDE.md "Accounting Module" section
   - Written confirmation in flight; paste to `docs/legal_audit/accountant-completion-entry-signoff.md` when received
   - User action

5. **May 2026 backfill timing — target run ~28-30 May (per memory `may_backfill_timing.md`).**
   - Held until end of May (transactions through 31.05 add to scope)
   - Backfill script runs ~1-3 June; PVN deklarācija filing by 20 June
   - **Operational note from commit 12:** stage May backfill BEFORE `monthly-vat-close` cron's first day-1 fire (2026-06-01 01:00 UTC). Backfill almost certainly wins the source_doc_id race; cron's day-2 idempotent_skip is the "production smoke test."

6. **PR C merge to main + monthly-vat-close cron registration in Coolify.**
   - After commits 9-14 land, integration test settles, and cutover stage 1 staging burn-in completes
   - **Target: ~31 May** for cron registration (so 2026-06-01 first fire happens automatically)
   - User action

### Cutover-window (4-5 weeks out)

7. **Cutover stage 1 — staging burn-in.** 24-48h with synthetic transactions covering all paths. Blocked on PR C completion + PR D (already merged at `655777a`). Target start: mid-late June.

8. **Cutover stage 2 — production staff-only.** `ACCOUNTING_ENGINE_ENABLED=true` in Coolify; gate on `orders.is_staff_test=true`. 24-72h burn-in. **User-executed env var change per shared-state-actions discipline.**

9. **Cutover stage 3 — production global.** Drop the `is_staff_test` gate. Monitor for 48h. **User-executed code change + deploy.**

10. **May 2026 PVN deklarācija filing — deadline 20 June 2026.** Numbers from May backfill output.

11. **Q2 OSS-EE filing — deadline 31 July 2026.** €0.64 from April + any May Q2 activity.

---

## 6. Cross-references

- **PR C in-flight:** `feature/lifecycle-finale` at `7d7b446` (commits 9, 10, 11a, 11b, 12). Remaining: 13 (integration tests), 14 (cutover runbook).
- **PR D merged:** `655777a` on main (period-close item 4 reconciliation gate).
- **Coolify cron registry source of truth:** CLAUDE.md "Cron Routes" section (line ~268).
- **Env var canonical list:** `src/lib/env.ts:69-99` (validation lists) + `docs/dependencies.md` (operational checklist).
- **Supabase project ID (prod):** `tfxqbtcdkzdwfgsivvet` per memory `supabase_project.md`.
- **Audit captured at commit:** `7d7b446` (commit 12 landed locally; not yet pushed at audit-capture time).

---

## 7. Capture metadata

- **Audited by:** Claude Code (PR C commit 12 implementation cycle)
- **Audit date:** 2026-05-12
- **Method:** Supabase MCP `list_migrations` for production schema; local `supabase/migrations/` directory listing for the diff; `src/lib/env.ts` static read for env-var canonical list; `docs/dependencies.md` for operational env checklist; CLAUDE.md "Cron Routes" section for the cron registry. Coolify env var values + cron registrations: NOT programmatically accessible from this environment — flagged as user-verify.
- **Tooling gap noted:** the agent has no Coolify API access. Future audits could close this by adding a Coolify-side env-var listing endpoint (operational risk: such an endpoint would surface secrets; probably not worth building). The user-verify checklist in §3 and §4 is the canonical workaround.
