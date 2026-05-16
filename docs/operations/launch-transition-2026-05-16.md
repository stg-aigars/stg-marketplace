# Launch Transition Guide — 16 May 2026 → Engine Cutover

**Context**: Marketplace launches today (Fri 16 May 2026) with the accounting engine OFF in production. Engine cutover targets 11 June 2026 per `lifecycle-cutover-runbook.md`. This document is the day-by-day playbook for the ~26-day transition window.

**Companion docs**:
- `docs/operations/lifecycle-cutover-runbook.md` — canonical cutover playbook (3-stage rollout, rollback decision tree)
- `docs/operations/deployment-state-audit-2026-05-12.md` — pre-launch production state snapshot
- CLAUDE.md → "Accounting Module" section — engine architecture, error contracts, idempotency model

---

## TL;DR

- Marketplace works end-to-end on legacy paths from day 1. Buyers buy, sellers sell, payments clear, wallets credit. The only thing missing is real-time GL entries.
- Accounting catches up via two backfill cycles after the engine is live:
  1. **Expanded May backfill** (~1-3 June): STG operational entries + marketplace transactions from 16-31 May
  2. **June catch-up backfill** (~12-14 June): marketplace transactions from 1-10 June
- PVN deklarācija filing on 20 June for May uses the May backfill numbers — same as previous months, no procedural change.
- After 11 June, the engine writes journal entries in real time. From 1 July onwards, monthly close becomes a 0.5-1 day review job instead of a 3-5 day reconstruction job.

---

## Gate verification (16 May)

- [x] **Gate 4** — `pnpm test:integration` green on main HEAD. 20 test files, 130/130 tests passed. Verified 16 May.
- [x] **Coolify crons present** — `monthly-vat-close` (day 1 at 01:00 UTC) and `monthly-depreciation` (day 1 at 00:30 UTC) both scheduled. Verified 16 May.
- [ ] **Sentry alerts configured** for accounting-engine + payment + wallet error paths (see "Sentry alerts" section below).

---

## Calendar

### Pre-cutover (16 May → 7 June)

| Date | What runs automatically | Action items | Owner |
|---|---|---|---|
| **Fri 16 May** | Marketplace LIVE; engine OFF | Configure Sentry alerts; finalize soft-launch announcement timing | You |
| **17-22 May** | Same | Watch Sentry, order volume, payment success rate, BGG health | You |
| **23-27 May** | Same | Confirm accountant available 1-3 June for verification | You |
| **23-27 May** | — | Adapt May backfill script: extend to include marketplace transactions from 16-31 May | Claude |
| **28-31 May** | Same | Spot-check `orders` / `withdrawal_requests` / refund records for data integrity (weird states complicate backfill) | You |
| **28-31 May** | — | Dry-run May backfill script against staging; verify trial balance | Claude |
| **Mon 1 June 00:30 UTC** | `monthly-depreciation` cron fires for May — posts P.6 entries for active fixed assets via engine | — | Auto |
| **Mon 1 June 01:00 UTC** | `monthly-vat-close` cron fires for May — finds zero engine-written marketplace entries, skips harmlessly | — | Auto |
| **1-3 June** | — | Run expanded May backfill (script handles STG ops + marketplace data + May P.1 close as final entry); accountant reviews trial balance + P&L | You + Claude + Accountant |
| **4-7 June** | — | Write Stage 3 PR as draft (removes `&& is_staff_test` at 4 call sites: order-transitions, order-refund, payment-fulfillment, withdrawal route) | Claude |
| **4-7 June** | — | Optional: staging burn-in smoke test of engine wraps | Claude |

### Cutover (8-11 June)

| Date | What runs automatically | Action items | Owner |
|---|---|---|---|
| **Mon 8 June** | — | Flip `ACCOUNTING_ENGINE_ENABLED=true` in production env; redeploy | You |
| **Mon 8 June** | Engine activates for `is_staff_test=true` entities only | Create 5-10 staff-marked test orders end-to-end (cart → pay → complete → withdraw) | You + Claude |
| **9-10 June** | Engine writes journal entries for staff-test traffic | Verify journal entries for shape + routing correctness; watch Sentry for `accounting.posted` failures | Claude |
| **Wed 10 June** | — | 24h quiet period — no engine code changes; observe stability | You |
| **Thu 11 June** | — | Merge Stage 3 PR; redeploy; engine now writes for ALL transactions | You |
| **Thu 11 June** | — | Verify a real (non-staff-test) order completion writes a journal entry | You |

### Catch-up + first close (12 June → 1 July)

| Date | What runs automatically | Action items | Owner |
|---|---|---|---|
| **12-14 June** | Engine writing real-time | Write + run "16 May → 10 June marketplace" catch-up backfill — splits naturally into May 16-31 entries (May period) and June 1-10 entries (June period) | Claude |
| **15-19 June** | — | Assemble PVN deklarācija for May from `5710-LV-IN` / `5710-LV-OUT` account movements | You + Accountant |
| **Sat 20 June** | — | **File PVN deklarācija for May on EDS** (legal deadline) | You |
| **21-25 June** | — | Soft-lock May period via staff UI after PVN filed; hard-lock once accountant confirms | You |
| **Wed 1 July 00:30 UTC** | `monthly-depreciation` cron for June — posts P.6 per active fixed asset | — | Auto |
| **Wed 1 July 01:00 UTC** | `monthly-vat-close` cron for June — finds engine-written entries, posts real P.1 | — | Auto |
| **2-5 July** | — | Review June trial balance + P&L in staff UI; should be current with no backfill needed | You |
| **Sun 20 July** | — | **File PVN deklarācija for June on EDS** — first month using engine-only data, no backfill involved | You |

---

## Decision points & what to know

### Why the May backfill scope grew

Engine-OFF until 11 June means no GL entries for marketplace transactions in the 16 May → 10 June window. The May backfill (originally STG operational entries only) must now include 16 days of marketplace data (May 16-31) so the May P.1 VAT close entry reflects real VAT amounts.

The convention from Phase 0 and April backfills: **the backfill script posts the period-close P.1 entry as its final entry for the period.** May backfill follows the same pattern — `close_2026_05` is the P.1 entry, posted at the tail of the script run.

### Why the June 1 cron fires harmlessly

`monthly-vat-close` fires at 01:00 UTC on June 1 for May. At that moment, no engine entries exist in May (the engine has been OFF). The cron's Layer-2 idempotency check finds no P.1 for May, computes the net VAT position, finds it's zero (because no LV-IN or LV-OUT entries exist), and skips per the "Skipped (no emit) when both LV-IN and LV-OUT are zero" rule. The subsequent May backfill posts the real P.1 with the correct numbers.

### Why the catch-up backfill splits

Marketplace transactions from 16 May → 10 June span two accounting periods: May (16-31) and June (1-10). The catch-up backfill writes entries with appropriate `posting_date` and `accounting_period` per transaction. May entries flow into the already-closed May P.1 numbers (already posted by the May backfill — these are additive, not corrective). June entries flow into June's P.1 which will be posted by the cron on 1 July.

**Critical timing**: the catch-up backfill must complete BEFORE 1 July (the June VAT close cron firing). Buffer window is 12-30 June, which is generous.

### Engine-write discipline post-cutover

Once the engine is on (11 June+):
- **Don't manually INSERT into `journal_entries` or `journal_lines`.** The engine is the only writer at the application layer. Immutability triggers will reject UPDATE/DELETE anyway.
- **Corrections happen via reversal entries** with `reverses_entry_id` pointing at the original. The engine handles this; staff UI exposes it.
- **Vendor invoices stay manual** — type them in via the staff UI as they arrive. Emits I.1 immediately.
- **EveryPay settlement entries stay manual** — post C.3 via staff UI when settlement reports arrive.
- **Fixed asset additions stay manual** — no automated intake yet.

### Period lock state machine

After PVN deklarācija filing for a period:
- `open` → `soft_locked` via staff UI (only entries with `period_close_adjustment=true` can post)
- `soft_locked` → `hard_locked` via atomic RPC (no entries can post; corrections must be reversals in the current open period)

Hard-lock requires no entries posted since soft-lock (verified at action time). The unsoft-lock action is the admin escape hatch and requires a non-empty `transition_reason`.

---

## What to watch for during engine-OFF window (16 May → 11 June)

Anything that bypasses standard flows complicates the backfill. If any of these happen, write down what you did and when:

- **Refunds outside the standard cancel-and-refund flow** (e.g. manual EveryPay refunds initiated outside the app). These bypass the order state machine and won't show up cleanly in `orders.cancellation_reason` / `payment_refunds`.
- **Wallet adjustments outside standard credit/debit paths** (e.g. goodwill credits). Wallet has audit events, but unusual flows need a note for the backfill.
- **Manual GL data fixes via direct SQL.** Don't. Once engine is on, this would violate the "engine is the only writer" invariant. Pre-engine it's technically possible but creates reconciliation drift.

Things that work identically engine-on vs engine-off (no special handling needed):
- Buyer flows (browse, checkout, pay)
- Seller flows (list, accept, ship)
- Wallet credits/debits (wallet tables are separate from GL)
- Refunds, disputes, cancellations (state machine is independent)
- Notifications, emails
- All other crons (auction-ending, deadlines, cleanup, DAC7, etc.)

---

## Sentry alerts worth configuring (16 May)

- **Pre-cutover priority**: Any error tagged `payment.fulfillment` or `cart.checkout` (always critical); any `wallet.debit` / `wallet.credit` failure (always critical); any 5xx on `/api/cron/*` routes (medium).
- **Post-cutover additional**: Any error in `src/lib/accounting/posting-engine.ts` paths (critical post-11 June); sustained `[Audit] Failed to log event` patterns for `accounting.posted` (indicates compliance gap even if GL writes succeed — the engine treats this as warning, but a pattern is a signal).

---

## Rollback path if engine cutover goes wrong on 11 June

Per the lifecycle-cutover-runbook.md decision tree:

1. **Revert the Stage 3 PR** (re-adds `&& is_staff_test` gate at the 4 sites) and redeploy
2. **Flip `ACCOUNTING_ENGINE_ENABLED=false`** in env
3. Engine becomes dormant; lifecycle wraps stop emitting
4. **Journal entries already written stay written** (immutability trigger blocks DELETE) — they're real and correct, just isolated to the staff-test window
5. Address the bug, re-run staged rollout from Stage 2

**Blast radius is bounded.** GL entries can't be retroactively wrong because the engine refuses bad data at write time (validation errors, balanced-entry trigger, period-status trigger). Worst case is missing entries for the window between cutover and rollback, which a small backfill handles same way as the 16 May → 10 June catch-up.

---

## Quick reference

- **Engine activation flag**: `ACCOUNTING_ENGINE_ENABLED` in production env vars
- **Stage 3 gate locations**: `src/lib/accounting/lifecycle-wraps.ts` callers at order-transitions, order-refund, payment-fulfillment, withdrawal route (4 sites, search `is_staff_test`)
- **Backfill script location**: `scripts/` directory (Phase 0, April, May backfills follow naming conventions)
- **Staff UI for period close**: `/staff/accounting` (PR #4 shipped)
- **Staff UI for vendor invoices**: same area (PR #4 shipped)
- **PVN deklarācija EDS portal**: external — Latvian state revenue service e-filing system
- **OSS portal**: external — quarterly submissions for LT/EE B2C OSS positions

---

## When to consult this doc

- **Today through 31 May**: section "Pre-cutover" — week-by-week tasks
- **1-3 June**: section "Decision points → May backfill scope" before running script
- **8-11 June**: section "Cutover" — staged activation
- **12-14 June**: section "Catch-up + first close" — second backfill timing
- **20 June**: section "Quick reference" — PVN filing checklist
- **1 July onwards**: engine is steady-state, refer to `lifecycle-cutover-runbook.md` for ongoing operational discipline

If something goes off-script, the lifecycle-cutover-runbook.md is the canonical reference. This doc is the launch-specific overlay.
