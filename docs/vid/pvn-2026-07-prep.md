# PVN deklarācija — July 2026 (2026/7) — preparation sheet

Prepared 2026-08-03 from the GL (period `2026-07`, soft_locked, P.1 = `close_2026_07_corrected`) + source documents (all received).

**Not yet filed.** Per the 2026-08-03 decision, filing waits for hard-lock (checked ~2026-08-06) so nothing more can land in the period before submission — see `docs/operations/lifecycle-cutover-runbook.md`'s soft-lock discipline. This sheet is prep only; numbers should be re-verified against GL immediately before filing in case anything changes during the remaining soft-lock window.

Deadline: declaration + any payment due 20.08.2026 (Thursday — no shift needed). **This month is a refund position** (VID owes STG), not payable — no payment action required from STG; await VID's transfer instead.

## GL vs filed — one deliberate 7-cent gap (expected, not an error)

GL's P.1 (`close_2026_07_corrected`) shows a **€4.42** refund receivable (account `2380`). That figure deliberately folds in a 7-cent residual left over from June's PVN payment discrepancy (declared/paid €13.66 vs GL's €13.59) — the fix agreed 2026-08-03 was to shift that gap into July's books rather than amend June's already-filed return.

**The number to actually type into EDS is €4.35** — computed bottom-up from real invoices/orders only, same method as every prior month's sheet. There is no real document supporting the extra 7 cents; it's a GL-side bookkeeping adjustment, not a claimable amount. The resulting €0.07 gap between "GL says" and "we file" is the same permanent-rounding-gap phenomenon documented in `docs/accounting_conventions.md` §5 — expected, not something to correct by inflating the filing.

## Main form

| Row | Value (EUR) | Source |
|-----|------------|--------|
| 41 (21% supplies, net) | **18.27** | 6 O.1 completions, see PVN1 Part III |
| 43 / 44 | 0 / 0 | Standing convention |
| 50 (goods/services received under reverse charge, 21% base) | **37.42** | Anthropic 18.00 (third country) + Meta 19.42 (EU, Art. 196) |
| 52 (output VAT 21% on row 41) | **3.83** | Sum of the 6 O.1 entries' output VAT |
| 55 (VAT calculated on row 50) | **7.86** | 3.78 (Anthropic) + 4.08 (Meta) |
| 62 (input VAT, domestic + PVN1-I-backed) | **11.96** | Swedbank 0.12 + Unisend 7.62 + Swedbank 0.44 + Anthropic 3.78 |
| 64 (input VAT on services received from EU) | **4.08** | Meta only — must be backed by PVN1-II total |
| 67 | — (empty) | No credit notes this month |

**Net position: (3.83 + 7.86) − (11.96 + 4.08) = 11.69 − 16.04 = −€4.35 → refund of €4.35** ✓ matches GL's own bottom-up total (before the 7-cent fold-in — see note above).

Mapping notes (same convention as May/June, re-verified against this month's data):
- Rows 50/55 combine both the third-country (Anthropic) and EU-partner (Meta) reverse-charge services — split by rate, not geography, per the April/May precedent.
- **Deduction side splits by appendix, not by service type**: row 64 = Meta only, cross-checked against the PVN1-II total. Anthropic's RC deduction (third-country, PVN1-I code N) goes in row 62.
- **Two of the four PVN1-I input documents are June-dated but claimed in July**, per an explicit 2026-07-31 decision made during the June close repair (documented in each entry's own GL narrative — `june_2026_entry_68`, `june_2026_entry_69`): the Swedbank platform invoice V0000897245 (01–15.06) and the Unisend invoice 2601925 (30.06, 22 parcel-locker shipments) were both left out of June's filed declaration (EDS 115617621, per the GL narrative text) and their input VAT deferred to July's. Verify this doesn't create a double-claim risk — cross-check against June's actual filed EDS document if in doubt.
- No B2B reverse-charge domestic supplies this month (no O.2/O.4 entries) → **PVN2 (ESL) stays empty**, same as every month so far.
- **This is the first refund-position filing in this dataset** (April/May were both payable). The row structure is identical either way — EDS computes the net sign from the same rows; there's no separate "refund" row to populate differently. Flagged for verification in EDS directly since there's no prior refund-case precedent on file to cross-check against.

## PVN1 Part I (input documents)

| # | Counterparty | Country / Reg | Type | Net | VAT | DokVeids | Document | Date |
|---|--------------|---------------|------|-----|-----|----------|----------|------|
| 1 | Swedbank AS | LV / 40003074764 | A | 0.60 | 0.12 | 1 | V0000897245 | 15.06.2026 |
| 2 | Unisend Latvia SIA | LV / 40203523445 | A | 36.30 | 7.62 | 1 | 2601925 | 30.06.2026 |
| 3 | Swedbank AS | LV / 40003074764 | A | 2.10 | 0.44 | 1 | 6012050226 | 15.07.2026 |
| 4 | Anthropic, PBC | (blank) / — (no EU VAT nr) | N | 18.00 | 3.78 | 1 | JQYX1OS2-0014 | 26.07.2026 |

PVN1-I VAT total: 0.12 + 7.62 + 0.44 + 3.78 = **11.96** (= row 62).

## PVN1 Part II (received from EU) — Meta Platforms Ireland Limited, IE 9692928F, type P, EUR

| # | Invoice | Date | Net | RC VAT 21% |
|---|---------|------|-----|------------|
| 1 | FBADS-046-106259359 | 27.07.2026 | 4.42 | 0.93 |
| 2 | FBADS-046-106267577 | 28.07.2026 | 5.00 | 1.05 |
| 3 | FBADS-046-106273729 | 30.07.2026 | 5.00 | 1.05 |
| 4 | FBADS-046-106285148 | 31.07.2026 | 5.00 | 1.05 |
| | **Total** | | **19.42** | **4.08** ✓ no rounding drift vs GL |

A 5th Meta invoice (FBADS-046-106293368, €5.00, billing period 31.07–02.08) belongs entirely to August — excluded here, same call made during the July GL backfill.

## PVN1 Part III (output documents)

| # | Counterparty | Type | Net | VAT | DokVeids | Document | Date |
|---|--------------|------|-----|-----|----------|----------|------|
| 1 | X (private person, LV seller) | 41 | 3.39 | 0.71 | 1 | INV-2026-00027 | 02.07.2026 |
| 2 | X (private person, LV seller) | 41 | 4.63 | 0.97 | 1 | INV-2026-00029 | 08.07.2026 |
| 3 | X (private person, LV seller) | 41 | 2.48 | 0.52 | 1 | INV-2026-00030 | 09.07.2026 |
| 4 | X (private person, LV seller) | 41 | 2.81 | 0.59 | 1 | INV-2026-00032 | 15.07.2026 |
| 5 | X (private person, LV seller) | 41 | 1.98 | 0.42 | 1 | INV-2026-00034 | 23.07.2026 |
| 6 | X (private person, LV seller) | 41 | 2.98 | 0.62 | 1 | INV-2026-00035 | 31.07.2026 |

PVN1-III VAT total: 0.71+0.97+0.52+0.59+0.42+0.62 = **3.83** (= row 52).

PVN2 (ESL): empty — no supplies to EU VAT-registered persons in July.

OSS: 3 LT/EE-seller order completions in July (WRRJ/LT, E93F/EE, 4CUP/EE) → **Q3 2026 OSS declaration, due 31.10.2026**. Not due yet; no action this cycle. Q2 2026's OSS declaration (LT €3.31 + EE €7.04) was already filed 11.07.2026 (EDS 115617661) and its payment posted to GL 2026-08-03 — see `docs/accounting_conventions.md` §3 for the full reconciliation (the E93F straddling-order case).

## Completeness verification performed

- Orders completed in July per `orders` table with `seller_country='LV'`: exactly 6 (XK5D, YEB9, 8Z68, YRQF, ABMV, HXHB) — matches the six O.1 entries. LT/EE-seller completions (WRRJ, E93F, 4CUP) route to OSS instead, not this declaration. No refunds/credit notes, no staff-test orders.
- 5710-LV-IN / 5710-LV-OUT swept via `tax_period='2026-07'` (not `accounting_period`) per the June-close-repair fix — confirmed the two June-dated-but-July-claimed invoices (Swedbank V0000897245, Unisend 2601925) are the only entries where the two periods diverge, both explicitly documented in their own GL narratives.
- Hetzner (June-accrued invoice 088001013289, paid 08.07) and Unisend's own payment (2601925, paid 08.07 clearing the payable) are **cash-only** in July — their input VAT was already claimed as of the tax_period assignment above; the July payment entries don't add anything new to this declaration.
- VID payments made in July (June's PVN €13.66, the OSS Q2 payment €10.35) are cash movements settling **prior** declarations, not July declaration items.

## Remaining open items (not blockers for this filing)

1. **UJRJ write-off** (€34.10, non-payment) — deferred to August per an explicit decision; does not touch July's declaration since the order's original O.1 completion in June already correctly recognized the sale.
2. **June's actual filed PVN deklarācija EDS document number** — read from `june_2026_entry_68`'s GL narrative text (EDS 115617621), not independently verified against the real EDS filing history. Worth confirming before relying on it as a cross-check.

## EDS import

`pvn-2026-07-eds-import.xml` (same folder) carries the full declaration in the EDS `DokPVNv7` format, modeled on the accepted April/May filings. **Uses the €4.35 bottom-up figure**, not GL's €4.42. EDS recalculates and validates on import; if import is rejected, hand-enter from this sheet — appendix rows first, then verify the main rows auto-populate. This is the first refund-position filing on file — double-check EDS's summary screen shows the expected refund treatment (not an accidental payable) before submitting.
