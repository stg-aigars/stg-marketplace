# April 2026 backfill closing trial balance (30.04.2026)

**Production run:** 2026-05-12. PR [#293](https://github.com/stg-aigars/stg-marketplace/pull/293).

10 journal entries reconstructing STG's marketplace + vendor GL activity for April 2026 ahead of the PVN deklarācija filing deadline (20.05.2026). Continues the chain established by [phase0-backfill-closing-tb-2026-03-31.md](phase0-backfill-closing-tb-2026-03-31.md) (Phase 0 closed 31.03.2026 hard-locked).

Each entry is queryable via `journal_entries.source_doc_id LIKE 'april_2026_entry_%'` (9 entries) or `source_doc_id = 'phase0_entry_21'` (April depreciation, continues the Phase 0 chain at N=21). All entries carry `posting_context.backfill = true`.

## April 2026 entries (10)

| # | source_doc_id              | Date       | type_id | Description |
|---|----------------------------|------------|---------|-------------|
| 1 | `april_2026_entry_1`       | 2026-04-04 | I.3     | Hetzner €1.91 EU B2B RC invoice (DE → LV self-assessment 21%) |
| 2 | `april_2026_entry_2`       | 2026-04-07 | I.7     | Hetzner €1.91 payment settlement (first use of `vendor.payment_made` type) |
| 3 | `april_2026_entry_3`       | 2026-04-15 | C.2     | HVFJ cart €4.20 BL-rail receipt (PIS direct to Swedbank) |
| 4 | `april_2026_entry_4`       | 2026-04-20 | O.5     | HVFJ order completion (EE B2C OSS, 24%; VAT €0.64 to 5712) |
| 5 | `april_2026_entry_5`       | 2026-04-15 | C.2     | 9UC5 cart €3.10 BL-rail receipt |
| 6 | `april_2026_entry_6`       | 2026-04-20 | O.1     | 9UC5 order completion (LV B2C, 21%; VAT €0.38 to 5710-LV-OUT) |
| 7 | `april_2026_entry_7`       | 2026-04-16 | I.5     | Swedbank POS DAR €0.08 (PVN likums Article 52 exempt) |
| 8 | `april_2026_entry_8`       | 2026-04-20 | C.4     | WD-2026-00001 €0.90 — HVFJ seller wallet withdrawal |
| 9 | `april_2026_entry_9`       | 2026-04-30 | I.1     | Unisend €3.90 LV-standard invoice (May payment forward-flagged) |
| 10| `phase0_entry_21`          | 2026-04-30 | P.6     | April depreciation €41.98 (month 3 of 36; continues phase0_entry chain) |

## Closing trial balance @ 30.04.2026 (cents)

| Account | Net debit (cents) | Net debit (€) | Description |
|---|---:|---:|---|
| **Assets** | | | |
| 1230 | +151,140 | +€1,511.40 | C&C MacBook Pro 14" M5 (unchanged from Phase 0; no fixed-asset activity in April) |
| 1239 | −12,594 | −€125.94 | Accumulated depreciation (3 months × €41.98) |
| 2380 | 0 | €0.00 | VID receivable (cleared by Phase 0 Entry 18 on 2026-02-24) |
| 2610 | +44,931 | **+€449.31** | Swedbank operating account — matches Swedbank statement 30.04.2026 |
| **Equity** | | | |
| 3110 | −100 | −€1.00 | Share capital (unchanged) |
| 3420 | +13,196 | +€131.96 | Retained earnings (2025 closed loss; 2026 P&L not closed until 31.12.2026 P.7) |
| **Liabilities** | | | |
| 5310-HE | 0 | €0.00 | Hetzner AP — booked + paid in April, nets zero |
| 5310-UN | −390 | −€3.90 | Unisend AP — April invoice booked; payment forward-flagged to May 2026 backfill |
| 5340 | −215,000 | −€2,150.00 | Related-party loans (3 from Aigars Greninš; unchanged) |
| 5351 | −90 | −€0.90 | Seller wallet (9UC5 LV seller €0.90 unwithdrawn; HVFJ EE seller withdrawn via E8) |
| 5590 | 0 | €0.00 | Suspense — released cleanly by O.x completions |
| **VAT** | | | |
| 5710-LV-IN | +68 | **+€0.68** | April input VAT (Unisend) → PVN deklarācija line 62 |
| 5710-LV-RC-IN | 0 | €0.00 | (no domestic RC activity in April) |
| 5710-LV-RC-OUT | 0 | €0.00 | |
| 5710-LV-OUT | −38 | **−€0.38** | April output VAT (9UC5 LV B2C) → PVN deklarācija line 52 |
| 5710-RC-IN | +778 | +€7.78 | Cumulative: €7.38 (Dec 2025 H.1 catchup) + €0.40 (April Hetzner RC self-assessment) |
| 5710-RC-OUT | −778 | −€7.78 | Symmetric |
| 5712 | −64 | **−€0.64** | OSS-EE Q2 2026 (HVFJ April only; remits to EE consumption MS by 31.07.2026) |
| **P&L (2026 YTD only — closed to 3420 at 31.12.2026 P.7)** | | | |
| 6310-C | −16 | −€0.16 | Commission revenue (2 orders × €0.08 net) |
| 6310-S | −432 | −€4.32 | Shipping-mgmt revenue (HVFJ €2.58 + 9UC5 €1.74 net) |
| 7610 | +12,594 | +€125.94 | YTD depreciation (3 months × €41.98) |
| 7710 | +65 | +€0.65 | Phase 0 Jan FX commission €0.57 + April Swedbank POS DAR €0.08 |
| 7720 | +322 | +€3.22 | Unisend shipping cost (net of VAT) |
| 7730 | +191 | +€1.91 | Hetzner IT/SaaS (net of VAT) |
| 7740 | +5,931 | +€59.31 | Phase 0 VINCIT (unchanged — no April domain/hosting activity) |
| 7770 | +286 | +€2.86 | Phase 0 C&C levy + Mollie verification (unchanged) |

**Σ debits = Σ credits = 229,502 cents = €2,295.02** (all 33 GL entries through 30.04.2026 balance to the cent).

## April PVN deklarācija outputs (for EDS submission, deadline 20.05.2026)

- **Output VAT (5710-LV-OUT April delta):** **€0.38** — from 9UC5 LV B2C completion (Apr 20)
- **Input VAT (5710-LV-IN April delta):** **€0.68** — from Unisend invoice (Apr 30)
- **Net position:** **€0.30 refund** owed by VID to STG
- **Foreign RC pair (informational, PVN-1 lines 56/57):** €0.40 in / €0.40 out (April Hetzner; net cash impact zero)

## OSS-EE Q2 2026 (deadline 31.07.2026; submitted separately via OSS portal, not on PVN deklarācija)

- **5712 cumulative @ 30.04.2026:** **€0.64** — from HVFJ EE B2C completion (Apr 20)
- May + June 2026 OSS-EE activity will accumulate further; Q2 close + remit happens after the June 2026 backfill lands.

## Audit & compliance trail

- All 10 `accounting.posted` audit events present in `audit_log` with `retention_class = 'regulatory'` (10-year retention per `audit_log` schema). Verified via `select count(*) from public.audit_log where action='accounting.posted' and metadata->>'accounting_period'='2026-04'` → 10.
- Production-run logs: 10 created, 0 idempotent_skip, 0 failed; reconciliation PASS in 3.3s.
- Initial run attempt aborted at counterparty seed step due to an invalid-hex UUID in the LV deleted-seller CP id — caught by the Supabase UUID type validator before any journal entries posted. Fixed in the same branch; re-run succeeded cleanly. Documented for traceability; no rollback was needed.

## Deleted-seller counterparty resolution

The two April marketplace sellers (`ce905240-…-EE` and `630f6e7f-…-LV`) are both absent from `user_profiles` and `counterparties` at backfill time. `counterparties.user_id` FK is `ON DELETE SET NULL`, so the CP rows cannot link back to the deleted `auth.users` ids. Traceability is preserved via three mechanisms:

- `full_name` carries the user-id suffix (`"Deleted seller ce905240… (EE)"`, `"Deleted seller 630f6e7f… (LV)"`).
- `posting_context.deleted_seller_user_id` on every journal line touching the deleted CP (Entries 4, 6, 8) holds the original `auth.users.id`.
- Constants `ORIGINAL_USER_ID_EE_SELLER` / `ORIGINAL_USER_ID_LV_SELLER` exported from [scripts/april-2026-backfill-data.ts](../../scripts/april-2026-backfill-data.ts) make the original ids machine-readable.

`legal_compliance_status='ok'` on the lazy-created CPs preserves the historical state at withdrawal completion time so the C.4 KYC gate at [posting-engine.ts:187-194](../../src/lib/accounting/posting-engine.ts#L187-L194) passes cleanly.

## Source documents

> **This snapshot supersedes the kickoff doc as the source of truth for current April 2026 GL state.** The original `april-2026-backfill-kickoff.md` had drifted account codes (1230 ≠ bank; 5390/5520 ≠ codebase; conflated 2026 P&L with 3420) and named C.6 instead of C.2 for BL-rail cart receipts; corrections applied during round 1 + round 2 preamble.

- Backfill data table: [scripts/april-2026-backfill-data.ts](../../scripts/april-2026-backfill-data.ts).
- Reconciliation harness: [scripts/april-2026-backfill-reconcile.ts](../../scripts/april-2026-backfill-reconcile.ts).
- Runner script: [scripts/april-2026-backfill.ts](../../scripts/april-2026-backfill.ts).
- I.7 type definition: [src/lib/accounting/mapping.ts](../../src/lib/accounting/mapping.ts) (search `id: 'I.7'`).
- Predecessor snapshot: [phase0-backfill-closing-tb-2026-03-31.md](phase0-backfill-closing-tb-2026-03-31.md).

## How PR #4 should use this

1. **Trial-balance view default**: include backfill entries (`posting_context->>'backfill' = 'true'` on by default; UI offers a toggle).
2. **Tie-out test**: any trial-balance query restricted to `posting_date <= '2026-04-30'` should produce the table above. Use as a regression check.
3. **Period 2026-04 status**: soft-locked then hard-locked after this snapshot was captured. Future entries cannot post here without `period_close_adjustment=true` (during soft-lock) or a reversal entry (after hard-lock).
