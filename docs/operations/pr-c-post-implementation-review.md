# PR C — Post-implementation review

**Branch:** `feature/lifecycle-finale` @ `13fd363` vs `main` @ `655777a`
**Review date:** 2026-05-13
**Reviewer:** Claude Code (automated systematic self-review)
**Scope:** 13 commits ahead of main; 9,742 LoC additions across 64 files; 873 unit + 130 integration tests green.

---

## Bottom line

**Overall verdict: Pass-with-followups.** No Critical findings that block opening PR C for review. **One Critical finding (1.3a — refund RPC missing idempotency guard) is a real pattern-drift bug** but it's mitigated by engine UNIQUE recovery, so it doesn't block opening — it should land as a small fix commit before merge. **Three Important runbook findings (2.2, 2.5, 2.7) require corrective edits before stage 1 can execute** but they don't block PR C from entering review.

**Top three items to address before opening PR C:**

1. **Migration 110 missing from runbook Gate 2** (Important, 2.2). Three places in the runbook reference "Migrations 108, 109"; should be "108, 109, 110". Trivial sed-fix, ~5 LoC delta.
2. **Stage 3 transition under-specified** (Important, 2.5). The runbook says "remove `orders.is_staff_test` gate" — but Gate 9's fix installed the gate at FOUR caller sites, not just orders. Stage 3 needs to remove all four. Trivial wording fix, ~5 LoC delta.
3. **`BANK_WALK_CHECKPOINTS` file path placeholder** (Important, 2.7). Runbook §7 says edit `src/lib/accounting/[checkpoints-file-path].ts` — the actual path is `src/lib/accounting/phase0-reconciliation-constants.ts`. Trivial fix.

**Finding totals:** Critical 1; Important 8; Minor 11; Informational 6. Total: 26.

---

## Lens 1 — Cross-commit coherence

### Findings

**Finding 1.1 — Wrap argument naming asymmetry** — Minor
- **What:** Two of the four wraps use `order: OrderForX` for their resource argument; the other two use `input: XInput`.
  - `completeOrderWithGL(supabase, order: OrderForCompletion, completionSource)`
  - `refundOrderWithGL(supabase, order: OrderForRefund, refundResult)`
  - `cartFulfillmentWithGL(supabase, input: CartFulfillmentWithGLInput)`
  - `withdrawalCompletionWithGL(supabase, input: WithdrawalCompletionWithGLInput)`
- **Where:** `src/lib/accounting/lifecycle-wraps.ts:177, 420, 612, 775`
- **Why it matters:** Minor inconsistency in API ergonomics. Callers writing IDE auto-complete will hit different argument names per wrap. Not a functional issue.
- **Remediation:** Not blocking. Optional: align on `input:` for all four in a future cleanup commit (the `OrderForX` naming carries domain meaning the `input` form loses). Leave as-is; track if a refactor surfaces it.

**Finding 1.2 — Wrap return shape asymmetry** — Informational
- **What:** Each wrap returns a different field for its primary journal entry id: `journal_entry_id` (completion, withdrawal), `cart_journal_entry_id` + `partial_refund_journal_entry_id` (cart), `refund_entry_id` + `cash_leg_entry_id` (refund).
- **Where:** Same wraps as 1.1.
- **Why it matters:** Defensible — each wrap emits a different type/count of entries; the naming carries semantics. Not pure inconsistency.
- **Remediation:** None needed.

**Finding 1.3a — Refund RPC missing idempotent-retry guard** — Critical
- **What:** Migrations 106 (completion), 108 (cart), 109 (withdrawal) all have an explicit idempotent-retry guard pattern: `if v_<entity>.<RPC-owned-column> is not null then return idempotent_skip=true`. Migration 105 (refund) does NOT have this. The result always returns `idempotent_skip: false`.
- **Where:** `supabase/migrations/105_order_refund_rpc_body.sql` body — no `IF v_order.refunded_at IS NOT NULL THEN return idempotent_skip=true` early-return.
- **Why it matters:** Pattern drift across the 4 parent RPCs. The functional impact is limited because:
  - Engine UNIQUE on `(source_doc_type, source_doc_id, type_id)` catches duplicate emits via 23505 → engine recovery returns `idempotent_skip` from the UNIQUE path.
  - `orders.refund_status` / `refund_amount_cents` UPDATE is idempotent (same values on retry).
  - BUT: `refunded_at = now()` overwrites on each retry — timestamp drift. Not load-bearing but inconsistent with the "RPC-owned column is the load-bearing write" discipline declared in 106/108/109.
  - And: documentation discipline. The pattern was explicitly chosen post-PR-#292 to close the same class of bug. Refund slipped through.
- **Remediation:** Small follow-up commit adding the guard:
  ```sql
  -- After FOR UPDATE v_order:
  if v_order.refunded_at is not null then
    return jsonb_build_object(
      'refund_entry_id', null,
      'cash_leg_entry_id', null,
      'orphan', not v_has_antecedent,
      'idempotent_skip', true
    );
  end if;
  ```
  Plus a unit test asserting retry returns `idempotent_skip=true`. Estimated ~30 LoC. Lands as a small commit on `feature/lifecycle-finale` before opening PR C, OR as the first commit of the PR-C review window.

**Finding 1.3b — Parent RPC patterns otherwise consistent** — Informational
- **What:** All 4 RPCs share: `LIFECYCLE:EVENT_ID_MISMATCH` cross-validation, `LIFECYCLE:<RESOURCE>_NOT_FOUND` for FOR UPDATE failure, `jsonb_build_object` return shape, GL-emit-first vs state-first patterns match the declared convention in `accounting_conventions.md §3`.
- **Remediation:** None.

**Finding 1.4 — Event builder consistency** — Informational
- **What:** All 6 lifecycle event builders set `emission_source: 'lifecycle'`. Settlement (C.3) uses `'staff_manual'`. Cron VAT close uses `'cron'`. Convention enforced uniformly. `is_staff_test ?? false` threaded consistently to payload across all 6 builders that accept it.
- **Remediation:** None.

**Finding 1.5 — Test artifact tag inconsistency** — Important
- **What:** CLAUDE.md "Accounting Module → Test artifact convention" states "all lifecycle tests post entries to synthetic period 2027-01 with `posting_context.test_artifact=true`." But 2 of 8 lifecycle integration test files (`settlement.test.ts`, `withdrawal.test.ts`) don't add this tag because they exercise the FULL wrap path — the wrap doesn't accept an arbitrary `test_artifact` override.
- **Where:** `src/test/integration/lifecycle/settlement.test.ts`, `src/test/integration/lifecycle/withdrawal.test.ts`.
- **Why it matters:** PR #4 reporting views using the convention `NOT (posting_context @> '{"test_artifact": true}')` will leave the wrap-emitted integration test entries in real reports. The period filter (2027-01 ≠ production period) is the practical safeguard, but the CLAUDE.md statement is too absolute.
- **Remediation:** Two paths:
  1. **Wraps accept an optional `test_artifact` override** (~20 LoC across 4 wraps + 6 builders, mirrors the `is_staff_test` threading shape). Pros: enforces uniform tagging. Cons: adds a parameter only test code uses.
  2. **Update CLAUDE.md statement** to say "all lifecycle test artifacts use synthetic period 2027-01 as the discriminator; tests using wraps end-to-end rely on the period; direct-insert tests additionally tag `posting_context.test_artifact=true`." Documentation-only fix, ~5 LoC.
  Recommend path 2. Path 1 has zero callers outside test code; opening a wrap input for test-only use is awkward.

**Finding 1.6 — Migration filename + ordering** — Informational
- **What:** Migrations 108, 109, 110 are sequential with no gaps. Filenames descriptive. No draft/WIP migrations. Idempotent shape (ALTER TABLE ADD COLUMN; CREATE OR REPLACE FUNCTION).
- **Remediation:** None.

**Finding 1.7 — Type system consistency** — Informational
- **What:** `OrderRow` (orders/types.ts), `CartCheckoutGroup` (checkout/cart-types.ts), `WithdrawalRequestRow` (wallet/types.ts) all carry `is_staff_test: boolean` as required field. Matches migration 110 + 103 (NOT NULL DEFAULT false) at DB level.
- **Remediation:** None.

**Finding 1.8 — `emission_source` coverage** — Informational
- **What:** All 9 `emission_source:` writes across `lifecycle-events.ts` set the value explicitly. Lifecycle builders use `'lifecycle'`, settlement uses `'staff_manual'`, cron uses `'cron'`. No code path relies on a default.
- **Remediation:** None.

**Finding 1.9 — Posting period derivation duplicated** — Minor
- **What:** All 4 wraps independently derive `const today = new Date().toISOString().split('T')[0]; const period = today.substring(0, 7);` — 2 LoC × 4 = 8 LoC of identical scaffold.
- **Where:** lifecycle-wraps.ts lines 184-185, 425-426, 616-617, 781-782.
- **Why it matters:** DRY violation; if the period derivation changes (e.g., timezone handling), 4 sites must update.
- **Remediation:** Optional helper `getPostingPeriod(): { today: string; period: string }` in a future cleanup. Not blocking.

### Verdict: **Pass-with-followups**

The single Critical (1.3a refund RPC idempotency guard) is the only blocker for full coherence. It's a small fix and the engine UNIQUE provides a functional backstop. Opening PR C with this open is acceptable IF the fix lands before merge.

---

## Lens 2 — Runbook executability

### Findings

**Finding 2.1 — Stage 1 assumes a staging Supabase project that may not exist** — Important
- **What:** Runbook §2 (Stage 1) says: "verify the wraps against synthetic transactions in a non-production environment. The engine writes GL entries to a staging Supabase project; production state is untouched." Entry checklist line 86: "Staging Supabase project pointed at by the staging deployment; service-role key configured."
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:78-89`
- **Why it matters:** Grepping the codebase finds no evidence that a separate staging Supabase project is provisioned. `hetzner-deployment-plan.md:180-181` mentions a `staging` BRANCH but a separate Supabase instance is not documented. If staging Supabase doesn't exist, stage 1 collapses into `pnpm test:integration` (which is already Gate 4).
- **Remediation:** Two paths:
  1. **Confirm staging Supabase exists** (operational verification by user); if yes, document the project ID in runbook §2 entry checklist.
  2. **If staging Supabase doesn't exist:** rewrite §2 to say "Stage 1 = `pnpm test:integration` against a local Supabase + manual smoke against a temporary cloud Supabase branch (Supabase MCP supports branch creation; document the branch lifecycle)."
  Recommend confirming first; if no staging exists, restructure §2.

**Finding 2.2 — Gate 2 references migrations 108, 109 but commit 73053f6 added migration 110** — Important
- **What:** Three places in the runbook reference "Migrations 108, 109":
  - Line 43: Gate 2 header "Migrations 108, 109 applied to production"
  - Line 45: "last applied migration ≥ `109_withdrawal_completion_rpc_body`"
  - Line 498: Appendix A calendar "migrations 108, 109 apply"
  - Line 519: Appendix B Gate 2 checklist
- **Where:** `docs/operations/lifecycle-cutover-runbook.md` lines 43-45, 498, 519.
- **Why it matters:** Staff verifying Gate 2 with this text would miss migration 110 (is_staff_test on cart_checkout_groups + withdrawal_requests). If migration 110 didn't apply, the wrap-layer gate `group.is_staff_test` access would fail at runtime.
- **Remediation:** Three sed-style updates:
  - "Migrations 108, 109" → "Migrations 108, 109, 110" (3 locations)
  - "≥ `109_withdrawal_completion_rpc_body`" → "≥ `110_is_staff_test_cart_withdrawal`"
  Trivial. ~5 LoC.

**Finding 2.3 — Gate 7 lacks concrete verification commands** — Important
- **What:** Gate 7 ("May 2026 backfill executed; trial balance reconciles for May") says "the trial balance view shows non-zero May activity with balanced sums." Not a specific query; "balanced sums" is implicit.
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:65`
- **Why it matters:** Staff executing the verification needs to know what query/UI/dashboard to inspect. "Balanced sums" — is this `SUM(debit_cents) = SUM(credit_cents)`? Per account? Per entry? Overall?
- **Remediation:** Replace with a concrete query:
  ```sql
  SELECT
    accounting_period,
    SUM(jl.debit_cents) AS dr,
    SUM(jl.credit_cents) AS cr
  FROM journal_entries je
  JOIN journal_lines jl ON jl.entry_id = je.id
  WHERE je.accounting_period = '2026-05'
  GROUP BY accounting_period;
  ```
  Expected: dr = cr (non-zero, balanced).

**Finding 2.4 — Stage 1 exit criterion #5 ambiguous** — Minor
- **What:** Exit criterion: "Zero Sentry events from `accounting.*` namespace during the burn-in window." Synthetic test transactions might intentionally trigger `PostingComplianceGateError` events (e.g., variant testing KYC-blocked withdrawal). Those events would land in Sentry.
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:122`
- **Why it matters:** Strict interpretation would halt stage 1. Loose interpretation requires judgement, breaking the "concrete + verifiable" rule.
- **Remediation:** Soften to "Zero UNEXPECTED Sentry events; expected events from variant testing (KYC gate, balance violation tests) are acceptable provided they match the test plan."

**Finding 2.5 — Stage 3 transition under-specifies which gates to remove** — Important
- **What:** Runbook §4 entry checklist line 218: "Code edit landed: wrap call sites no longer gate on `orders.is_staff_test`." Stage 3 manual smoke (line 220) only checks order completion. Appendix B Stage 3 (line 544): "Code edit removing `orders.is_staff_test` gate landed + deployed."
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:218, 220, 544`
- **Why it matters:** Commit 73053f6 installed the gate at FOUR caller sites:
  - `order-transitions.ts` (orders.is_staff_test)
  - `order-refund.ts` (order.is_staff_test)
  - `payment-fulfillment.ts` (group.is_staff_test on cart_checkout_groups)
  - `staff/withdrawals/[id]/route.ts` (withdrawal.is_staff_test)
  Stage 3 transition must remove all four. Current wording suggests removing only the orders gate.
- **Remediation:** Update line 218 + 544 to read "wrap call sites no longer gate on `entity.is_staff_test` across the 4 caller sites (order-transitions, order-refund, payment-fulfillment, withdrawal route)." Add a verification step to line 220 covering cart + withdrawal + refund smoke paths, not just completion.

**Finding 2.6 — Calendar refers to "migrations 108, 109 apply" on 2 June** — Important
- **What:** Same issue as Finding 2.2 — Appendix A calendar references only 108, 109. Should include 110.
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:498`
- **Why it matters:** Same severity as 2.2 (same operational mismatch). Listed separately because it's in the calendar table.
- **Remediation:** Add "110" to the list on line 498. (Bundle with 2.2 fix.)

**Finding 2.7 — `BANK_WALK_CHECKPOINTS` file path placeholder** — Important
- **What:** Runbook §7 monthly recurring tasks: "Edit `src/lib/accounting/[checkpoints-file-path].ts`: append entry..."
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:389`
- **Why it matters:** `[checkpoints-file-path]` is a placeholder; staff doesn't know the actual file. The real path is `src/lib/accounting/phase0-reconciliation-constants.ts`.
- **Remediation:** Replace `[checkpoints-file-path]` with the actual filename. Note also: the filename carries "phase0" — if the file is renamed in a future cleanup, runbook drifts. Worth a comment: "(currently named for its Phase 0 origin; rename folds with any future generalization)."

**Finding 2.8 — Cron registration playbook complete and concrete** — Informational
- **What:** §6 registration playbook for monthly-vat-close has concrete Coolify steps, exact schedule string, exact command with auth header, expected response shapes for smoke, halt signals enumerated. Mirrors PR #296 monthly-depreciation pattern.
- **Remediation:** None.

**Finding 2.9 — Calendar dates feasible** — Informational
- **What:** Appendix A has 24-48h breathing room between events (PR C merge 2 June → gate verification 3 June → backfill 4 June → stage 1 5-6 June). Stage 2 spans 8-10 June with stage 3 on 11 June. May PVN deklarācija deadline 20 June is within the post-stage-3 window. First cron fire 1 July targets June close.
- **Why it matters:** Calendar respects breathing-room refinement from earlier preamble + accommodates external deadlines.
- **Remediation:** None.

**Finding 2.10 — Manual action queue complete** — Informational
- **What:** §Manual Action Queue lists 12 actions in sequence. Owner per action (user vs system) labeled. Sequence dependencies respected (action 8 EveryPay settlements during stage 2 implies stage 2 has started per action 7).
- **Remediation:** None.

### Verdict: **Pass-with-followups**

Three Important findings (2.1 staging Supabase, 2.2/2.6 migration 110 missing from Gate 2, 2.5 Stage 3 transition under-specified) plus two Important (2.3 Gate 7 query, 2.7 file path placeholder) need correction before stage 1 executes. None block opening PR C for review.

---

## Lens 3 — Rollback procedure completeness

### Findings

**Finding 3.1 — All 7 signal classes have concrete thresholds** — Informational
- **What:** Classes A–G enumerated with specific thresholds: A "any single occurrence" of GL invariant breach; B "rate > 1/hour sustained 2h" for compliance gate misfire; etc.
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:299-307`
- **Remediation:** None.

**Finding 3.2 — Rollback procedure post-rollback verification only checks order path** — Minor
- **What:** §5 rollback step 4: "place a real order; check `journal_entries`; expect **no new entry**." Verifies only order completion. Cart, withdrawal, refund paths not explicitly tested.
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:253`
- **Why it matters:** If the env var flip somehow only takes effect for some wraps (race condition, partial deploy, sticky cache), the rollback could be incomplete and unnoticed. Verifying all 4 paths is belt-and-suspenders.
- **Remediation:** Optional. Add 3 more verification probes (cart payment, refund, withdrawal). Or accept that the env var is a single value and one verification is enough for the common case.

**Finding 3.3 — Reversal-entry SQL/RPC template documented but engineering-only** — Informational
- **What:** §5 includes a SQL template for reversal-entry construction. Explicitly labeled "engineering-time, until UI ships." Marked as Sentry-paged activity.
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:274-293`
- **Why it matters:** Honest about scope. Engineering-only is acceptable per the deferred-items framing.
- **Remediation:** None.

**Finding 3.4 — Resumption procedure brief but adequate** — Minor
- **What:** §"After rollback: next steps" mentions resume options ("back to stage 2 entry, or stage 3 entry if fix is small") but doesn't enumerate WHEN each is appropriate.
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:309-314`
- **Why it matters:** Under stress (post-rollback triage), staff might pick the wrong resume point.
- **Remediation:** Expand with a 2-question decision tree:
  - Did rollback expose a wrap-layer bug (one or more flows broken)? → return to stage 2 entry; re-burn-in all variants.
  - Did rollback expose a transient infra issue (Sentry, Coolify, DB)? → resume at stage 3 entry after infra is healed.

**Finding 3.5 — No concrete rollback walkthrough example** — Important
- **What:** The runbook describes the decision tree + procedure abstractly but doesn't walk through a hypothetical scenario end-to-end (e.g., "Class A fires at 02:14 UTC on day 4 of stage 3; what does the operator do step-by-step?").
- **Where:** `docs/operations/lifecycle-cutover-runbook.md:246-314`
- **Why it matters:** Under stress, abstract procedure is harder to follow than a concrete example. The post-cutover review described this as Important-not-Critical because the procedure itself is correct, just not battle-tested.
- **Remediation:** Add an "Example: Class A rollback at 02:14 UTC, day 4 of stage 3" subsection walking through:
  1. Sentry alert fires
  2. Operator pages engineering (?) or self-triages
  3. Verifies signal (which dashboard, which query)
  4. Decides to rollback (when within the decision authority)
  5. Flips env var via Coolify dashboard (specific menu path)
  6. Verifies rollback worked (the 4-path probe from 3.2)
  7. Captures incident in Appendix A "actual" column
  8. Opens issue/branch for the fix
  Estimated +50 LoC.

### Verdict: **Pass-with-followups**

Procedure is correct; one Important finding (3.5 no concrete walkthrough) and one Minor (3.4 resumption decision tree). Acceptable to open PR C; address 3.5 before stage 3 entry.

---

## Lens 4 — Deferred-items inventory

### Findings

**Finding 4.1 — Followups memory complete on tracked items** — Informational
- **What:** `pr_c_followups.md` captures: buyer-counterparty migration, CLAUDE.md state-machine drift, stale-in-flight threshold review, permissive Supabase mock builder, future C.x VID VAT payment, Q12-7a net_refund_cents legacy key, monthly-depreciation Layer 2 retrofit, deferred integration scenarios 4/5/12/17. Each entry has description + why + how-to-apply + target trigger.
- **Remediation:** None.

**Finding 4.2 — Runbook §8 deferred items align with pr_c_followups.md** — Informational
- **What:** Runbook §8 lists: reversal-entry UI (Q3 2026), buyer-counterparty migration, depreciation cron Layer 2, partial-refund wrap support, deferred integration scenarios, future VID interactions. All cross-referenced or duplicated in pr_c_followups.md.
- **Remediation:** None.

**Finding 4.3 — Three `TODO(post-launch)` comments in code not captured in followups** — Minor
- **What:** PR C scope contains 3 `TODO(post-launch)` comments not surfaced in `pr_c_followups.md`:
  - `src/lib/accounting/queries.ts:351` — pagination for `getAccountLedger`
  - `src/lib/accounting/checklist.ts:91` — paginating the ledger walk
  - `src/lib/accounting/checklist.ts:520` — items 4-7 could derive closing balances from item 1
- **Where:** Listed paths.
- **Why it matters:** Code-level deferrals not tracked in the followups memory; risk of being forgotten if the code is refactored.
- **Remediation:** Either:
  1. Add a single "Post-launch optimization TODOs" entry in `pr_c_followups.md` pointing to these three locations.
  2. Move the TODO content into the followups file inline.
  Recommend (1) — keeps code self-documenting + memory authoritative.

**Finding 4.4 — Reversal-entry staff UI is captured but not yet ticketed** — Minor
- **What:** Both runbook §8 and pr_c_followups.md mention "Reversal-entry staff UI (PR #4b)" with `blocker for rollback recovery only` framing. But there's no actual GitHub issue / Linear ticket created yet.
- **Where:** Memory + runbook.
- **Why it matters:** Without a ticket, the deferred work has no enforcement mechanism beyond memory. If the user forgets to create the ticket, it doesn't get done.
- **Remediation:** Create a GitHub issue OR Linear ticket titled "Reversal-entry staff UI (PR #4b)" with body cross-referencing the runbook §5 + §8 sections + pr_c_followups.md entry. User-actioned (shared-state-action discipline).

**Finding 4.5 — VID refund €0.30 from April PVN clearing — entry pattern not yet defined** — Minor
- **What:** pr_c_followups.md mentions "VID refund €0.30 from April PVN clearing — tracking only. Awaiting Swedbank deposit. When it lands, post via the existing C.x flow (likely a manual H.2 or similar adjustment entry)." But "likely H.2" isn't a decision; it's a placeholder.
- **Where:** `pr_c_followups.md` (the VID interactions section).
- **Why it matters:** When the deposit lands, staff doesn't have a recipe — they'd need to invent the entry shape at the moment.
- **Remediation:** Pre-decide the entry shape: H.2 (other / suspense reversal) or a new C.8 variant for VID-credits-arriving. Note: the entry is small (€0.30) so accountant tolerance for minor variation is high; could defer to "when it lands, decide with the accountant."

### Verdict: **Pass-with-followups**

No blocking gaps. Three Minor findings to track but nothing blocking PR C.

---

## Lens 5 — Documentation alignment

### Findings

**Finding 5.1 — CLAUDE.md cron-route registry includes monthly-vat-close** — Informational
- **What:** CLAUDE.md line 271 (cron-routes paragraph) includes a detailed entry for `monthly-vat-close` with schedule, source_doc_id pattern, layered idempotency notes. monthly-depreciation also listed.
- **Remediation:** None.

**Finding 5.2 — No new audit events should be registered for PR C** — Informational
- **What:** Spot-check confirms PR C didn't add new audit event types beyond the existing `accounting.posted` registered pre-PR-C. The `is_staff_test` gate work doesn't introduce new audit events.
- **Remediation:** None.

**Finding 5.3 — CLAUDE.md Accounting Module section gains runbook reference** — Informational
- **What:** Line 220 of CLAUDE.md adds: "Operational playbook: `docs/operations/lifecycle-cutover-runbook.md`..." Cross-reference to runbook is present.
- **Remediation:** None.

**Finding 5.4 — CLAUDE.md Accounting Module section doesn't surface `emission_source` or `is_staff_test` as top-level conventions** — Minor
- **What:** `emission_source` is mentioned within the cron-routes paragraph (line 271) and in code comments, but not in the Accounting Module section (lines 217-260) which carries the canonical engine convention summary. Similarly, `is_staff_test` is documented in the cutover runbook but not surfaced as a top-level convention in the Accounting Module section.
- **Where:** `CLAUDE.md:217-260`
- **Why it matters:** Discoverability. A new contributor reading CLAUDE.md to learn the engine wouldn't see these conventions called out top-level. They'd find them only by reading the cron-routes paragraph or the cutover runbook.
- **Remediation:** Add 2 sentences to the Accounting Module section:
  - "`emission_source` (typed top-level field on PostingEvent; values `'lifecycle'` | `'cron'` | `'staff_manual'` | `'backfill'`) stamps every entry's `posting_context` for reporting-view filtering."
  - "Stage-2 cutover gate: each lifecycle entity (orders, cart_checkout_groups, withdrawal_requests) carries `is_staff_test boolean`; the wrap callers gate engine emission on it during stage 2 (`isAccountingEngineEnabled() && entity.is_staff_test`). See `lifecycle-cutover-runbook.md` §3."
  ~10 LoC.

**Finding 5.5 — CLAUDE.md "Order Status State Machine" still missing `'refunded'`** — Important (carryover)
- **What:** CLAUDE.md state machine diagram shows `pending_seller → accepted → shipped → delivered → completed` plus `cancelled / disputed / resolved`. Actual enum in `src/lib/orders/types.ts:6-14` is `'pending_seller' | 'accepted' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'disputed' | 'refunded'` — diagram is missing `'refunded'` and has phantom `'resolved'`.
- **Where:** `CLAUDE.md:84-91`
- **Why it matters:** Documentation drift on a canonical reference. Surfaced during PR D plan-first preamble; captured in `pr_c_followups.md`. Not introduced by PR C but PR C work didn't clean it up despite the "small 5-min fix" framing.
- **Remediation:** Update the diagram to reflect actual types.ts enum. Drop `'resolved'`. Add `'refunded'` (terminal, reached from cancelled-with-refund + disputed-resolved-with-refund). ~10 LoC.

**Finding 5.6 — `accounting_conventions.md` §1-§8 complete** — Informational
- **What:** Memory file `accounting_conventions.md` contains §1 (account-balance signed), §2 (type-catalog coupling), §3 (GL-emit-first vs state-first), §4 (SQL-side guard discipline), §5 (UI field-addition scope), §6 (optional-text-input normalization), §7 (vitest mock typing), §8 (layered idempotency). All sections present.
- **Remediation:** None.

**Finding 5.7 — `dependencies.md` doesn't need PR C updates** — Informational
- **What:** PR C is internal architecture (engine, wraps, RPCs, runbook). No new external services added. Existing sections (Infrastructure, Payments, Shipping, Email, External APIs, Domain, Auth, Monitoring, Analytics, Dev Tools) remain accurate.
- **Remediation:** None.

**Finding 5.8 — `deployment-state-audit-2026-05-12.md` forward-references runbook** — Informational
- **What:** Audit doc line 11 has a "Superseded operational guidance" callout pointing to `lifecycle-cutover-runbook.md` as the canonical playbook.
- **Remediation:** None.

**Finding 5.9 — Migration directory tidy** — Informational
- **What:** `supabase/migrations/` has 108, 109, 110 sequential. No gaps. Filenames descriptive. No drafts.
- **Remediation:** None.

### Verdict: **Pass-with-followups**

One Important finding (5.5 state-machine drift) carried over from before PR C. Could have been bundled into PR C as a 10-LoC drive-by fix; user decision whether to land in this PR or as a separate small commit.

---

## Lens 6 — Other observations (not fitting the five lenses)

**Finding 6.1 — Branch contains 1 PR D merge (655777a) within the diff against main HEAD** — Informational
- **What:** `git log main..HEAD` shows 13 commits. The reviewer prompt described "10 implementation + 1 doc"; actual count is 12 PR C commits + 1 PR D merge (`655777a feat(accounting): PR D — period-close item 4 reconciliation gate (5590) (#297)`) listed BEFORE the PR C commits. PR D landed on main before this review.
- **Where:** Branch history.
- **Why it matters:** Just an inventory note. PR D is on main; PR C is stacked above. When PR C merges, no double-counting.
- **Remediation:** None.

**Finding 6.2 — vitest.integration.config.ts adds `server-only` stub for integration tests** — Informational
- **What:** Commit d1aff59 added `'server-only'` alias to the integration vitest config so server-only-guarded modules can be imported during integration test setup. Mirrors the unit-test config alias.
- **Remediation:** None. Convention preserved across both configs.

**Finding 6.3 — Total commit count for PR C** — Informational
- **What:** PR C contains 12 commits: 9, 10, 11a, 11b, 12, 12-audit, 13, fix-1 (consumption_ms), fix-2 (wrap-branch units), 14 (runbook), Gate-9 fix (commit 73053f6), runbook SHA stamp (13fd363). That's 12.
- **Remediation:** None.

### Verdict: **Pass**

---

## Summary

| Lens | Verdict | Critical | Important | Minor | Informational |
|---|---|---|---|---|---|
| 1 | Pass-with-followups | 1 | 1 | 2 | 5 |
| 2 | Pass-with-followups | 0 | 5 | 1 | 2 |
| 3 | Pass-with-followups | 0 | 1 | 2 | 2 |
| 4 | Pass-with-followups | 0 | 0 | 3 | 2 |
| 5 | Pass-with-followups | 0 | 1 | 1 | 7 |
| 6 | Pass | 0 | 0 | 0 | 3 |
| **Total** | **Pass-with-followups** | **1** | **8** | **9** | **21** |

---

## Recommendation

**Address Finding 1.3a (refund RPC idempotency guard) before merging PR C.** It's the sole Critical finding; the fix is small (~30 LoC + 1 unit test) and closes a real pattern-drift bug.

**Address Findings 2.2 / 2.6 (migration 110 missing from Gate 2), 2.5 (Stage 3 transition under-specified), and 2.7 (BANK_WALK_CHECKPOINTS placeholder) before stage 1 execution.** These are runbook fixes; they don't block opening PR C for review but staff will need them to execute the cutover.

**Open PR C now for review** with the above findings noted in the PR description. The PR can stay open while the small fixes land as additional commits. Critical 1.3a should land first; Important runbook fixes can bundle into a single small commit.

### Recommended remediation order

1. **Commit 1 — refund RPC idempotency guard** (Finding 1.3a). ~30 LoC. Pattern alignment.
2. **Commit 2 — runbook corrections** (Findings 2.2, 2.5, 2.6, 2.7; optionally 2.3 + 5.5). ~30 LoC markdown. Bundles the operational fixes.
3. **Optional commit 3 — CLAUDE.md cleanups** (Finding 5.5 state-machine, 5.4 emission_source / is_staff_test top-level). ~20 LoC. Bundles documentation cleanups.

Total remediation: ~80 LoC across 2-3 small commits. Could land in a single afternoon.

### What does NOT block opening PR C

- Findings 1.1, 1.2, 1.9 (wrap signature asymmetries; defensible per-wrap differences)
- Finding 1.5 (test_artifact convention drift; CLAUDE.md wording fix at most)
- Finding 2.1 (staging Supabase project existence — operational verification, not code)
- Findings 3.x rollback minor + informational
- Findings 4.x deferred items (everything tracked or trackable)
- Findings 5.x documentation (most informational; one carryover from pre-PR-C)
- All Minor + Informational findings across all lenses

These can land post-merge or as scheduled cleanups.

### Reviewer note

Self-review is no substitute for a second pair of eyes. If `/ultrareview` or a peer review pass is desired before opening PR C, that's complementary. This review's discipline is "what could I find in a focused read against the five lenses" — by construction it can miss things outside those lenses.
