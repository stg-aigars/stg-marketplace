# April 2026 backfill closing trial balance (30.04.2026)

**Production run:** 2026-05-12. PR [#293](https://github.com/stg-aigars/stg-marketplace/pull/293). Period `2026-04` **hard-locked** 2026-05-12 10:40:14 UTC.

11 journal entries reconstructing STG's marketplace + vendor GL activity for April 2026 ahead of the PVN deklarācija filing deadline (20.05.2026): 9 marketplace+vendor entries, 1 monthly depreciation, 1 P.1 VAT consolidation close. Continues the chain established by [phase0-backfill-closing-tb-2026-03-31.md](phase0-backfill-closing-tb-2026-03-31.md) (Phase 0 closed 31.03.2026 hard-locked).

Each entry is queryable via `journal_entries.source_doc_id LIKE 'april_2026_entry_%'` (9 entries), `source_doc_id = 'phase0_entry_21'` (April depreciation, continues the Phase 0 chain at N=21), or `source_doc_id = 'close_2026_04'` (April P.1 consolidation). All 11 entries carry `posting_context.backfill = true`.

## April 2026 entries (11)

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
| 11| `close_2026_04`            | 2026-04-30 | P.1     | April P.1 VAT consolidation — clears 5710-LV-IN €0.68 + 5710-LV-OUT €0.38; books €0.30 refund to 2380 |

## Closing trial balance @ 30.04.2026 (cents)

Post-close_2026_04: LV VAT sub-accounts cleared to zero; €0.30 net refund position sits on `2380` (VID receivable). Foreign RC pair persists long-term per Phase 0 convention.

| Account | Net debit (cents) | Net debit (€) | Description |
|---|---:|---:|---|
| **Assets** | | | |
| 1230 | +151,140 | +€1,511.40 | C&C MacBook Pro 14" M5 (unchanged from Phase 0; no fixed-asset activity in April) |
| 1239 | −12,594 | −€125.94 | Accumulated depreciation (3 months × €41.98) |
| 2380 | +30 | **+€0.30** | VID refund receivable from April P.1 (was 0 pre-close; €13.05 January receivable previously cleared by Phase 0 Entry 18) |
| 2610 | +44,931 | **+€449.31** | Swedbank operating account — matches Swedbank statement 30.04.2026 |
| **Equity** | | | |
| 3110 | −100 | −€1.00 | Share capital (unchanged) |
| 3420 | +13,196 | +€131.96 | Retained earnings (2025 closed loss; 2026 P&L not closed until 31.12.2026 P.7) |
| **Liabilities** | | | |
| 5310-HE | 0 | €0.00 | Hetzner AP — booked + paid in April, nets zero |
| 5310-UN | −390 | −€3.90 | Unisend AP — April invoice booked; payment forward-flagged to May 2026 backfill |
| 5340 | −215,000 | −€2,150.00 | Related-party loans (3 from Aigars Greninš; unchanged) |
| 5351 | −90 | −€0.90 | Seller wallet (Aigars's LV-side seller account €0.90 unwithdrawn; EE test seller withdrew via E8) |
| 5590 | 0 | €0.00 | Suspense — released cleanly by O.x completions |
| **VAT** | | | |
| 5710-LV-IN | 0 | €0.00 | Cleared by close_2026_04 P.1 (was +€0.68 pre-close from Unisend) |
| 5710-LV-RC-IN | 0 | €0.00 | (no domestic RC activity in April) |
| 5710-LV-RC-OUT | 0 | €0.00 | |
| 5710-LV-OUT | 0 | €0.00 | Cleared by close_2026_04 P.1 (was −€0.38 pre-close from 9UC5) |
| 5710-RC-IN | +778 | +€7.78 | Cumulative: €7.38 (Dec 2025 H.1 catchup) + €0.40 (April Hetzner RC self-assessment); foreign RC stays on balance sheet long-term |
| 5710-RC-OUT | −778 | −€7.78 | Symmetric |
| 5712 | −64 | **−€0.64** | OSS-EE Q2 2026 (HVFJ April only; remits to EE consumption MS by 31.07.2026; P.1 does not clear OSS) |
| **P&L (2026 YTD only — closed to 3420 at 31.12.2026 P.7)** | | | |
| 6310-C | −16 | −€0.16 | Commission revenue (2 orders × €0.08 net) |
| 6310-S | −432 | −€4.32 | Shipping-mgmt revenue (HVFJ €2.58 + 9UC5 €1.74 net) |
| 7610 | +12,594 | +€125.94 | YTD depreciation (3 months × €41.98) |
| 7710 | +65 | +€0.65 | Phase 0 Jan FX commission €0.57 + April Swedbank POS DAR €0.08 |
| 7720 | +322 | +€3.22 | Unisend shipping cost (net of VAT) |
| 7730 | +191 | +€1.91 | Hetzner IT/SaaS (net of VAT) |
| 7740 | +5,931 | +€59.31 | Phase 0 VINCIT (unchanged — no April domain/hosting activity) |
| 7770 | +286 | +€2.86 | Phase 0 C&C levy + Mollie verification (unchanged) |

**Σ debits = Σ credits = 229,464 cents = €2,294.64** (all 34 GL entries through 30.04.2026 balance to the cent).

## April PVN deklarācija outputs (for EDS submission, deadline 20.05.2026)

The April P.1 consolidation cleared the LV VAT sub-accounts and consolidated the refund position to 2380. For EDS submission, two equivalent views of the same refund:

**Period activity view** (the deklarācija line items themselves):
- **Output VAT (5710-LV-OUT April debit/credit movement):** **€0.38** — from 9UC5 LV B2C completion on Apr 20 → PVN deklarācija line 52
- **Input VAT (5710-LV-IN April debit/credit movement):** **€0.68** — from Unisend invoice on Apr 30 → PVN deklarācija line 62
- **Net position:** **€0.30 refund** owed by VID to STG

**Closing-balance view** (what currently sits in the GL after P.1):
- **2380 cumulative @ 30.04.2026:** **€0.30** — the asset row carrying the receivable until VID wires the refund

**Foreign RC pair (informational, PVN-1 lines 56/57):** €0.40 in / €0.40 out (April Hetzner; net cash impact zero, balance-sheet line carries cumulatively).

Query the period activity for the deklarācija filing:

```sql
select jl.account_code,
       sum(jl.credit_cents - jl.debit_cents) as net_credit_cents
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
 where jl.account_code in ('5710-LV-IN','5710-LV-OUT')
   and je.accounting_period = '2026-04'
   and je.source_doc_id != 'close_2026_04'  -- exclude the close itself; we want raw activity
 group by jl.account_code;
```

Expected: `5710-LV-IN` = −68 (debit €0.68 input from Unisend); `5710-LV-OUT` = +38 (credit €0.38 output from 9UC5).

## OSS-EE Q2 2026 (deadline 31.07.2026; submitted via OSS portal, not on PVN deklarācija)

- **5712 cumulative @ 30.04.2026:** **€0.64** — from HVFJ EE B2C completion (Apr 20)
- May + June 2026 OSS-EE activity will accumulate further; Q2 close + remit happens after the June 2026 backfill lands. P.1 monthly consolidation does NOT clear OSS-EE; quarterly remittance is tracked separately.

## Audit & compliance trail

- All **11** `accounting.posted` audit events present in `audit_log` with `retention_class = 'regulatory'` (10-year retention per `audit_log` schema). Verified via `select count(*) from public.audit_log where action='accounting.posted' and metadata->>'accounting_period'='2026-04'` → 11.
- Production-run logs (initial): 10 created, 0 idempotent_skip, 0 failed; reconciliation PASS in 3.3s. **Initial run aborted** at counterparty seed step on first attempt due to an invalid-hex UUID in the LV seller CP id — caught by the Supabase UUID type validator before any journal entries posted. Fixed in the same branch; re-run succeeded cleanly. No rollback needed.
- Production-run logs (P.1 close): 1 created (`close_2026_04` entry_id `6f1a636d-342a-4eea-a8e0-711d1b6545a1`), 10 idempotent_skip, 0 failed; reconciliation PASS in 2.1s.
- **Period 2026-04 lock state:**
  - Soft-locked 2026-05-12 10:40:08 UTC by staff user `4de8f2b5-2418-48f7-b4c7-cf2b63790f49` (Aigars), audit_log action `accounting.period_status_changed` (`open` → `soft_locked`), regulatory retention.
  - Hard-locked 2026-05-12 10:40:14 UTC (6 seconds later) by same user via `hard_lock_period_atomic` RPC. Audit_log action `accounting.period_status_changed` (`soft_locked` → `hard_locked`), regulatory retention.
  - Future writes to 2026-04 are blocked by the period-status trigger; corrections require posting reversal entries to a different open period.

## Seller counterparty resolution

`counterparties.user_id` FK targets `auth.users(id)` (not `user_profiles`) with `ON DELETE SET NULL`. Both April marketplace sellers' `auth.users` rows exist — STG's deletion architecture is anonymize-not-delete (see [memory/account_deletion_architecture.md](../../auth_architecture.md)), so we link `counterparty.user_id` directly to the real `auth.users.id` and mirror `full_name` from `user_profiles` exactly.

| user_id           | full_name (mirrored from user_profiles) | country | Notes |
|-------------------|----------------------------------------|---------|-------|
| `ce905240-…`       | `Deleted User`                         | EE      | Anonymized test account (auth.users email pattern `deleted-…@deleted.local`). Withdrew €0.90 via E8; closing wallet balance = 0. |
| `630f6e7f-…`       | `Aigars Grēniņš`                       | LV      | **Aigars's real auth account** (auth.users email `aigars.grenins@gmail.com`). €0.90 wallet balance on 9UC5 completion remains pending withdrawal. |

`legal_compliance_status='ok'` on both CPs passes the C.4 KYC gate at [posting-engine.ts:187-194](../../src/lib/accounting/posting-engine.ts#L187-L194).

> **Retraction note:** An earlier version of this snapshot (commit `cdcea4d`) framed both sellers as "absent from `user_profiles` and `counterparties`" and described the lazy CPs as "deleted-seller placeholders" with `user_id=null`. That framing was **incorrect** — it was based on a misread of a `[]` SELECT result that was itself poisoned by a prior failed query in the same transaction. Both `user_profiles` rows exist; the FK on `counterparties.user_id` references `auth.users` (not `user_profiles`) so the linkage was always available. Corrected via DB UPSERT on 2026-05-12; code commit `4d8c794` synced the data file to match. Production journal entries E4 + E6 + E8 retain a legacy `posting_context.deleted_seller_user_id` key from that draft (immutable per journal_entries trigger; the value itself is the correct user_id, only the key name is a misnomer).

## Source documents

> **This snapshot supersedes the kickoff doc as the source of truth for current April 2026 GL state.** The original `april-2026-backfill-kickoff.md` had drifted account codes (1230 ≠ bank; 5390/5520 ≠ codebase; conflated 2026 P&L with 3420) and named C.6 instead of C.2 for BL-rail cart receipts; corrections applied during round 1 + round 2 preamble. The kickoff doc also implicitly assumed VAT consolidation would not be required for soft-lock; this discovery during round 3 added the 11th entry (close_2026_04 P.1) and the per-month bank-walk checkpoint extension (PR #293 commits `9541f1b` and `cc71ba9` respectively).

- Backfill data table: [scripts/april-2026-backfill-data.ts](../../scripts/april-2026-backfill-data.ts).
- Reconciliation harness: [scripts/april-2026-backfill-reconcile.ts](../../scripts/april-2026-backfill-reconcile.ts).
- Runner script: [scripts/april-2026-backfill.ts](../../scripts/april-2026-backfill.ts).
- I.7 type definition: [src/lib/accounting/mapping.ts](../../src/lib/accounting/mapping.ts) (search `id: 'I.7'`).
- Predecessor snapshot: [phase0-backfill-closing-tb-2026-03-31.md](phase0-backfill-closing-tb-2026-03-31.md).

## Per-seller wallet distribution queries

The `/staff/accounting/wallet-integrity` UI shows per-seller mismatches only; reconciled balances are aggregate-only. Use these SQL snippets for the per-seller snapshot. (Wallet-distribution UI gap tracked for PR C commit 11; until then these are the operator path.)

**Snapshot at a closing date** — every non-zero wallet/GL pairing through `<as_of_date>`:

```sql
with gl_by_cp as (
  select jl.counterparty_id,
         sum(jl.credit_cents - jl.debit_cents) as gl_balance_cents
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
   where jl.account_code = '5351'
     and je.posting_date <= '<as_of_date>'
   group by jl.counterparty_id
)
select coalesce(up.full_name, '(orphan user)') as seller,
       up.country,
       w.user_id,
       cp.id as counterparty_id,
       w.balance_cents as wallet_cents,
       gl.gl_balance_cents as gl_cents,
       (gl.gl_balance_cents - w.balance_cents) as delta_cents
  from public.wallets w
  full outer join public.user_profiles up on up.id = w.user_id
  full outer join public.counterparties cp on cp.user_id = w.user_id
  full outer join gl_by_cp gl on gl.counterparty_id = cp.id
 where coalesce(w.balance_cents, 0) <> 0 or coalesce(gl.gl_balance_cents, 0) <> 0
 order by seller;
```

**Result at 30.04.2026:**

| seller          | country | wallet_cents | gl_cents | delta_cents |
|-----------------|---------|-------------:|---------:|------------:|
| Aigars Grēniņš  | LV      | 90           | 90       | 0           |

Sign convention: `gl_cents` is credit-normal on 5351 (positive = STG owes the seller). The EE test seller (`ce905240`) doesn't appear — both wallet and GL net to zero after the WD-2026-00001 withdrawal.

**To include all sellers (even zero-balance rows)** — drop the `WHERE coalesce... <> 0` clause.

## How PR #4 should use this

1. **Trial-balance view default**: include backfill entries (`posting_context->>'backfill' = 'true'` on by default; UI offers a toggle).
2. **Tie-out test**: any trial-balance query restricted to `posting_date <= '2026-04-30'` should produce the table above. Use as a regression check.
3. **Period 2026-04 status**: hard-locked. Future entries cannot post here without posting a reversal entry to a different open period.
