# Phase 0 backfill closing trial balance (31.03.2026)

**Production run:** 2026-05-09 16:14:15 UTC. PR [#281](https://github.com/stg-aigars/stg-marketplace/pull/281).

23 historical journal entries reconstructing STG's GL state from SIA founding (May 2025) through 31.03.2026 — emitted via the PR #2 posting engine, reconciled against Swedbank statements per `stg-phase-0-backfill-execution-v2.md`. Each entry is queryable via `journal_entries.source_doc_type = 'phase0_backfill'`.

This snapshot is the PR #4 trial-balance / P&L view's known-good baseline. PR #5's lifecycle integration must not mutate any line below — historical periods (2025-07 → 2026-03) should be soft-locked or hard-locked before live activity begins.

## Closing trial balance (cents)

| Account | Net debit (cents) | Net debit (€) | Description |
|---|---:|---:|---|
| **Assets** | | | |
| 1230 | +151,140 | +€1,511.40 | C&C MacBook Pro 14" M5 (capitalized 20.01.2026) |
| 1239 | −8,396 | −€83.96 | Accumulated depreciation (2 months × €41.98) |
| 2380 | 0 | €0.00 | VID receivable (cleared by Entry 18 on 2026-02-24) |
| 2610 | +44,490 | **+€444.90** | Swedbank operating account (matches statement) |
| **Equity** | | | |
| 3110 | −100 | −€1.00 | Share capital |
| 3420 | +13,196 | +€131.96 | Retained earnings (2025 closed loss; debit balance) |
| **Liabilities** | | | |
| 5340 | −215,000 | −€2,150.00 | Related-party loans (3 from Aigars Greninš) |
| **VAT** | | | |
| 5710-LV-IN | 0 | €0.00 | Cleared by January 2026 P.1 close |
| 5710-LV-RC-IN | 0 | €0.00 | Cleared by January 2026 P.1 close |
| 5710-LV-RC-OUT | 0 | €0.00 | Cleared by January 2026 P.1 close |
| 5710-RC-IN | +738 | +€7.38 | Persists from Entry 12 (December 2025 H.1 catch-up) |
| 5710-RC-OUT | −738 | −€7.38 | Persists from Entry 12 (December 2025 H.1 catch-up) |
| **P&L (2026 YTD only — 2025 closed by P.7 on 31.12.2025)** | | | |
| 7610 | +8,396 | +€83.96 | 2026 YTD depreciation |
| 7710 | +57 | +€0.57 | January 2026 Swedbank FX commission (Mollie outbound) |
| 7730 | 0 | €0.00 | No 2026 SaaS yet (2025 closed by P.7) |
| 7740 | +5,931 | +€59.31 | January 2026 VINCIT net |
| 7770 | +286 | +€2.86 | C&C data carrier levy + Mollie verification |

**Σ debits = Σ credits = 224,234 cents = €2,242.34** (all 23 entries balance to the cent).

**Accumulated deficit through 31.03.2026:**
- 2025 closed loss carried to 3420: €131.96 (debit)
- 2026 YTD net loss (depreciation €83.96 + processing €0.57 + domain €59.31 + other €2.86 = €146.70)
- Cumulative deficit: **€278.66**

## Audit & compliance trail

- All 23 `accounting.posted` audit events present in `audit_log` with `retention_class = 'regulatory'` (10-year retention per `audit_log` schema).
  - 23 of those carry `metadata.backfilled_audit_event = true` and `metadata.backfill_reason = 'phase0_runner_env_load_order_bug_2026_05_09'` because the engine's fire-and-forget audit path threw on the original run (env-load-order bug, fixed in same-day commit). The journal_entries themselves were unaffected; the audit_log gap was closed via direct INSERT before this snapshot was captured.

## Source documents

- Phase 0 v2 spec: `stg-phase-0-backfill-execution-v2.md` (with PR #281's corrections: H.2 is FX-aware; Entry 11 routes to H.2 not I.4; account naming uses 5710-* not 5721-* and 2380 not 2310-VID).
- Backfill data table: [scripts/phase0-backfill-data.ts](../../scripts/phase0-backfill-data.ts).
- Reconciliation harness: [scripts/phase0-backfill-reconcile.ts](../../scripts/phase0-backfill-reconcile.ts).
- Runner script: [scripts/phase0-backfill.ts](../../scripts/phase0-backfill.ts).

## How PR #4 should use this

1. **Trial-balance view default**: include backfill entries (filter `posting_context->>'backfill' = 'true'` is on by default; UI offers a toggle to exclude them for "current activity only" views).
2. **Tie-out test**: any trial-balance query restricted to `posting_date <= '2026-03-31'` AND `source_doc_type = 'phase0_backfill'` should produce the table above. Use this as a regression check when shipping the trial-balance UI.
3. **PR #5 invariant**: lifecycle entries (orders, refunds, payouts) must NOT post to periods 2025-07 through 2026-03. Soft-lock or hard-lock those periods after PR #4's period-close UI ships.
