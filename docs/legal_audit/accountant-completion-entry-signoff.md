# Accountant sign-off: O.x completion-entry composition addendum

**Version:** v1.3
**Sign-off date:** 11 May 2026
**Status:** Approved for PR #5 lifecycle integration. **Pre-staging-burn-in gate closed.**
**Frozen snapshot:** `accountant-completion-entry-signoff-v1.3.md` (parallel filename per audit-trail convention).

## Changelog

- **v1.3** (11 May 2026) — **Agency model accepted.** STG is the principal in the shipping contract with Unisend (not a pass-through agent), so the Unisend cost is recognized on STG's P&L as an expense (Dr 7720) at completion time, alongside the corresponding accrued liability (Cr 5410-UN) to Unisend. **Completion entry is now 7 lines** (was 6 in v1.2): adds Dr 7720 alongside the existing Dr 5590 / Cr 5410-UN / Cr 5351 / Cr 6310-C / Cr 6310-S / Cr 5710-x lines. **`seller_net = item_value − commission_gross`** (no longer minus unisend_cost — STG bears it). VAT derivation invariant added per accountant rounding warning.
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

## Cost-recognition methodology — agency / principal model (v1.3)

Under v1.3, STG is the **principal** in the shipping contract with Unisend, not a pass-through agent. This has two consequences:

1. **Shipping revenue and shipping cost both appear on STG's P&L.** The buyer pays gross_cart (item + shipping); STG recognizes the shipping portion as revenue (Cr 6310-S, net of VAT) AND incurs an expense for the Unisend cost (Dr 7720). The net contribution from shipping is `shipping_net − unisend_cost` (visible in P&L), with VAT separately credited to the relevant clearing account.

2. **Seller wallet does NOT bear the Unisend cost.** Under the v1.2 model, seller_net = `item_value − commission_gross − unisend_cost` deducted the Unisend cost from the seller's proceeds. Under v1.3, **`seller_net = item_value − commission_gross`** — the seller is unaffected by what STG owes Unisend; they are net of STG's commission only.

The agency framing also reinforces STG's PSD2 commercial-agent posture: by treating shipping as a separate STG-principal contract with Unisend (independent of the marketplace transaction), the commercial-agent claim stays narrowly scoped to the seller-buyer payment flow.

## Canonical 7-line completion entry

Worked example: LV-routed completion (item €100, shipping €5, gross_cart €105, Unisend cost €3.50, vat_rate 0.21).

Computed values:
- `commission_gross = item_value × 0.10 = 10.00`
- `commission_net = round_half_up(10.00 / 1.21) = 8.26`
- `commission_vat = 10.00 − 8.26 = 1.74`
- `shipping_gross = shipping_value = 5.00`
- `shipping_net = round_half_up(5.00 / 1.21) = 4.13`
- `shipping_vat = 5.00 − 4.13 = 0.87`
- `vat_amount = commission_vat + shipping_vat = 2.61`
- `seller_net = item_value − commission_gross = 90.00`

Entry:

| # | Side | Account | Amount |
|---|------|---------|--------|
| 1 | Dr | 5590 Suspense — pre-completion | 105.00 (gross_cart) |
| 2 | Dr | 7720 Shipping/logistics expense (STG as principal) | 3.50 (unisend_cost) |
| 3 | Cr | 5351 Seller wallet | 90.00 (seller_net) |
| 4 | Cr | 5410-UN Accrued shipping liability (to Unisend) | 3.50 (unisend_cost) |
| 5 | Cr | 6310-C Commission revenue | 8.26 (commission_net) |
| 6 | Cr | 6310-S Shipping-mgmt revenue | 4.13 (shipping_net) |
| 7 | Cr | 5710-LV-OUT | 2.61 (vat_amount) |

Math: Σ Dr = 105.00 + 3.50 = 108.50. Σ Cr = 90.00 + 3.50 + 8.26 + 4.13 + 2.61 = 108.50. **Balanced.**

## Variants

- **O.2 (LT B2B RC), O.4 (EE B2B RC):** `vat_rate = 0`; `commission_net = commission_gross`, `shipping_net = shipping_gross`, `vat_amount = 0`. **Line 7 (VAT) is OMITTED** (zero-amount lines violate the journal_lines CHECK). ESL visibility comes from `vat_country='LT'/'EE'` + `vat_rate_snapshot=0` on lines 5-6 (commission and shipping revenue lines). **Six-line entry.** Per accountant guidance during v1.3 review, this variant must be explicitly tested during staging burn-in to verify Line 7 is correctly omitted.
- **O.3 (LT B2C OSS):** `vat_rate = 0.21` (LT rate). Line 7 credits `5711` OSS-LT clearing. Seven-line entry.
- **O.5 (EE B2C OSS):** `vat_rate = 0.24` (EE rate from 2025-07-01; 0.20 for posting_date < 2025-07-01 per the two-rate seed). Line 7 credits `5712` OSS-EE clearing. Seven-line entry.
- **O.1 (LV):** `vat_rate = 0.21`. Line 7 credits `5710-LV-OUT`. Seven-line entry.

## Required payload keys

For O.1–O.5: `item_value_cents`, `shipping_value_cents`, `unisend_cost_cents`, `invoice_number` (sequential, generated at issuance).

**Operational notes on `unisend_cost_cents`** (raised by accountant; resolution during commit 6 preamble):

- **Provenance:** must be stable from order-creation time through completion. Implementation should source from an order-time stored field (read once at completion); not recomputed from rate tables at completion time, not fetched from Unisend API at completion time.
- **Null handling:** for orders pre-dating route-specific unisend_cost storage OR with no shipping route assigned, the parent RPC must define behavior. Recommended: treat as orphan (skip GL emit, return `orphan: true`) consistent with the cart-payment antecedent-check pattern in round-3 §A.3. Final decision pending commit 6 preamble.

## Implementation notes

Existing `buildOrderRevenueLines` at [src/lib/accounting/mapping.ts:134-209](../../src/lib/accounting/mapping.ts#L134-L209) ships PR #2's 4-line "invoice slice" with VAT-inclusive math. PR #5 commit 6 reworks it to:

- Produce the full 7-line entry per this addendum (3 additive lines: Dr 5590, Dr 7720, Cr 5410-UN; existing Cr 6310-C, Cr 6310-S, Cr 5710-x retained verbatim).
- Replace the existing Dr 5351 deduction line with a **single Cr 5351 line at `seller_net = item_value − commission_gross`** (the previous "Cr at gross then Dr at fees" two-step collapses to a single net Cr).
- Continue using `splitInclusiveVat` for the gross-to-net decomposition.

No production data drift to clean up: Phase 0 backfill produced zero O.x entries (the 4-line shape was idle code).

When Unisend's I.1 vendor invoice arrives (PR #4b territory), it "washes" the 5410-UN accrual: Dr 5410-UN (clear accrual, net) + Dr 5710-LV-IN (input VAT) / Cr 5310-UN (vendor payable, gross). Reference example: real Unisend invoice 3.22 EUR + 0.68 EUR VAT = 3.90 EUR total. Aggregate reconciliation discipline is the precondition for the wash; PR #4b's brief will document the wash flow with its own v1.3-shape sign-off round.

## Followups (queued; non-blocking for PR #5)

1. **v3 doc reconcile (UPDATED for v1.3):** Bring `stg-vat-mapping-table-v3.md` §A in line with v1.3. The current v3 §A.1 wording "Cr 6310-S Shipping-mgmt revenue: shipping_value (full pass-through; cost recognised separately)" is **stale under the agency model** — shipping is NOT pass-through; STG is principal. Replace "full pass-through" with "shipping-mgmt revenue (gross of VAT; STG is principal in shipping contract per v1.3 agency model)."
2. **v2 §K.4 reconcile:** v2's worked example uses VAT-exclusive math AND the seller-bears model (seller_net = €83.35). v1.3 supersedes both: VAT-inclusive math + STG-bears model (seller_net = €90.00). v2 should be updated or annotated as superseded.
3. **PR #4b documentation discipline:** the monthly Unisend invoice "wash" against 5410-UN gets its own v1.3-shape document for accountant sign-off when PR #4b's vendor-invoice-intake architecture is briefed.
4. **Tax-filing-accountant counter-sign:** confirm whether the strategic-accountant's v1.3 sign-off is sufficient for STG's audit trail or whether the tax-filing accountant (potentially a separate person) also needs to see and counter-sign. One-email clarification queued before staging burn-in.
5. **Burn-in runbook gain:** explicit O.2 reverse-charge variant test scenario (per accountant guidance during v1.3 review) — verify Variant O.2 omits Line 7 (VAT line); B2B RC contract preserved with `vat_country='LT'/'EE'` + `vat_rate_snapshot=0` on revenue lines.
