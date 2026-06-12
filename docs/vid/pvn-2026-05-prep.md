# PVN deklarācija — May 2026 (2026/5) — preparation sheet

Prepared 2026-06-12 from the GL (period `2026-05`, hard_locked) + source documents.
Cross-checked against the posted P.1 close (`close_2026_05`): **net payable €7.22** — declaration must land on the same figure.

Deadlines: declaration due 20.06.2026 (Saturday → EDS deadline moves to Monday **22.06.2026**); payment to the unified tax account due 23.06.2026 (Līgo holiday 23–24.06 → effectively **25.06.2026**). Verify the shifted dates in EDS.

## Main form

| Row | Value (EUR) | Source |
|-----|------------|--------|
| 41 (21% supplies, net) | **5.29** | INV-2026-00003 net 3.22 + INV-2026-00004 net 2.07 |
| 43 / 44 | 0 / 0 | April convention |
| 50 (services received from EU taxable persons) | **13.00** | Meta Platforms Ireland, 5 invoices 27–31.05 |
| 51 (services received from third countries) | **90.00** | Anthropic JQYX1OS2-0011, 05.05.2026 |
| 52 (output VAT 21% on row 41) | **1.11** | 0.68 + 0.43 |
| 55 (VAT on row 50) | **2.73** | Meta RC self-assessment |
| 56 (VAT on row 51) | **18.90** | Anthropic RC self-assessment |
| 62 (input VAT, domestic) | **0.12** | Swedbank e-commerce platform fee (net 0.60) |
| 64 (input VAT on received services) | **21.63** | 2.73 (Meta) + 18.90 (Anthropic) |
| 67 (input VAT correction, prior period) | **−6.23** | Vincit Online credit note (orig. VO-113703 deducted in Jan 2026) |

**Net payable: (1.11 + 2.73 + 18.90) − (0.12 + 21.63 − 6.23) = 22.74 − 15.52 = €7.22** ✓ matches GL P.1.

Notes:
- In EDS the appendix (PVN1) rows drive the main form — enter appendix rows first and verify rows 50/51/55/56/64 populate as above. The 51/56 placement for the non-EU (Anthropic) service is the one novel mapping this month (no April precedent) — confirm EDS puts it there when the PVN1-I row with transaction type **N** is entered.
- Vincit correction: original input VAT was deducted in the January 2026 declaration, so the reversal is a prior-period correction → row 67 (negative). Netting it into row 62 instead (0.12 − 6.23 = −6.11) produces the identical total; row 67 is the methodologically cleaner placement for a credit note received in a later period.

## PVN1 Part I (input documents)

| # | Counterparty | Reg/VAT | Type | Net | VAT | Document | Date |
|---|--------------|---------|------|-----|-----|----------|------|
| 1 | Swedbank AS | LV40003074764 | A | 0.60 | 0.12 | **[doc nr needed]** | ~15.05.2026 |
| 2 | Anthropic, PBC (US, no EU VAT nr) | — | N | 90.00 | 18.90 | JQYX1OS2-0011 | 05.05.2026 |
| 3 | VINCIT ONLINE SIA | **[reg nr needed — copy from Jan declaration row for VO-113703]** | A (credit note, negative values) | −29.65 | −6.23 | **[credit note nr needed]** | ~30.05.2026 |

## PVN1 Part II (received from EU)

Meta Platforms Ireland Limited, IE 9692928F, type **P**, total net 13.00 / VAT 2.73, EUR.
Five invoices (27–31.05): FBADS-046-105967339, -105971606, -105977993, -105982609, -105987014.
All under the €150 itemization threshold — either one consolidated row or five itemized rows (April precedent itemized the sub-threshold Hetzner doc; itemizing needs per-invoice amounts from the Meta receipts).

## PVN1 Part III (output documents)

| # | Counterparty | Type | Net | VAT | DokVeids | Document | Date |
|---|--------------|------|-----|-----|----------|----------|------|
| 1 | X (private person, LV seller) | 41 | 3.22 | 0.68 | 1 | INV-2026-00003 | 22.05.2026 |
| 2 | X (private person, LV seller) | 41 | 2.07 | 0.43 | 1 | INV-2026-00004 | 29.05.2026 |

PVN2 (ESL): empty — no supplies to EU VAT-registered persons in May.
OSS: no LT/EE-seller order completed in May (first OSS-relevant completions are June: INV-2026-00006 EE, INV-2026-00008 LT → Q2 2026 OSS declaration, due July).

## Completeness verification performed

- Orders completed in May per `orders` table: exactly 2 (STG-20260521-R62J, STG-20260528-BCFQ) — matches the two O.1 entries. No refunds/credit notes, no staff-test orders.
- VID April refund €0.30 received 26.05 (C.8) — cash movement only, not a declaration item.
- Anthropic invoice JQYX1OS2-**0012** (05.06.2026, €18.00 Claude Pro, RC) belongs to the **June** declaration.

## Open items

1. **Swedbank fee document number** for the €0.72 (15.05) — from the Swedbank e-commerce statement.
2. **Vincit credit note number + reg number** — from the credit note itself or the January PVN1-I row.
3. **Meta itemization choice** (1 consolidated vs 5 itemized rows).
4. **Hetzner May invoice missing from GL** — April had 084000791607 (04.04); no May-dated Hetzner invoice is booked in May or June. Verify whether one was issued (~€1.91, ~04.05). May is hard-locked, so if found: book to June period, claim in June declaration (input VAT may be deducted in a later period).
5. **Unisend May invoice missing from GL** — April invoice 2601206 was paid in May, but no May-dated Unisend invoice is booked despite May shipments. Same treatment as #4: book + claim in June, keeping declaration = GL = P.1.
