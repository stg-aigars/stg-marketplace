# Lifecycle Cutover Runbook

> **Purpose:** the operational playbook for converting "PR C merged to main" → "accounting engine active in production." This is not descriptive documentation; it is the gate that prevents partial activations and orphaned states.
>
> **Audience:** staff executing the cutover. Print or open separately during execution.
>
> **Companion artifact:** `deployment-state-audit-2026-05-12.md` (production state snapshot at PR C in-flight). This runbook supersedes the audit doc's "deferred manual actions queue" with explicit sequencing.

---

## 0. Bottom line / TL;DR

Cutover converts the accounting engine from **off by default** to **on for all marketplace flows** in three sequenced stages, each with explicit gates:

- **Stage 1** — Staging burn-in (2 days). Verify the wraps against synthetic transactions.
- **Stage 2** — Production staff-only burn-in (3 days). Engine ON in production; real GL entries land but only for `orders.is_staff_test=true`.
- **Stage 3** — Production global flip. Wraps unconditionally write GL; all marketplace flows post.

Rollback is a single env var flip (`ACCOUNTING_ENGINE_ENABLED=false`); GL entries written before the flip are immutable and stay in place. The first real period close runs as a cron-driven event on day 1 of the month following stage 3.

---

## 0.5 How to use this runbook

This runbook is **operational during cutover, not descriptive after.** Follow these conventions while executing:

- **Open separately** during execution — don't read in a browser tab buried under dashboards. Print or pin in a dedicated window.
- **Check off each step as completed.** Use the "actual" column in Appendix A and the inline checkboxes in stages §2–§4 to record what was done and when.
- **Halt on verification failure.** Each stage and each gate has a verification step; if any verification fails, stop and triage before proceeding. Do not proceed-and-fix-later — the runbook's value is that it prevents that pattern.
- **Log decisions in Appendix A.** Date slippage, rollback events, and decision rationale all belong in Appendix A's "actual" column. This is the canonical audit trail for what happened during cutover.
- **Read §5 rollback playbook BEFORE stage 2 begins.** Rollback decisions during stage 3 happen under pressure; rehearsing the decision tree once before is cheaper than rehearsing it under a Sentry firehose.

---

## 1. Pre-cutover gates

All nine gates must be **TRUE** before stage 1 begins. Verification command or artifact per gate. If any gate is false, halt and resolve.

### Gate 1 — PR C merged to main; Coolify auto-deploy completed

**Verify:** `git log main --oneline | head -3` shows the commit 14 SHA at HEAD; Coolify dashboard shows the deploy completed with green status.

### Gate 2 — Migrations 108, 109 applied to production

**Verify:** Supabase MCP `list_migrations` query against project `tfxqbtcdkzdwfgsivvet`; last applied migration ≥ `109_withdrawal_completion_rpc_body`. Cross-reference `deployment-state-audit-2026-05-12.md §1` for the canonical list shape.

### Gate 3 — `ACCOUNTING_ENGINE_ENABLED` confirmed unset or `false` in Coolify

**Verify:** Coolify dashboard → Project → Environment Variables. Either the var is absent OR set to `false`. Anything else (including `true`) means the engine is already active and stage 2 cannot be cleanly entered. **Halt if not OFF.**

### Gate 4 — `pnpm test:integration` green on main HEAD

**Verify:** local clone of main; run `pnpm test:integration`. Expected: **130/130 pass**. Failure here means a regression slipped past PR review; halt and triage.

### Gate 5 — `monthly-depreciation` cron registered in Coolify

**Verify:** Coolify dashboard → Cron Jobs. Entry named `monthly-depreciation` with schedule `30 0 1 * *`. Already registered (smoke-tested 12 May 2026); reconfirm presence.

### Gate 6 — `monthly-vat-close` cron registered in Coolify (NEW for commit 14)

**Verify:** Coolify dashboard → Cron Jobs. Entry named `monthly-vat-close` with schedule `0 1 1 * *`. See §6 for the registration playbook + smoke test. Capture screenshot evidence (mirrors the `monthly-depreciation` evidence pattern).

### Gate 7 — May 2026 backfill executed; trial balance reconciles for May

**Verify:** running the May backfill script wrote `phase0_entry_N`-style entries for May 2026 historical transactions (including May's P.1 close); the trial balance view shows non-zero May activity with balanced sums. `BANK_WALK_CHECKPOINTS` extended for May 2026 (manual constant edit during backfill prep). Cross-reference `may_backfill_timing` memory + the backfill PR.

### Gate 8 — Period 2026-04 hard-locked

**Verify:** `SELECT status FROM periods WHERE period_key = '2026-04' AND period_type = 'month'` returns `hard_locked`. April was hard-locked during PR D verification on 12 May; reconfirm before cutover.

### Gate 9 — `is_staff_test` wrap-layer gating fix landed

**Verify:** grep `is_staff_test` in `src/lib/accounting/lifecycle-wraps.ts` and `src/lib/accounting/posting-engine.ts`; expect at least one read of `orders.is_staff_test` in a wrap or parent RPC, plus propagation to `posting_context.is_staff_test`. **Pre-runbook state: this fix is NOT landed.** Migration 103 declares the column with the documented gating intent, but no application code reads it. The fix is queued as a follow-up commit on `feature/lifecycle-finale` after commit 14, before stage 2 entry. **Halt if not landed before stage 2.**

---

## 2. Stage 1 — Staging burn-in (2 days)

**Purpose:** verify the wraps against synthetic transactions in a non-production environment. The engine writes GL entries to a staging Supabase project; production state is untouched.

**Duration target:** 48h. Hard cap: 72h.

### Entry checklist

- [ ] All nine pre-cutover gates (§1) verified `TRUE`.
- [ ] Staging Supabase project pointed at by the staging deployment; service-role key configured.
- [ ] `ACCOUNTING_ENGINE_ENABLED=true` set in **staging only**.
- [ ] Test period selected (e.g., 2026-06 if running stage 1 in early June); period exists with status `open`.

### Synthetic transactions to exercise

Cover each commit-13 integration scenario via synthetic staff actions on staging. Each variant should produce at least one successful transaction:

- [ ] **Scenario 1** — LV-LV card cart → completion → wallet credit → withdrawal (O.1 happy path)
- [ ] **Scenario 2** — EE-EE PIS cart → completion (O.5 OSS, exercises `consumption_ms` fix)
- [ ] **Scenario 2b** — LT-LT PIS cart → completion (O.3 OSS)
- [ ] **Scenario 11** — Buyer-wallet + card hybrid cart (3-line C.1)
- [ ] **Scenario 13** — C.3 EveryPay settlement via `/staff/accounting/everypay-settlement`
- [ ] **Scenario 3** — Refund full same-period (O.7 + C.5)
- [ ] **Specifically: O.2 reverse-charge variant** — LT B2B `vat_registered` VIES-verified seller; cart + completion → O.2 with no VAT line. (Accountant's explicit ask during v1.3 sign-off.)
- [ ] **Scenario 12** — Partial fulfillment with paired C.9 cash leg. **Note:** scenario 12 has unit coverage only; stage 1 is the first end-to-end exercise.

### Verification per transaction

- Query `journal_entries` for the new entry: expected `type_id`, `accounting_period`, `posting_context.emission_source`.
- Query `journal_lines` for the entry: expected account codes + debit/credit shape per CLAUDE.md "Accounting Module" → O.x descriptions.
- Trial balance view (`/staff/accounting/trial-balance?period=YYYY-MM`) shows the entry's contribution.

### Period close

- [ ] Run `/staff/accounting/period-close?period=YYYY-MM` against the burn-in period.
- [ ] All 9 checklist items return `pass` (items 2 + 7 return `not_applicable` against TEST_PERIOD — they're external-state-dependent and have no real bank/settlement data to match; this is expected, not a failure).
- [ ] Soft-lock transition via staff UI succeeds.
- [ ] Hard-lock transition via staff UI succeeds.

### Exit criteria

1. All synthetic variants in the list above completed successfully.
2. Each transaction's GL shape matches expected (no `unattributed_gl_cents` anomalies).
3. Period close: items 1, 3, 4, 5, 6, 8, 9 all `pass`; items 2 + 7 `not_applicable` (acceptable).
4. Soft-lock → hard-lock cycle completed without errors.
5. Zero Sentry events from `accounting.*` namespace during the burn-in window.

### Halt criteria

- Any wrap throws `PostingValidationError[missing_required_key]` (would indicate a payload-shape gap analogous to consumption_ms).
- Any wrap throws `PostingComplianceGateError` for a seller that should not be blocked.
- Trial balance shows non-zero `unattributed_gl_cents` (indicates a counterparty resolution gap).
- Checklist item 4 (suspense 5590) returns `fail` after all completions ran (indicates O.x emit gap or PR D predicate bug).
- Any `check_violation` 23514 from a deferred-balance or period-status trigger (indicates engine bug).

If any halt criterion fires, stop stage 1 and triage. Do not proceed to stage 2.

---

## 3. Stage 2 — Production staff-only burn-in (3 days)

**Purpose:** verify the wraps against real production state (real users, real counterparties, real Coolify Supabase) while gating GL emission to `orders.is_staff_test=true` rows. Real customer orders continue to bypass the engine; staff test orders go through the full pipeline.

**Duration target:** 72h. Hard cap: 96h. **Minimum 24h since last new variant exercised with zero `accounting.*` Sentry events** before proceeding to stage 3.

### Entry checklist

- [ ] Stage 1 exit criteria all met.
- [ ] **Gate 9** (is_staff_test wrap fix) confirmed landed in production HEAD.
- [ ] Set `ACCOUNTING_ENGINE_ENABLED=true` in Coolify production environment.
- [ ] Deploy / restart so the new env var is picked up.
- [ ] Verify the env var via Coolify dashboard.
- [ ] Confirm at least one staff user has `isStaff=true` in their `user_profiles` row.

### GL entry filtering convention

Stage 2 writes real `journal_entries` rows. To distinguish them from real customer GL in dashboard / reporting views, the entries are tagged via TWO mechanisms:

- **`posting_context.is_staff_test = true`** — set by the wrap when `orders.is_staff_test=true` (per Gate 9's fix). This is the **primary discriminator** for stage 2 entries.
- **`posting_context.test_artifact = true`** — set by integration test runners (not stage 2). Documented in CLAUDE.md "Accounting Module → Test artifact convention."

**PR #4 trial-balance / P&L views must filter on BOTH tags** (separate toggles or a combined "exclude non-production-traffic" filter). They are distinct concepts:

| Tag | Source | Stage 2 entries have it? | Integration test entries have it? |
|---|---|---|---|
| `posting_context.is_staff_test=true` | Wrap reads `orders.is_staff_test` | Yes | No |
| `posting_context.test_artifact=true` | Set by integration test setup | No | Yes |

After stage 3 cutover, `orders.is_staff_test=true` orders still exist (audit / future test reproducibility) and continue to set `is_staff_test=true` on emitted entries; reports should keep filtering them out indefinitely.

### Staff test transactions (7 variants required)

Staff places real orders via the production UI with `is_staff_test=true` set on the orders row. Each variant requires at least one successful staff test order:

- [ ] **LV-LV card cart + completion + withdrawal** (O.1 path)
- [ ] **EE-EE card cart + completion** (O.5 OSS; **specifically validates the consumption_ms fix in production**)
- [ ] **LT-LT card cart + completion** (O.3 OSS)
- [ ] **Cross-country B2B with VAT-registered seller** (O.2 or O.4 RC path; uses a synthetic counterparty with `vat_registered` tax_status + valid `vies_verified_at` — staff sets manually for the burn-in)
- [ ] **Refund flow same-period** (O.7 + C.5)
- [ ] **Partial fulfillment cart** (paired C.9; staff seeds a listing as unavailable mid-fulfillment to exercise the branch)
- [ ] **Buyer-wallet contribution cart** (3-line C.1; staff funds a buyer wallet, then makes a hybrid card+wallet purchase)

### Per-variant verification

After each variant completes:

1. **Trial balance check** — `/staff/accounting/trial-balance?period=YYYY-MM`; entry's contribution visible with expected magnitude.
2. **Journal entry shape** — query `journal_entries WHERE source_doc_id = <order_id>`; verify `type_id`, `posting_context.is_staff_test=true`, `posting_context.emission_source='lifecycle'` (or `'staff_manual'` for C.3).
3. **Wallet integrity** (after each completion + withdrawal pair) — `/staff/accounting/wallet-integrity`; `is_reconciled` per Shape-2 invariant (`delta === in_flight`).
4. **Period close checklist** — items 1, 3, 4, 5, 6, 9 return `pass`; items 2 + 7 + 8 may return `not_applicable` against the stage-2 test period until real Swedbank + EveryPay reference data accrues. Item 8 will return `not_applicable` until first cron fire.

### Monitoring during stage 2

- **Sentry** — accounting-namespace events investigated within 1 hour of fire. Zero unexpected events during the 24h pre-exit quiet window.
- **audit_log** — daily review of `accounting.posted` rows; volume should match staff test transaction count.
- **PostHog** — `accounting.orphan_emit_skipped` events should be zero during stage 2 (all staff test orders have cart C.1/C.2 antecedents by construction).

### Exit criteria

1. All 7 variants exercised with at least one successful transaction each.
2. Each variant's verification (1–4 above) passed.
3. **24h since last new variant completed with zero `accounting.*` Sentry events.**
4. Period close run against stage-2 test period: items 1, 3, 4, 5, 6, 9 all `pass`.

### Halt criteria

- Any signal class A–D from §5 rollback decision tree fires. Halt stage 2 + rollback (flag OFF) + triage.
- Variant fails to complete after debugging attempt; root-cause analysis required before stage 3.
- Wallet integrity Shape-2 invariant breached (delta ≠ in_flight when withdrawal is in-flight).

---

## 4. Stage 3 — Production global flip

**Purpose:** make GL emission unconditional. All marketplace flows post to GL automatically.

**Sequencing:** stage 3 entry requires a code edit — removing the `orders.is_staff_test` gate from the wrap call sites (or, simpler if Gate 9's fix is structured this way: removing the gate's `false` branch). This is a small code change committed on a stage-3 branch, merged to main, Coolify auto-deploys.

### Entry checklist

- [ ] Stage 2 exit criteria all met.
- [ ] Code edit landed: wrap call sites no longer gate on `orders.is_staff_test`.
- [ ] Coolify deploy completed; HEAD reflects the gate removal.
- [ ] Manual smoke test: place a real (non-staff-test) order via the production UI; verify the GL entry lands with `posting_context.is_staff_test=false`.

### Monitoring cadence

**Aggressive monitoring window: 7 days post-flip.**
- Sentry alerts active; investigate every `accounting.*` event within 1 hour.
- Daily audit_log review: `SELECT count(*) FROM audit_log WHERE action='accounting.posted' AND created_at >= NOW() - INTERVAL '24 hours'` should match the day's order-completion volume.
- Daily trial balance spot-check.
- Daily wallet-integrity check: `is_reconciled=true` (Shape-2 invariant satisfied).

**Standard monitoring window: 23 days following (total 30-day window).**
- Sentry alerts active; investigate within 24 hours.
- Weekly audit_log review.
- Weekly trial balance + wallet integrity check.

**Beyond day 30:** cutover-as-operational-concern ends. Accounting issues route through standard ops channels with standard severity.

### Exit criteria (end of cutover)

- 7-day aggressive window completed with no rollback events.
- 30-day standard window completed.
- First post-cutover period close ran cleanly via the `monthly-vat-close` cron (see §7 calendar).
- All 9 checklist items returned `pass` for at least one full period close cycle against real production state.

---

## 5. Rollback playbook

### Rollback procedure

1. **Set `ACCOUNTING_ENGINE_ENABLED=false`** in Coolify production environment.
2. Trigger redeploy / restart so the new env var is picked up.
3. Verify the env var via Coolify dashboard.
4. Verify rollback worked: place a real order; check `journal_entries`; expect **no new entry** for that order's source_doc_id.

After rollback:
- Marketplace flows revert to byte-identical pre-PR-C paths (legacy `creditWallet`, legacy `fulfillCartPayment` etc.).
- Wallet table is source of truth for marketplace operations regardless of GL state.
- Buyer and seller experience: unchanged. Wallet balances, order statuses, refunds all continue.

### What persists after rollback

- **GL entries posted during the active window are IMMUTABLE.** No rollback of GL state via the engine itself.
- The `journal_entries` and `journal_lines` rows written during stage 2 + the active portion of stage 3 stay in place.
- `wallet_credited_at`, `paid_at`, `completed_at` columns set by parent RPCs during the active window also persist.

### How to correct GL state after rollback

Reversal entries are the only mechanism. Today, **the reversal-entry staff UI is not yet built** (queued as PR #4b scope per §8). Interim mitigation during cutover-window rollback:

- Engineering-time RPC calls: construct a reversal `PostingEvent` matching the original entry's shape, set `reverses_entry_id = <original_id>`, emit via `engine.emit()`.
- Document the SQL/RPC pattern below for ad-hoc use.
- Treat reversal-entry construction as a Sentry-paged engineering activity, not a staff routine.

```sql
-- Reversal-entry pattern (engineering-time, until UI ships)
-- Example: reverse an O.1 entry that landed under stage 3 with the wrong VAT routing.
--
-- 1. Identify the original entry
SELECT id, type_id, source_doc_id, accounting_period
  FROM journal_entries
  WHERE source_doc_id = '<order_id>' AND type_id = 'O.1';

-- 2. Build a reversing event in TypeScript via engine.emit() with:
--    - source_doc_type: 'order'
--    - source_doc_id: '<order_id>'
--    - type_id: 'O.7' (or appropriate reversal type)
--    - reverses_entry_id: <original_id>
--    - lines: flipped debit/credit from original
--
-- 3. Period state: if original's accounting_period is now soft_locked,
--    the reversal needs period_close_adjustment=true (set by authorised
--    role at application layer).
```

### Rollback decision tree

User decides. Runbook surfaces concrete signals + thresholds. Default action per class indicates urgency, not commitment.

| Class | Signal | Threshold | Default action |
|---|---|---|---|
| **A** | GL invariant breach | Any single occurrence: `check_violation` 23514, balance trigger fails at COMMIT, period state inconsistency | **Immediate rollback** (no waiting period). GL integrity is non-negotiable. |
| **B** | KYC/compliance gate misfire | `PostingComplianceGateError` rate > 1/hour sustained 2h, OR any false-positive blocking a legitimate seller | **Rollback within 4h** while investigating. |
| **C** | Missing-key / shape validation | `PostingValidationError[missing_required_key]` ANY occurrence (consumption_ms gap was the precedent; another would indicate similar payload-shape gap) | **Rollback within 1h.** |
| **D** | Idempotency anomaly | Same `(source_doc_type, source_doc_id, type_id)` triple producing two `journal_entries` rows (engine UNIQUE breach) | **Immediate rollback.** Engine UNIQUE is a hard invariant. |
| **E** | audit_log volume drift | `accounting.posted` count < 90% of expected for traffic, sustained 24h | **Investigate first.** Rollback if cause is engine-side. |
| **F** | Wallet integrity drift | `getWalletIntegrity().is_reconciled = false` AND offset ≠ in-flight (Shape-2 invariant breached) | **Investigate within 4h.** Rollback if engine-caused. |
| **G** | User-reported anomaly | Seller can't withdraw, wallet balance wrong, order completes without GL entry | **Triage within 2h.** Rollback decision based on root-cause analysis. |

### After rollback: next steps

- Capture the triggering signal in Appendix A's "actual" column with the date, class, and decision rationale.
- Open a follow-up issue or branch for the root-cause fix.
- Re-attempt cutover (back to stage 2 entry, or stage 3 entry if fix is small) only after the issue is resolved and tested.
- Engine OFF state during the recovery window is fine — marketplace flows continue legacy paths.

---

## 6. Cron registration playbook (`monthly-vat-close`)

Mirrors the `monthly-depreciation` registration pattern (PR #296). Capture screenshot evidence.

### Coolify dashboard steps

1. Navigate to: **Project → stg-marketplace → Cron Jobs → Add Cron Job**.
2. **Name:** `monthly-vat-close`.
3. **Schedule:** `0 1 1 * *`
   - At 01:00 UTC on day 1 of every month.
   - Note: 30-min offset from `monthly-depreciation`'s `30 0 1 * *` per CLAUDE.md "Cron Routes" registry — prevents simultaneous engine RPC contention on day 1.
4. **Command:**
   ```bash
   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/monthly-vat-close
   ```
5. **Environment:** verify `CRON_SECRET` is already set in Coolify (shared across cron routes).
6. **Save.** Capture dashboard screenshot showing the registration; commit alongside this runbook (or as a separate evidence-capture commit) at `docs/operations/screenshots/coolify-monthly-vat-close-registered.png`.

### Smoke test (post-registration, pre-stage-1)

Run a manual fire to verify the registration works end-to-end:

```bash
curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
  https://[prod-host]/api/cron/monthly-vat-close
```

**Expected response shape** (pre-cutover, no GL movement in target month):

```json
{
  "ok": true,
  "result": {
    "target_period": "2026-05",
    "posting_date": "2026-05-31",
    "status": "skipped_no_vat_movement",
    "net_payable_to_vid_cents": 0
  }
}
```

**Valid smoke signals:**
- `status: 'skipped_no_vat_movement'` — cron fires correctly, no 5710-LV-* activity yet for the period (pre-engine state). ✓
- `status: 'skipped_period_already_closed'` — May backfill has already posted May's P.1; Layer 2 idempotency caught the cron's attempt. ✓ (Expected once gate 7 completes.)
- `status: 'created'` with a non-null `entry_id` — cron emitted a P.1. ✓ (Expected for the first post-cutover real fire — June close on 1 July.)

**Halt signals:**
- HTTP 401 — `CRON_SECRET` mismatch; check env var.
- HTTP 500 — engine error; check Sentry.
- `status: 'failed'` or `'failed_period_locked'` — investigate per response `error` field.

### Smoke-test patterns for other crons (post-deploy verification)

| Route | Expected smoke (pre-cutover) | Expected smoke (post-cutover first fire) |
|---|---|---|
| `monthly-vat-close` | `skipped_no_vat_movement` OR `skipped_period_already_closed` | `created` for previous month's close |
| `monthly-depreciation` | `skipped_period_already_closed` (April depreciation in GL) | `created` for previous month, per active asset |
| Other crons | Unchanged from pre-PR-C; no cutover-specific signal | Same |

---

## 7. Post-cutover operational calendar

Recurring tasks the staff must perform monthly post-cutover. Each task has a **trigger** (what fires it), an **action** (what to do), and a **verification** (how to confirm success).

### Monthly recurring: `BANK_WALK_CHECKPOINTS` extension

**Trigger:** day 1 of each month, before that month's bank reconciliation runs. The `BANK_WALK_CHECKPOINTS` constant in code carries dated checkpoints used by checklist item 2 to walk through Swedbank statement balances. Each new month requires adding the closing-balance checkpoint for the **previous** month.

**Action:**
1. Pull the previous month's final Swedbank statement (closing balance + final transaction).
2. Edit `src/lib/accounting/[checkpoints-file-path].ts`: append entry `{ date: 'YYYY-MM-DD', closing_balance_cents: N, source: 'Swedbank statement N' }`.
3. Commit + push + merge to main; Coolify auto-deploys.

**Verification:** run `/staff/accounting/period-close?period=YYYY-MM` for the just-closed month; item 2 (bank reconciliation) returns `pass`.

### Monthly recurring: C.3 EveryPay settlement entries

**Trigger:** Swedbank EveryPay settlement batch arrives in the bank statement (typically daily or near-daily; aggregates the previous day's card transactions).

**Action:**
1. Open `/staff/accounting/everypay-settlement`.
2. Enter the bank statement reference (e.g., `SWED-EP-2026-06-15-batch-001`).
3. Enter settlement amount in cents.
4. Optional: list of EveryPay txn refs included in the batch.
5. Submit. The staff action emits a C.3 entry (Dr 2610 / Cr 2630).

**Verification:** the `2630` (EveryPay clearing) balance should trend toward zero across the month as settlements clear. Checklist item 7 (EveryPay clearing) returns `pass` at month-end if all settlements landed.

### Monthly recurring: `monthly-vat-close` cron review

**Trigger:** 01:00 UTC on day 1 of each month — automated; staff doesn't fire manually.

**Action (review only):**
1. After the cron fires, check `audit_log WHERE action='accounting.posted' AND created_at >= [first of month]` for the new P.1 entry.
2. If `status = 'skipped_no_vat_movement'`, confirm the previous month genuinely had no VAT activity (rare post-cutover — typically only zero-cart months).
3. If `status = 'skipped_period_already_closed'`, investigate: a non-cron P.1 already landed in the period (backfill collision, manual emission, etc.) — log the `existing_entry_id` for audit.
4. If `status = 'failed_period_locked'`, the previous month was soft/hard-locked before the cron fired. Investigate why; manually unlock + re-fire if appropriate.

**Verification:** `journal_entries WHERE accounting_period = <previous month> AND type_id = 'P.1'` returns exactly one row.

### Monthly recurring: PVN deklarācija filing (LV-specific)

**Trigger:** day 20 of each month — VID filing deadline for the previous month's VAT return.

**Action:**
1. Pull the monthly P.1 entry + supporting GL detail.
2. Prepare PVN 1-I / 1-II / 1-III attachments (per the codes documented in `pvn_deklaracija_form_codes.md` memory).
3. File via VID's EDS portal.
4. If P.1 was a refund position, await VID refund to Swedbank current account; if payable, transfer to VID by the 23rd.

**Verification:** EDS shows the declaration accepted; bank statement shows the corresponding inflow/outflow within 5 business days.

### Period close cycle

**Trigger:** day 5-7 of each month (after BANK_WALK_CHECKPOINTS extended + C.3 settlements caught up + monthly-vat-close cron has fired).

**Action:**
1. Run `/staff/accounting/period-close?period=<previous month>`.
2. Verify all 9 items return `pass`.
3. Soft-lock the period via staff UI.
4. After 2-3 days of soft-lock window (allows any late-arriving adjustments via `period_close_adjustment=true` flow), hard-lock the period.

**Verification:** `SELECT status FROM periods WHERE period_key = '<previous month>' AND period_type = 'month'` returns `hard_locked`.

---

## 8. Post-cutover deferred work queue

Synthesized from `pr_c_followups.md` and the audit doc's deferred-actions queue. Each item has scope, blocking flag, and target timeframe.

### Q3 2026 targets

**Reversal-entry staff UI (PR #4b)** — **`blocker for rollback recovery only; does not block routine operations.`**
Interim mitigation: engineering-time RPC calls per the pattern documented in §5 rollback playbook. Until this UI lands, any post-cutover GL correction requires engineering involvement, including any rollback-window recovery. Target: PR #4b, Q3 2026.

**Buyer-counterparty schema migration** — **`non-blocking`**.
Today's encoding of buyer-side wallet movement on C.1/C.2 multi-leg entries (`counterparty_type='buyer'`, `counterparty_id=null`, `posting_context.buyer_id=<uuid>`) works fine operationally. Dashboard for buyer-attributed wallet movement is incomplete; surfaces when PR #4's wallet-integrity dashboard wants buyer-level drill-down. Target: when dashboard demand surfaces (post-launch).

**Depreciation cron Layer 2 retrofit** — **`non-blocking; consistency followup`**.
PR #296's `monthly-depreciation` cron lacks the explicit Layer 2 period-skip guard that `monthly-vat-close` has (per `accounting_conventions.md §8`). Real risk window: cutover transition where a manual P.6 fix during the cutover window could collide with the cron's day-1 fire on the same period. Asset-scoped Layer 2 guard mirrors the VAT-close pattern. Target: small standalone PR post-cutover.

**Partial-refund wrap support (O.9 wrap-layer)** — **`non-blocking; feature gap`**.
The `refundOrderWithGL` wrap doesn't currently surface partial-refund inputs — the wrap header notes "partial refunds deferred until refundOrder gains item/shipping decomposition support." O.9 routing is unit-tested at the compute level (mapping.test.ts) and at the wrap-branch level (lifecycle-wraps.test.ts cross-period); end-to-end integration test deferred. Target: when partial refund flow ships.

### Deferred integration test scenarios

**Scenarios 4 (O.8 cross-period refund), 5 (O.9 partial refund), 12 (paired C.9), 17 (checklist item 4 reconciliation gate)** — `non-blocking`.
Each requires multi-period or multi-listing state setup that crossed the commit-13 deferral threshold. Coverage at the unit level is solid (mapping.test.ts + lifecycle-wraps.test.ts wrap-branch); integration tests would close the belt-and-suspenders gap. Scenario 17 has alternative coverage via PR D's `checklist.test.ts`. Target: post-launch operational review.

### Future VID interactions

**VID refund €0.30 from April PVN clearing** — `non-blocking; tracking only`.
Awaiting Swedbank deposit. When it lands, post via the existing C.x flow (likely a manual H.2 or similar adjustment entry).

**Future C.x for VID refund/payment automation** — `non-blocking`.
Today VID interactions are manual journal entries. A future C.x type could automate the bank-side recognition. Target: post-launch when reporting cadence stabilizes.

---

## 9. Cross-references

- **`deployment-state-audit-2026-05-12.md`** — production state snapshot at PR C in-flight. Pre-cutover gate verification commands; full migration list; Coolify env var checklist.
- **`pr_c_followups.md`** — deferred items captured during PR C commits 9–13. §8 above is the synthesized cutover-relevant view.
- **`accounting_conventions.md §8`** — layered idempotency canonical pattern. Driving doctrine for monthly-vat-close Layer 2.
- **CLAUDE.md "Accounting Module"** — engine architecture, posting context tag conventions, audit event register, KYC gate semantics.
- **CLAUDE.md "Cron Routes"** — registry of all `/api/cron/*` routes; Coolify command pattern; auth shape.
- **`may_backfill_timing.md`** — backfill execution window + PVN deklarācija filing deadlines.
- **`pvn_deklaracija_form_codes.md`** — PVN 1-I / 1-II / 1-III transaction code reference for VID filings.

---

## Appendix A — Cutover calendar (target dates)

**Subject to revision. Revise this section inline if dates slip; preserve target vs. actual columns for audit. Log decision rationale alongside any slippage.**

| Date | Target activity | Owner | Status | Notes (actual + rationale) |
|---|---|---|---|---|
| 19 May 2026 (week of) | April PVN deklarācija filed | user | ✓ done | Filed 12 May 2026 |
| 26 May 2026 (week of) | PR C reviewed; commit 14 merged to feature branch | user | target | — |
| 2 June 2026 | PR C merged to main; Coolify auto-deploys; migrations 108, 109 apply | user + system | target | — |
| 3 June 2026 | Pre-cutover gate verification; `monthly-vat-close` cron registration + smoke test | user | target | Gates 1-9 walked; cron registered; smoke returns expected shape |
| 4 June 2026 | May backfill executes; `BANK_WALK_CHECKPOINTS` extended for May | user | target | — |
| 5-6 June 2026 | **Stage 1** — staging burn-in | user | target | All 7 variants exercised; checklist passes against TEST_PERIOD |
| 8-10 June 2026 | **Stage 2** — production staff-only burn-in | user | target | All 7 production variants exercised; 24h quiet window achieved |
| 11 June 2026 | **Stage 3** — production global flag flip (code edit + deploy) | user | target | `orders.is_staff_test` gate removed from wrap call sites; first real customer order posts GL |
| 12-18 June 2026 | Aggressive 7-day monitoring window | user | target | Daily audit_log + trial balance + wallet-integrity checks |
| 20 June 2026 | May PVN deklarācija filing deadline | user | target | Standard backfill→VID flow (engine cron only handles June onwards) |
| 19 June – 11 July 2026 | Standard 23-day monitoring window | user | target | Weekly checks |
| 1 July 2026 (01:00 UTC) | First `monthly-vat-close` cron fire (June close P.1) | system | target | Smoke signal: `status='created'` with non-null entry_id |
| 11 July 2026 | Day-30 milestone; cutover-as-operational-concern ends | user | target | Standard ops cadence resumes |

---

## Appendix B — Print-friendly checklist (stage-by-stage compressed view)

For staff executing the cutover. Cross-references full sections above.

### Pre-cutover gates (all must be TRUE)

- [ ] Gate 1: PR C merged to main; Coolify deploy green
- [ ] Gate 2: Migrations 108, 109 applied to production
- [ ] Gate 3: `ACCOUNTING_ENGINE_ENABLED` unset or false
- [ ] Gate 4: `pnpm test:integration` green on main HEAD
- [ ] Gate 5: `monthly-depreciation` cron registered
- [ ] Gate 6: `monthly-vat-close` cron registered + smoke-tested
- [ ] Gate 7: May 2026 backfill executed; trial balance reconciles
- [ ] Gate 8: Period 2026-04 hard-locked
- [ ] Gate 9: `is_staff_test` wrap-layer gating fix landed

### Stage 1 — Staging burn-in (2 days)

- [ ] All 7 synthetic variants exercised
- [ ] Period close: items 1, 3, 4, 5, 6, 8, 9 `pass`; items 2 + 7 `not_applicable` (acceptable)
- [ ] Soft-lock → hard-lock cycle clean
- [ ] Zero `accounting.*` Sentry events

### Stage 2 — Production staff-only burn-in (3 days)

- [ ] `ACCOUNTING_ENGINE_ENABLED=true` set in production
- [ ] All 7 production staff variants exercised
- [ ] Per-variant verification (trial balance + journal shape + wallet integrity + checklist) passes
- [ ] 24h quiet window with zero `accounting.*` Sentry events

### Stage 3 — Production global flip

- [ ] Code edit removing `orders.is_staff_test` gate landed + deployed
- [ ] Manual smoke: real (non-staff-test) order posts GL with `is_staff_test=false`
- [ ] 7-day aggressive monitoring window
- [ ] 23-day standard monitoring window
- [ ] First `monthly-vat-close` cron fire (1 July 2026)
- [ ] Day-30 milestone reached
