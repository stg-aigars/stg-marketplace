# Accountant sign-off: O.x completion-entry composition addendum

**Version:** v1.2
**Sign-off date:** 10 May 2026
**Status:** Approved for PR #5 lifecycle integration. Pre-staging-burn-in blocker resolved.
**Author trail:** drafted in `~/.claude/plans/pr-5-preamble-round-3.md` §B; revised through accountant review; this v1.2 is the canonical signed-off content.

## Changelog

- **v1.2** (10 May 2026) — **Accountant-signed canonical version.** Two corrections from the round-3 draft: (1) shipping-expense lines reference account `7720` (Piegādes/loģistikas izmaksas) per [migration 096 line 94](../../supabase/migrations/096_accounting_seeds.sql#L94) — any earlier draft references to `6440` are swapped to `7720`. (2) **Decomposition methodology is VAT-inclusive**, not VAT-exclusive: commission and shipping are treated as gross (VAT-inclusive) amounts; net is extracted via `round_half_up(gross / (1 + vat_rate))` at cent boundary. The seller's wallet sees only the gross commission deduction, not a separate VAT line. (The round-3 draft incorrectly used VAT-exclusive math inherited from v2 §K.4's worked example, which is now superseded.)
- **v1.1** — Internal revision pass.
- **v1.0** — Initial round-3 §B draft (VAT-exclusive — superseded).

## Context

The v3 mapping table (`stg-vat-mapping-table-v3.md`) §A.1–§A.5 show O.1–O.5 posting rules with only the **invoice slice** — four lines covering wallet debit, revenue credits, and output VAT. The **full O.x completion entry** is six lines, combining the invoice slice with suspense release and Unisend cost accrual.

The integration-points doc at §A.3 (line 159) flagged this gap: *"the v3 mapping table currently shows O.x posting with only the invoice lines. The actual completion entry per v2 K.4 is a 6-line balanced entry combining suspense release, Unisend accrual, wallet credit, and invoice. Engine should produce the combined entry; v3 table needs a one-line clarification that O.x is the full completion posting, not just the invoice slice."*

This addendum closes the gap explicitly ahead of PR #5's staging burn-in. **It also corrects the VAT decomposition methodology** from VAT-exclusive (as in v2 §K.4's worked example) to VAT-inclusive (the accountant-endorsed model).

## Decomposition methodology — VAT-inclusive

The buyer's gross_cart is VAT-inclusive throughout. STG's commission and shipping-mgmt revenue are gross (VAT-inclusive) when seen from the seller's wallet. Net revenue and output VAT are extracted from gross via:

```
commission_net = round_half_up(commission_gross / (1 + vat_rate))
commission_vat = commission_gross - commission_net
shipping_net   = round_half_up(shipping_gross / (1 + vat_rate))
shipping_vat   = shipping_gross - shipping_net
vat_amount     = commission_vat + shipping_vat
```

**The seller's wallet sees only the gross commission deduction**, not a separate VAT line. VAT is STG's responsibility (output VAT to remit to authority); the decomposition into net/VAT happens in STG's GL, not in the seller's wallet view.

## Canonical 6-line completion entry

Worked example: LV-routed completion (item €100, shipping €5, gross_cart €105, Unisend cost €3.50, vat_rate 0.21).

Computed values:
- `commission_gross = item_value × 0.10 = 10.00`
- `commission_net = round_half_up(10.00 / 1.21) = 8.26`
- `commission_vat = 10.00 − 8.26 = 1.74`
- `shipping_gross = shipping_value = 5.00`
- `shipping_net = round_half_up(5.00 / 1.21) = 4.13`
- `shipping_vat = 5.00 − 4.13 = 0.87`
- `vat_amount = commission_vat + shipping_vat = 2.61`
- `seller_net = item_value − commission_gross − unisend_cost = 100 − 10 − 3.50 = 86.50`

Entry:

| # | Side | Account | Amount |
|---|------|---------|--------|
| 1 | Dr | 5590 Suspense — pre-completion | 105.00 (gross_cart) |
| 2 | Cr | 5351 Seller wallet | 86.50 (seller_net) |
| 3 | Cr | 5410-UN Accrued shipping | 3.50 (unisend_cost) |
| 4 | Cr | 6310-C Commission revenue | 8.26 (commission_net) |
| 5 | Cr | 6310-S Shipping-mgmt revenue | 4.13 (shipping_net) |
| 6 | Cr | 5710-LV-OUT | 2.61 (vat_amount) |

Math: Σ Dr = 105.00. Σ Cr = 86.50 + 3.50 + 8.26 + 4.13 + 2.61 = 105.00. Balanced. ✓

## Variants

- **O.2 (LT B2B RC), O.4 (EE B2B RC):** `vat_rate = 0`; `commission_net = commission_gross`, `shipping_net = shipping_gross`, `vat_amount = 0`. Line 6 omitted (zero-amount lines violate the journal_lines CHECK). ESL visibility comes from `vat_country='LT'/'EE'` + `vat_rate_snapshot=0` on lines 4-5. Five-line entry.
- **O.3 (LT B2C OSS):** `vat_rate = 0.21` (LT rate). Line 6 credits `5711` OSS-LT clearing.
- **O.5 (EE B2C OSS):** `vat_rate = 0.24` (EE rate from 2025-07-01; 0.20 for posting_date < 2025-07-01 per the two-rate seed). Line 6 credits `5712` OSS-EE clearing.
- **O.1 (LV):** `vat_rate = 0.21`. Line 6 credits `5710-LV-OUT`.

## Required payload keys

For O.1–O.5: `item_value_cents`, `shipping_value_cents`, `unisend_cost_cents`, `invoice_number` (sequential, generated at issuance).

## Implementation note

Existing `buildOrderRevenueLines` at [src/lib/accounting/mapping.ts:134-209](../../src/lib/accounting/mapping.ts#L134-L209) ships PR #2's 4-line "invoice slice" with VAT-exclusive math. PR #5's lifecycle integration reworks it to:
- Produce the full 6-line entry per this addendum
- Use VAT-inclusive decomposition (`round_half_up(gross / (1 + vat_rate))`)

No production data drift to clean up: Phase 0 backfill produced zero O.x entries (the 4-line shape was idle code).

The shipping-expense recognition (Dr **7720** / Cr 5310-UN) fires later via the I.1 vendor-invoice flow when Unisend's invoice is booked — outside PR #5's scope.

## Followups (queued; non-blocking for PR #5)

1. **v3 doc reconcile.** Bring `stg-vat-mapping-table-v3.md` §A in line with this addendum: insert a §A.0 introductory subsection explicitly stating the model is VAT-inclusive ("commission and shipping are gross; wallet sees only commission"); strike v2 §K.4's VAT-exclusive worked example or annotate it as superseded.
2. **v2 §K.4 reconcile.** v2's worked example uses VAT-exclusive math (seller_net = €83.35 for the LV €100/€5 example). Under the v1.2 model, seller_net = €86.50. v2 §K.4 should be updated to match, or annotated as superseded.
