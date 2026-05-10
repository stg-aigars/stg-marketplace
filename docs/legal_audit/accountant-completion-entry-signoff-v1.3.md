# Accountant sign-off v1.3 — O.x completion-entry composition addendum (frozen snapshot)

**Version:** v1.3
**Sign-off date:** 11 May 2026
**Status:** Approved for PR #5 lifecycle integration. **Pre-staging-burn-in gate closed.**
**Frozen snapshot of:** `docs/legal_audit/accountant-completion-entry-signoff.md` at the time of v1.3 acceptance (parallel filename per audit-trail convention; the unversioned canonical file tracks live changes).

---

## v1.3 changes from v1.2 (the load-bearing revision)

The v1.2 draft used a "seller-bears-Unisend-cost" model with a 6-line completion entry. The accountant rejected this in favor of an **Agency / Principal model** — STG is the principal in the shipping contract with Unisend (not a pass-through agent), so the Unisend cost is recognized on STG's P&L as an expense, not netted out of seller proceeds. This produces a **7-line completion entry** with three additive lines vs the existing PR #2 invoice slice (Dr 5590, Dr 7720, Cr 5410-UN added; existing Cr 5351, Cr 6310-C, Cr 6310-S, Cr 5710-x retained).

### Why the agency framing matters beyond the math

- **P&L visibility:** STG's shipping margin (revenue − cost) is now visible as line items on the P&L, not buried inside seller wallet movements. The €1.50 margin in the K.4 example (€5 buyer-paid - €3.50 Unisend cost) shows up as Cr 6310-S 4.13 (net) − Dr 7720 3.50 (gross) = 0.63 net contribution, with the remaining gross-vs-net difference going to output VAT 0.87 and is independently visible.
- **PSD2 commercial-agent posture:** The agency framing reinforces STG's position that it is the seller's commercial agent for the marketplace transaction (PSD2 Article 3(b) exemption). Treating shipping as a separate STG-principal contract with Unisend (independent of the marketplace transaction) keeps the commercial-agent claim narrowly scoped to the seller-buyer payment flow.
- **Future-proofing for vendor-invoice reconciliation:** When Unisend's monthly invoice arrives (PR #4b territory), it will "wash" the 5410-UN accrual against the actual invoiced amounts. The aggregate reconciliation discipline at v1.3 is the precondition for that wash.

### Changes from v1.2

| Item | v1.2 | v1.3 |
|------|------|------|
| Lines | 6 | **7** |
| New lines vs PR #2 invoice slice | 2 (Dr 5590, Cr 5410-UN; the wallet credit collapsed into a single Cr 5351 net line) | **3** (Dr 5590, **Dr 7720**, Cr 5410-UN; Cr 5351 still single-line at the net) |
| `seller_net` formula | `item_value − commission_gross − unisend_cost` | **`item_value − commission_gross`** (Unisend cost no longer deducted from seller proceeds; STG bears it as Dr 7720) |
| Worked example seller_net (K.4 inputs) | €86.50 | **€90.00** |
| Σ Dr | gross_cart (€105) | **gross_cart + unisend_cost (€108.50)** |
| Σ Cr | gross_cart (€105) | **gross_cart + unisend_cost (€108.50)** |
| Cost-bearer narrative | seller bears Unisend cost via wallet deduction | **STG bears Unisend cost as expense (principal in shipping contract)** |

---

## Canonical 7-line completion entry (v1.3)

Worked example: LV-routed completion (item €100, shipping €5, gross_cart €105, Unisend cost €3.50, vat_rate 0.21).

Computed values:
- `commission_gross = item_value × 0.10 = 10.00`
- `commission_net = round_half_up(10.00 / 1.21) = 8.26`
- `commission_vat = commission_gross − commission_net = 10.00 − 8.26 = 1.74`  *(derived from difference; never independently computed)*
- `shipping_gross = shipping_value = 5.00`
- `shipping_net = round_half_up(5.00 / 1.21) = 4.13`
- `shipping_vat = shipping_gross − shipping_net = 5.00 − 4.13 = 0.87`  *(derived from difference)*
- `vat_amount = commission_vat + shipping_vat = 2.61`
- `seller_net = item_value − commission_gross = 100.00 − 10.00 = 90.00`

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

## VAT derivation invariant (load-bearing rule from accountant rounding warning)

For every line that decomposes a gross amount into net + VAT:

```
line_net = round_half_up(gross / (1 + vat_rate))
line_vat = gross − line_net
```

**Never compute `line_vat = round(gross × vat_rate / (1 + vat_rate))` independently.** The two rounding paths can produce sub-cent disagreement (€0.01 residue) that breaks `line_net + line_vat == gross` for individual lines. Implementations that violate this rule will surface as failed unit tests (any test where a single line's residue is non-zero will fail balance assertions).

**Implementation requirement for `splitInclusiveVat` (already correct in `src/lib/accounting/computer.ts`):**
- Returns `{ net_cents, vat_cents }` where `vat_cents = gross_cents − net_cents`.
- Caller code must NOT compute VAT independently; must call this helper and use both returned values.

## Variants

- **O.2 (LT B2B RC), O.4 (EE B2B RC):** `vat_rate = 0`; `commission_net = commission_gross`, `shipping_net = shipping_gross`, `vat_amount = 0`. **Line 7 (VAT) is OMITTED** (zero-amount lines violate the journal_lines CHECK). ESL visibility comes from `vat_country='LT'/'EE'` + `vat_rate_snapshot=0` on lines 5-6 (commission and shipping revenue lines). **Six-line entry.**
- **O.3 (LT B2C OSS):** `vat_rate = 0.21` (LT rate). Line 7 credits `5711` OSS-LT clearing. Seven-line entry.
- **O.5 (EE B2C OSS):** `vat_rate = 0.24` from 2025-07-01 (`0.20` for posting_date < 2025-07-01 per the two-rate seed). Line 7 credits `5712` OSS-EE clearing. Seven-line entry.
- **O.1 (LV):** `vat_rate = 0.21`. Line 7 credits `5710-LV-OUT`. Seven-line entry.

## Required payload keys

For O.1–O.5: `item_value_cents`, `shipping_value_cents`, `unisend_cost_cents`, `invoice_number` (sequential, generated at issuance).

**Operational note on `unisend_cost_cents`** (raised by accountant; resolution TBD during commit 6 preamble):

- **Provenance:** must be stable from order-creation time through completion. Implementation should source from an order-time stored field (read once at completion); not recomputed from rate tables at completion time, not fetched from Unisend API at completion time.
- **Null handling:** for orders that pre-date route-specific unisend_cost storage OR have no shipping route assigned, the parent RPC must define behavior. Recommended: treat as orphan (skip GL emit, return `orphan: true`) consistent with the cart-payment antecedent-check pattern in round-3 §A.3.

## Implementation notes

### Existing `buildOrderRevenueLines` rework

Existing 4-line slice at [src/lib/accounting/mapping.ts:134-209](../../src/lib/accounting/mapping.ts#L134-L209) ships only the invoice portion (Cr 5351 deduction, Cr 6310-C, Cr 6310-S, Cr 5710-x). PR #5 commit 6 expansion to 7 lines is purely additive: lines 1, 2, 4 added; existing 3 lines (Cr 6310-C, Cr 6310-S, Cr 5710-x) retained verbatim; existing Dr 5351 changes from "deduction" to "Cr 5351 net" (single line representing seller_net, not the multi-step "credit gross / debit STG fees" flow v2 K.4 used).

### Cr 5351 line semantics under v1.3

Single line, net of STG fees AND (under v1.3) net of nothing else (Unisend cost stays on STG's P&L, not deducted from wallet):
```
Cr 5351 = item_value_cents − commission_gross_cents
       (= seller_net per v1.3 formula)
```

The existing PR #2 implementation at line 162 uses `Dr 5351` for the deduction shape. Commit 6 must invert this to `Cr 5351 seller_net` per v1.3.

### Shipping-expense pairing

The Dr 7720 / Cr 5410-UN pair at completion records STG's shipping expense recognition + accrued liability to Unisend. When Unisend's I.1 vendor invoice arrives (PR #4b territory), it "washes" the 5410-UN accrual: Dr 5410-UN (clear accrual) + Dr 5710-LV-IN (input VAT) / Cr 5310-UN (vendor payable gross). The aggregate reconciliation discipline at v1.3 is the precondition for the wash.

### Required payload + posting_context_required_keys update

Mapping table entries for O.1-O.5 currently list `posting_context_required_keys` excluding `unisend_cost_cents`. PR #5 commit 6 must add `unisend_cost_cents` to the required keys, since the line construction now depends on it.

## Followups (queued; non-blocking for PR #5)

1. **v3 doc reconcile (UPDATED):** Bring `stg-vat-mapping-table-v3.md` §A in line with v1.3. The current v3 §A.1 wording "Cr 6310-S Shipping-mgmt revenue: shipping_value (full pass-through; cost recognised separately)" is **stale under the agency model** — shipping is NOT pass-through; STG is principal. Strike "full pass-through" and replace with "shipping-mgmt revenue (gross of VAT; STG is principal in shipping contract per v1.3 agency model)."
2. **v2 §K.4 reconcile:** v2's worked example uses VAT-exclusive math AND the seller-bears model (seller_net = €83.35). v1.3 supersedes both: VAT-inclusive math + STG-bears model (seller_net = €90.00). v2 should be updated or annotated as superseded.
3. **PR #4b documentation discipline:** the monthly Unisend invoice "wash" against 5410-UN gets its own v1.3-shape document for accountant sign-off when PR #4b's vendor-invoice-intake architecture is briefed. Reference example: real Unisend invoice 3.22 EUR + 0.68 EUR VAT = 3.90 EUR total uploaded by user during v1.3 review round.
4. **Tax-filing-accountant counter-sign question:** confirm whether the strategic-accountant's v1.3 sign-off is sufficient for STG's audit trail or whether the tax-filing accountant (potentially a separate person) also needs to see and counter-sign. One-email clarification queued before staging burn-in.
5. **Burn-in runbook gain:** explicit O.2 reverse-charge variant test scenario (per accountant guidance during v1.3 review) — verify Variant O.2 omits Line 7 (VAT line), B2B RC contract preserved.

## Accountant response (verbatim — pending insertion when user provides email/document)

[Placeholder for the accountant's verbatim response email or document. The user provided a summary in conversation; this section will be replaced with the verbatim text when available. Until then, the substantive content above reflects the user's faithful summary of the accountant's v1.3 sign-off, with Agency framing, 7-line entry, VAT derivation invariant, and O.2 omits-Line-7 confirmation.]
