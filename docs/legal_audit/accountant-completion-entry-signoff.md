# Accountant sign-off: O.x completion-entry composition addendum

**Version:** v1.4
**Sign-off date:** 12 May 2026 (verbal approval; written confirmation in flight)
**Status:** Approved for PR #5 lifecycle integration. **Pre-staging-burn-in gate closed.**
**Frozen snapshot for v1.3:** `accountant-completion-entry-signoff-v1.3.md` (parallel filename per audit-trail convention; preserves v1.3 content for historical reference).
**Frozen snapshot for v1.4:** pending written confirmation insertion.

## Changelog

- **v1.4** (12 May 2026) — **Per-order Unisend accrual dropped.** Removed Dr 7720 + Cr 5410-UN from the completion entry; Unisend cost recognized only at monthly invoice receipt via the existing I.1 vendor-invoice flow. **Completion entry simplified to 5 lines** (4 for B2B RC). No per-order accrual reduces both implementation surface (no `unisend_cost_cents` payload key, no new orders column) and aggregate-reconciliation complexity (the I.1 wash flow does not have to net per-order accruals against the monthly invoice). The v1.3 STG-as-principal framing is preserved for the cost-recognition dimension — STG records the Unisend expense at I.1 receipt time, not at completion. `seller_net = item_value − commission_gross` formula unchanged from v1.3. Verbal approval from accountant 12 May 2026; written confirmation document in flight; this section marked pending verbatim insertion.
- **v1.3** (11 May 2026) — Agency model accepted. STG as principal in shipping contract; Dr 7720 + Cr 5410-UN per-order accrual at completion. **Superseded by v1.4** (per-order accrual dropped).
- **v1.2** (10 May 2026) — Two corrections from the round-3 draft: (1) shipping-expense lines reference account `7720` (Piegādes/loģistikas izmaksas) per [migration 096 line 94](../../supabase/migrations/096_accounting_seeds.sql#L94). (2) Decomposition methodology is VAT-inclusive, not VAT-exclusive (now superseded by v1.3's agency framing on cost recognition).
- **v1.1** — Internal revision pass (superseded).
- **v1.0** — Initial round-3 §B draft (superseded).

## Context

The v3 mapping table (`stg-vat-mapping-table-v3.md`) §A.1–§A.5 show O.1–O.5 posting rules with only the **invoice slice** — four lines covering wallet debit, revenue credits, and output VAT. The **full O.x completion entry under v1.3** is **seven lines**, combining the invoice slice with suspense release, Unisend cost recognition (Dr 7720), and accrued liability to Unisend (Cr 5410-UN).

The integration-points doc at §A.3 (line 159) flagged this gap: *"the v3 mapping table currently shows O.x posting with only the invoice lines. The actual completion entry per v2 K.4 is a balanced entry combining suspense release, Unisend accrual, wallet credit, and invoice. Engine should produce the combined entry; v3 table needs a one-line clarification that O.x is the full completion posting, not just the invoice slice."*

This addendum closes the gap explicitly ahead of PR #5's staging burn-in. **It also corrects two methodological choices:** VAT decomposition is VAT-inclusive (per v1.2), and Unisend cost recognition follows the **agency / principal model** (per v1.3) — STG recognizes the cost on its P&L rather than netting it from seller proceeds.

## Decomposition methodology — VAT-inclusive (v1.2)

The buyer's gross_cart is VAT-inclusive throughout. STG's commission and shipping-mgmt revenue are gross (VAT-inclusive) when seen from the seller's wallet. Net revenue and output VAT are extracted from gross via:

```
commission_net = round_half_up(commission_gross / (1 + vat_rate))
commission_vat = commission_gross − commission_net          # derived; never independent
shipping_net   = round_half_up(shipping_gross / (1 + vat_rate))
shipping_vat   = shipping_gross − shipping_net               # derived; never independent
vat_amount     = commission_vat + shipping_vat
```

## VAT derivation invariant — load-bearing rule (v1.3)

For every line that decomposes a gross amount into net + VAT:

```
line_net = round_half_up(gross / (1 + vat_rate))
line_vat = gross − line_net
```

**Never compute `line_vat = round(gross × vat_rate / (1 + vat_rate))` independently.** The two rounding paths can produce sub-cent disagreement (€0.01 residue) that breaks `line_net + line_vat == gross` for individual lines. Implementations that violate this rule will surface as failed unit tests (any test where a single line's residue is non-zero will fail balance assertions).

Existing `splitInclusiveVat` helper at [src/lib/accounting/computer.ts:89-95](../../src/lib/accounting/computer.ts#L89-L95) already implements this correctly: returns `{ net_cents, vat_cents }` where `vat_cents = gross_cents − net_cents`. Caller code must NOT compute VAT independently; must call this helper and use both returned values.

## Cost-recognition methodology — STG-as-principal at I.1 receipt (v1.4)

Under v1.4, STG is the **principal** in the shipping contract with Unisend, but the cost is recognized only when the monthly Unisend invoice arrives via the existing I.1 vendor-invoice flow — **not at per-order completion time.** The simplification:

1. **Seller wallet still doesn't bear the Unisend cost.** Same as v1.3: `seller_net = item_value − commission_gross`. The seller is net of STG's commission only.

2. **Per-order accrual dropped.** v1.3 added Dr 7720 + Cr 5410-UN at completion to recognize the cost on STG's P&L immediately. v1.4 defers both lines to the monthly I.1 entry, when STG receives Unisend's actual invoice. The aggregate of all completed orders' shipping revenue (Σ Cr 6310-S) is then matched against the I.1 expense (Dr 7720) at month end.

3. **No new payload key, no new column.** v1.4 drops `unisend_cost_cents` from the O.x payload contract entirely. Existing `orders.shipping_cost_cents` (buyer-paid) remains the only shipping-related field; v1.4 entry uses it only for the Cr 6310-S revenue line.

The PSD2 commercial-agent posture remains aligned: STG's shipping contract with Unisend is still separate from the marketplace transaction; the cost just hits P&L at the natural invoicing cadence rather than at every order.

## Canonical 5-line completion entry (4 for B2B RC)

Worked example: LV-routed completion (item €100, shipping €1.90, gross_cart €101.90, vat_rate 0.21).

Computed values:
- `commission_gross = item_value × 0.10 = 10.00`
- `commission_net = round_half_up(10.00 / 1.21) = 8.26`
- `commission_vat = 10.00 − 8.26 = 1.74`
- `shipping_gross = shipping_value = 1.90`
- `shipping_net = round_half_up(1.90 / 1.21) = 1.57`
- `shipping_vat = 1.90 − 1.57 = 0.33`
- `vat_amount = commission_vat + shipping_vat = 2.07`
- `seller_net = item_value − commission_gross = 90.00`

Entry:

| # | Side | Account | Amount |
|---|------|---------|--------|
| 1 | Dr | 5590 Suspense — pre-completion | 101.90 (gross_cart) |
| 2 | Cr | 5351 Seller wallet | 90.00 (seller_net) |
| 3 | Cr | 6310-C Commission revenue | 8.26 (commission_net) |
| 4 | Cr | 6310-S Shipping-mgmt revenue | 1.57 (shipping_net) |
| 5 | Cr | 5710-LV-OUT | 2.07 (vat_amount) |

Math: Σ Dr = 101.90. Σ Cr = 90.00 + 8.26 + 1.57 + 2.07 = 101.90. **Balanced.**

## Variants

- **O.2 (LT B2B RC), O.4 (EE B2B RC):** `vat_rate = 0`; `commission_net = commission_gross`, `shipping_net = shipping_gross`, `vat_amount = 0`. **Line 5 (VAT) is OMITTED** (zero-amount lines violate the journal_lines CHECK). ESL visibility comes from `vat_country='LT'/'EE'` + `vat_rate_snapshot=0` on lines 3-4 (commission and shipping revenue lines). **Four-line entry.** Per accountant guidance during v1.3 review, this variant must be explicitly tested during staging burn-in to verify Line 5 is correctly omitted.
- **O.3 (LT B2C OSS):** `vat_rate = 0.21` (LT rate). Line 5 credits `5711` OSS-LT clearing. Five-line entry.
- **O.5 (EE B2C OSS):** `vat_rate = 0.24` (EE rate from 2025-07-01; 0.20 for posting_date < 2025-07-01 per the two-rate seed). Line 5 credits `5712` OSS-EE clearing. Five-line entry.
- **O.1 (LV):** `vat_rate = 0.21`. Line 5 credits `5710-LV-OUT`. Five-line entry.

## Required payload keys

For O.1–O.5: `item_value_cents`, `shipping_value_cents`, `invoice_number` (sequential, generated at issuance).

`unisend_cost_cents` is **not** a payload key in v1.4. Per-order Unisend cost recognition was dropped during v1.3 → v1.4 simplification; the cost lands on STG's P&L at monthly I.1 invoice receipt instead.

## Implementation notes

Existing `buildOrderRevenueLines` at [src/lib/accounting/mapping.ts:134-209](../../src/lib/accounting/mapping.ts#L134-L209) ships PR #2's 4-line "invoice slice" (commission only) with VAT-inclusive math. PR #5 commit 6 reworks it to:

- Produce the full 5-line entry per this addendum (2 additive lines: Dr 5590, Cr 5351; existing Cr 6310-C and Cr 5710-x retained verbatim; Cr 6310-S newly emitted in this slice — pre-PR-#5 the shipping-revenue line lived only in `posting_context_extras` for forward reference).
- Replace the existing Dr 5351 deduction line with a **single Cr 5351 line at `seller_net = item_value − commission_gross`**.
- Continue using `splitInclusiveVat` for the gross-to-net decomposition.

No production data drift to clean up: Phase 0 backfill produced zero O.x entries (the 4-line shape was idle code).

When Unisend's monthly I.1 vendor invoice arrives (PR #4b territory), STG records it via the standard incoming-vendor flow: Dr 7720 (shipping/logistics expense, net of input VAT) + Dr 5710-LV-IN (input VAT) / Cr 5310-UN (vendor payable, gross). The aggregate of all O.x shipping revenue lines (Cr 6310-S) over the month is matched against the I.1 expense at month-end P&L review. Reference example for v1.4: real Unisend invoice 3.22 EUR + 0.68 EUR VAT = 3.90 EUR total. PR #4b's brief will document the I.1 reconciliation flow with its own v1.4-shape sign-off round.

## Followups (queued; non-blocking for PR #5)

1. **v3 doc reconcile (UPDATED for v1.4):** Bring `stg-vat-mapping-table-v3.md` §A in line with v1.4. The current v3 §A.1 wording "Cr 6310-S Shipping-mgmt revenue: shipping_value (full pass-through; cost recognised separately)" reads ambiguously under v1.4 — STG is still principal in the shipping contract, but cost is recognized at I.1 receipt time, not at completion. Update wording to "Cr 6310-S Shipping-mgmt revenue (gross of VAT; STG records the matching expense at I.1 vendor invoice receipt per v1.4 agency model)."
2. **v2 §K.4 reconcile:** v2's worked example uses VAT-exclusive math AND the seller-bears model (seller_net = €83.35). v1.4 supersedes: VAT-inclusive math + 5-line entry + STG-records-at-I.1 model (seller_net = €90.00 for the LV €100 example). v2 should be updated or annotated as superseded.
3. **PR #4b documentation discipline:** the monthly Unisend invoice I.1 entry now does the full cost recognition (Dr 7720 + Dr 5710-LV-IN / Cr 5310-UN) — no 5410-UN accrual to wash since v1.4 dropped per-order accruals. PR #4b's brief documents how the monthly invoice ties out against the aggregate Σ Cr 6310-S over the month for P&L review purposes.
4. **Tax-filing-accountant counter-sign:** confirm whether the strategic-accountant's v1.4 sign-off is sufficient for STG's audit trail or whether the tax-filing accountant (potentially a separate person) also needs to see and counter-sign. One-email clarification queued before staging burn-in.
5. **Burn-in runbook gain:** explicit O.2 reverse-charge variant test scenario — verify Variant O.2 omits Line 5 (VAT line); B2B RC contract preserved with `vat_country='LT'/'EE'` + `vat_rate_snapshot=0` on revenue lines. Four-line entry under v1.4.
6. **v1.4 written confirmation insertion:** when the accountant's written confirmation document arrives, insert verbatim text into this file's "Accountant response" section + create a frozen `accountant-completion-entry-signoff-v1.4.md` snapshot.
