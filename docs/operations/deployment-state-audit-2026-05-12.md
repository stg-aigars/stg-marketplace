# Deployment State Audit — 2026-05-12

> **Purpose:** snapshot of the gap between `feature/lifecycle-finale` (PR C in-flight) and production state, so reading this artifact answers "what would break if I deployed feature/lifecycle-finale to main today" without context-switching to dashboards.
>
> **Captured at:** 2026-05-12, after PR C commit 12 (`7d7b446`) landed locally on `feature/lifecycle-finale`. Origin branch ahead of `main` by 4 commits (9, 10, 11a, 11b, 12 stacked).
>
> **Scope:** production Supabase schema + migrations, Coolify env vars (user-verify), Coolify cron registrations (user-verify), deferred manual actions. Feeds commit 14's cutover runbook.

---

> **Superseded operational guidance:** the "deferred manual actions queue" in §5 below is **superseded by `lifecycle-cutover-runbook.md`** (added in PR C commit 14). The runbook is the canonical playbook for staff executing the cutover; this audit doc remains the canonical production-state snapshot at PR C in-flight. Read both: this doc answers "what's the production state?"; the runbook answers "how do I cut over?".

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
| **`ACCOUNTING_ENGINE_ENABLED`** | Feature flag for PR C lifecycle integration | **RESOLVED 2026-05-12:** var does NOT exist in Coolify (confirmed by user). `process.env.ACCOUNTING_ENGINE_ENABLED === 'true'` evaluates to `false`; engine is OFF. | Flipped to `'true'` during cutover stage 2 by adding the var to Coolify with value `'true'`. Until then, no Coolify-side action needed. |

**Resolution:** the var is unset in Coolify, which makes `env.accounting.engineEnabled === false`. PR C wraps remain dormant on deploy. No pre-merge action required.

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

**RESOLVED 2026-05-12 (smoke-test verified by user):**

- `monthly-depreciation` cron **IS registered** in Coolify with schedule `30 0 1 * *`.
- "Execute Now" smoke test ran the cron logic end-to-end against the current state (April 2026 already has 3 P.6 entries posted via Phase 0 chain: `phase0_entry_19/20/21` for Feb/Mar/Apr) — **no duplicate entry was posted** (defensive behavior verified).
- First scheduled fire: **2026-06-01 00:30 UTC**, closing May 2026 (will emit the first cron-source P.6 for IT-2026-001 month 4 of 36).

**Analytical note on the defensive behavior observed:** the user's smoke test confirmed no duplicate posted, but the protective mechanism is **NOT** an explicit period-level skip guard in `monthly-depreciation/route.ts` or `depreciation-logic.ts` (those files have only asset-level skip cases: disposed / before-start / fully-depreciated). The actual protection during "Execute Now" came from the engine's `enforce_period_status` trigger (migration 094) — period 2026-04 is hard-locked, so `insert_journal_entry` rejected the emit with a `check_violation` regardless of the source_doc_id mismatch. The cron returned `failed` for that asset; staff didn't see a duplicate row.

**Implication for commit 12's monthly-vat-close:** post-cutover periods will NOT all be hard-locked immediately. A retry against a still-open period with a different source_doc_id (e.g., a backfill emission used `phase0_entry_N` and a cron emission would use `close_YYYY_MM`) would BOTH succeed, producing two P.1 entries for the same period. The engine's idempotency UNIQUE is keyed on `(source_doc_type, source_doc_id, type_id)` and doesn't catch cross-source-doc-id collisions within the same period.

**Mitigation in commit 12:** monthly-vat-close adds an explicit cron-level period-skip guard (query `journal_entries WHERE accounting_period = target AND type_id = 'P.1'` before emit; skip with status `skipped_period_already_closed` if found). Layered idempotency: engine UNIQUE catches same-source_doc_id retries; cron-level skip catches different-source_doc_id-same-period scenarios. See route.ts comments for the rationale.

**Potential consistency followup (not commit 12 scope):** PR #296's monthly-depreciation cron could be retrofit with the same period-level skip guard. Today it relies on period hard-lock state to prevent duplicates — works for already-closed periods but not for fresh re-runs of an open period that already has a P.6 emission from a different source. Flag for post-cutover refactor; not urgent because:
  (a) depreciation P.6 source_doc_id is asset-specific (`depreciation_<asset_code>_<YYYY-MM>`), so backfill collisions would actually share the same source_doc_id if the backfill used the same convention — but backfill used `phase0_entry_N`, so the risk shape exists for depreciation too.
  (b) the operational cost of the gap is low (a duplicate P.6 is recoverable via reversal; doesn't break period close), and ;
  (c) post-cutover code-changes will more likely use the cron's convention, reducing collision risk going forward.

### User-verify checklist (Coolify dashboard)

- [x] `monthly-depreciation` cron job IS registered with schedule `30 0 1 * *` and the canonical curl command (verified 2026-05-12)
- [ ] If commit 12 merges to main and deploys: **register `monthly-vat-close`** with schedule `0 1 1 * *` and the canonical curl command. First fire expected 2026-06-01 01:00 UTC (closing May 2026).
- [ ] Other crons from the CLAUDE.md registry are all registered (still pending verification of the 16 other cron routes; the depreciation registration confirms the dashboard discipline is in place)

---

## 5. Deferred manual actions queue

Items requiring user action, in roughly chronological order:

### Imminent (next 0-3 weeks)

1. **April 2026 PVN deklarācija filing — DONE 2026-05-12 (8 days ahead of deadline).**
   - €0.30 net refund position submitted via EDS portal
   - **EDS document reference: 114368574**
   - Filed against April period 2026-04 (hard-locked, items 1-9 reconciled per PR D)

2. **monthly-depreciation cron — RESOLVED 2026-05-12 (smoke-test verified).**
   - Cron registered in Coolify with `30 0 1 * *` schedule
   - "Execute Now" smoke test passed: no duplicate entry posted (defensive behavior verified, even if the protective mechanism was the engine's hard-lock trigger rather than an explicit cron-level skip)
   - First scheduled fire: 2026-06-01 00:30 UTC (May depreciation)

3. **Push commit 12 from local to origin/feature/lifecycle-finale — DONE 2026-05-12.**
   - Origin advanced 24a2709 → a6e618d (commit 12 + this audit)
   - Standard fast-forward push, agent-executed per the updated pushing-discipline carve-out

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

- **PR C merged:** squash commit `9516640` on main (2026-05-13). 16 commits squashed; auto-deploy OOM'd — see §8.
- **PR #299 merged:** squash commit `b2cc71f` on main (2026-05-13). Build-off-VPS pipeline via GitHub Actions + GHCR pull. Resolved the OOM permanently — see §8.
- **PR D merged:** `655777a` on main (period-close item 4 reconciliation gate). Pre-PR-C-attempt baseline.
- **Coolify cron registry source of truth:** CLAUDE.md "Cron Routes" section (line ~268).
- **Env var canonical list:** `src/lib/env.ts:69-99` (validation lists) + `docs/dependencies.md` (operational checklist).
- **Supabase project ID (prod):** `tfxqbtcdkzdwfgsivvet` per memory `supabase_project.md`.
- **GHCR registry path:** `ghcr.io/stg-aigars/stg-marketplace:latest` (rolling) + per-SHA tags. Built by `.github/workflows/build-and-push.yml`.
- **Audit captured at commit:** `7d7b446` (commit 12 landed locally; not yet pushed at audit-capture time). §8 addendum captured at commit on `post-merge/audit-update-pr-c`.

---

## 7. Capture metadata

- **Audited by:** Claude Code (PR C commit 12 implementation cycle), addendum §8 added by Claude Code (PR C resolution cycle 2026-05-13)
- **Audit date:** 2026-05-12 (initial); 2026-05-13 (§8 addendum)
- **Method:** Supabase MCP `list_migrations` for production schema; local `supabase/migrations/` directory listing for the diff; `src/lib/env.ts` static read for env-var canonical list; `docs/dependencies.md` for operational env checklist; CLAUDE.md "Cron Routes" section for the cron registry.
- **Tooling gap closed in §8:** the original audit noted "agent has no Coolify API access." This was resolved on 2026-05-13 when the user created a Coolify API token (Settings → Keys & Tokens → API tokens) and Claude Code probed the `/api/v1/applications/<uuid>/scheduled-tasks` endpoint (undocumented in the public OpenAPI spec but functional). Future audits can programmatically inspect scheduled tasks, env vars, application states, and deployment history. User-verify checklist remains the canonical workaround for env var **values** (which the API surfaces only as references, not plaintext — by design).

---

## 8. PR C resolution (2026-05-13 addendum)

PR C merged to main on 2026-05-13 at squash commit `9516640`. What followed was a substantially more eventful sequence than the original cutover runbook anticipated. This section captures the resolution so future audits can reconstruct the state transitions.

### 8.1 Coolify auto-deploy OOM failure

Coolify's webhook-triggered auto-build of PR C started at 07:48 UTC on the Hetzner CX23 (2 vCPU / 4 GB RAM). The Next.js `pnpm build` step spawned two parallel node workers totaling ~1.9 GB resident memory. Combined with the existing marketplace container (~250 MB), Docker daemon (~500 MB), and Coolify control-plane containers (~500 MB), the VPS exceeded its 4 GB RAM ceiling. Memory cascaded into the 2 GB swap file; swap saturated; the kernel went into thrash state.

Observable symptoms at 08:15 UTC:
- Load average: 67.93 / 75.06 / 51.33 (1m/5m/15m) — unprecedented for this box
- RAM: 89 MB free of 3.7 GB, 37 MB available
- Swap: 8 KB free of 2 GB
- `docker ps -a` hung mid-output
- TCP connections to ports 80/443/8000 accepted at kernel level but received no application response

Cloudflare TLS terminations succeeded but the origin (`37.27.24.207`) timed out the HTTP layer. From an external observer, the marketplace was down.

**Root cause:** the VPS is sized to **run** the marketplace container, not to **build** it concurrently. Each major PR adds compile/type-check work; PR C's +10K LoC was the line that crossed the threshold.

### 8.2 Recovery — manual container start

`systemctl restart docker` (taking ~60s under the thrash state) broke the wedge. RAM returned to 917 MB used / 2.8 GB available; load dropped from 67 → 47 within minutes.

After the restart, the failed PR C build container was `Exited (143)` (SIGTERM from the Docker daemon restart). Critically, the **previous-good** container (image tag `dr6kcc91pkasqj9tlv068s5v:655777a28925b212226b4689e7914c61836b99fc` — PR D's main state) was also in Exited state but its image was still cached on disk. Direct `docker start <container_id>` brought it back up. Traefik (`coolify-proxy`) had stayed running throughout. Site went live again on PR-D state at 08:30 UTC.

**Key constraint added at this point:** Coolify dashboard "Auto Deploy on Webhook" toggle disabled for the marketplace app. Without this, Coolify would have retried the PR C build on its next cycle and OOM'd again.

### 8.3 Strategic decision — build off-VPS

The OOM was reproducible. Three options were considered:

| Option | Setup cost | Coverage |
|---|---|---|
| Upgrade Hetzner CX23 → CX31 (8 GB) | 15 min, +€4/mo | Buys ~6 months; same problem recurs at next big PR |
| Move Docker build to GitHub Actions (~7 GB runners) + Coolify pulls from GHCR | 1.5–2.5 hrs one-time | Permanent — VPS no longer builds anything |
| Optimize build config (NODE_OPTIONS heap limits, etc.) | Unknown | Brittle |

**Decision: build off-VPS.** The Dockerfile was already multi-stage with a lean runner stage — well-suited to off-VPS building with the runner just pulling pre-built artifacts.

### 8.4 PR #299 ship — build-and-push pipeline

Changes:
- `Dockerfile`: 19 `ARG` declarations added to the builder stage (mirroring `src/lib/env.ts:validateEnv` required vars), each promoted to `ENV` so `pnpm build` sees them as `process.env`. Runner stage unchanged — no build secrets propagate to the final layer because ARG/ENV don't cross `FROM` boundaries.
- `.github/workflows/build-and-push.yml`: new workflow. Builds on PR (smoke test, no push) and push to main (build + push to GHCR tagged with both commit SHA and `:latest`). Uses GHA layer cache, `linux/amd64`, `GITHUB_TOKEN` for GHCR auth.
- **19 GitHub repository secrets added** by user (Settings → Secrets → Actions) mirroring Coolify's env vars. List matches `env.ts` required + optional sets.

PR #299 merged at squash commit `b2cc71f` (2026-05-13 ~09:15 UTC). Post-merge GHA build succeeded in 3m 23s and pushed `ghcr.io/stg-aigars/stg-marketplace:b2cc71ff4ec1352d3030f719f7a25338a963a3f6` + `:latest`.

### 8.5 Coolify application migration

Coolify v4-beta.473 does not allow converting an existing git-sourced application to "Docker Image" type in-place. A new application was created in the same project/environment:

- Type: **Docker Image**
- Image: `ghcr.io/stg-aigars/stg-marketplace`
- Tag: `latest`
- Ports Exposes: `3000` (matches Dockerfile `EXPOSE 3000`)
- Domain (after swap): `https://secondturn.games,https://www.secondturn.games`

Auth: `docker login ghcr.io -u stg-aigars` run once on the VPS (credential cached at `/root/.docker/config.json` — Coolify auto-uses for pulls). PAT scope: `read:packages` only.

**Old application state:** stopped, retained as hot standby for instant rollback. Will be deleted after 24h of stable operation on the new app.

Application UUIDs:
- **NEW (live):** `h5craypnckp5yt8v1cwcvi3r` (`docker-image-h5craypnckp5yt8v1cwcvi3r`)
- **OLD (stopped):** `dr6kcc91pkasqj9tlv068s5v` (`stg-aigars/stg-marketplace:main-dr6kcc91pkasqj9tlv068s5v`)

### 8.6 Scheduled tasks migration via Coolify API

The new application started with zero scheduled tasks. The old application had 18, configured in the Coolify dashboard.

**Tooling discovery:** Coolify v4 exposes `/api/v1/applications/<uuid>/scheduled-tasks` (GET + POST) despite the endpoint not appearing in the public OpenAPI spec. Authentication via Bearer token (Keys & Tokens → API tokens, scope `root`). The API returns full task definitions (name, command, frequency, container, enabled, timeout) and accepts POST with the same shape.

All 18 tasks migrated via a Python script (parallel POSTs, each 201 Created), plus the new **`monthly-vat-close`** cron introduced by PR C. Total tasks on new app: **19** (18 enabled + 1 disabled `expire-offers` retained for parity).

This is the first time the Coolify API has been used in operational work for this project. **Tooling gap from §7 closed.** Future operational work (env var inspection, deploy triggers, application state queries) can use this same token.

### 8.7 Migrations 108–111 applied

After PR C deployment was confirmed live (`curl https://secondturn.games/api/health → 200`), the four database migrations introduced by PR C were applied via Supabase MCP `apply_migration` against project `tfxqbtcdkzdwfgsivvet`:

| Local file | Supabase version | Purpose |
|---|---|---|
| `108_cart_payment_rpc_body.sql` | `20260513105451_cart_payment_rpc_body` | Body for `cart_complete_payment_with_event_atomic` + `cart_checkout_groups.paid_at` column |
| `109_withdrawal_completion_rpc_body.sql` | `20260513105510_withdrawal_completion_rpc_body` | Body for `wallet_withdrawal_complete_with_event_atomic` |
| `110_is_staff_test_cart_withdrawal.sql` | `20260513105525_is_staff_test_cart_withdrawal` | `is_staff_test` column on `cart_checkout_groups` + `withdrawal_requests` |
| `111_refund_idempotency_guard.sql` | `20260513105538_refund_idempotency_guard` | Adds early-return idempotency guard to `order_refund_with_event_atomic` |

**Note on naming drift:** Supabase MCP stores migrations with its own timestamp prefix and the descriptive name only — the local `108_` / `109_` etc. numeric prefixes are not preserved. Mapping for future audits: match by name + temporal order.

**Verification:**
- `cart_checkout_groups.is_staff_test`: boolean NOT NULL default false ✓
- `cart_checkout_groups.paid_at`: timestamptz nullable ✓
- `withdrawal_requests.is_staff_test`: boolean NOT NULL default false ✓
- All 4 parent RPCs present with substantial bodies (1321–2847 chars each, no longer NOT_IMPLEMENTED stubs)

**Safety property:** the migrations were applied while the deployed PR C code was running, but `ACCOUNTING_ENGINE_ENABLED` was still unset (defaults false), so no code path exercised the new RPCs or columns at runtime. The schema-code drift window was zero.

### 8.8 Final state after resolution

- **Site:** live on PR C (`9516640`) via the new Docker Image application
- **Build pipeline:** GitHub Actions → GHCR → Coolify pull. VPS no longer builds; OOM risk permanently removed regardless of future project growth.
- **Database:** migrations 108–111 applied; schema in lockstep with deployed code
- **Crons:** 19 scheduled tasks running on the new app, including the new `monthly-vat-close` (first scheduled fire: 2026-06-01 01:00 UTC, closing May 2026)
- **Engine state:** `ACCOUNTING_ENGINE_ENABLED` still unset; all flag-gated paths take the byte-identical legacy route. Stage 1 cutover burn-in still pending (no schedule change).
- **Old app:** stopped, retained as hot standby. **Delete after 2026-05-14** if no rollback needed.

### 8.9 Operational implications going forward

- **Future deploys:** push to main → GHA builds + pushes to GHCR (~3 min, automatic) → manual click "Redeploy" in Coolify for the new app → Coolify pulls + runs (~30 s). The auto-deploy webhook to Coolify is no longer wired; the manual click is intentional discipline until/unless we wire a `workflow_run` → Coolify webhook.
- **Rollback:** every image is tagged with its commit SHA in GHCR. To roll back, change the Coolify app's image tag from `latest` to a previous SHA (e.g., `b2cc71ff4ec1352d3030f719f7a25338a963a3f6`) and redeploy. Old image is cached locally on the VPS so rollback is ~10 seconds.
- **Cron management:** Coolify API now usable for bulk operations. Token stored in user's password manager, IP allowlist set to user's current public IP.
- **VPS sizing:** CX23 (€3.49/mo) stays viable indefinitely. No upgrade pressure from build memory.

### 8.10 Deferred from §5 — status updates

- Item 6 ("PR C merge to main + monthly-vat-close cron registration"): **DONE** (this section).
- Item 7 ("Cutover stage 1 — staging burn-in"): still pending, original schedule (~mid-late June).
- Items 8–9 (stages 2–3): still pending, original schedule.
- Item 10 (May 2026 PVN deklarācija filing — deadline 20 June): unchanged, depends on May backfill output.
- Items 1–5 (April filing, depreciation cron, commit 12 push, accountant sign-off, May backfill timing): unchanged from §5.

New deferred items from §8:
- **Delete old Coolify app `dr6kcc91pkasqj9tlv068s5v`** after 24h stability (target ~2026-05-14).
- **Rotate Coolify API token `claude-automation`** annually (current creation date 2026-05-13).
- **Rotate GHCR PAT `coolify-ghcr-pull`** annually (current creation date 2026-05-13, expires 2027-05-13).
