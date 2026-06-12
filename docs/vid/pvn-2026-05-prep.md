# PVN deklarācija — May 2026 (2026/5) — preparation sheet

Prepared 2026-06-12 from the GL (period `2026-05`, hard_locked) + source documents (all received).
Cross-checked against the posted P.1 close (`close_2026_05`): **net payable €7.22** — declaration lands on the same figure.

Deadlines: declaration due 20.06.2026 (Saturday → EDS deadline moves to Monday **22.06.2026**); payment to the unified tax account due 23.06.2026 (Līgo holiday 23–24.06 → effectively **25.06.2026**). Verify the shifted dates in EDS.

## Main form

| Row | Value (EUR) | Source |
|-----|------------|--------|
| 41 (21% supplies, net) | **5.29** | INV-2026-00003 net 3.22 + INV-2026-00004 net 2.07 |
| 43 / 44 | 0 / 0 | April convention |
| 50 (goods/services received under reverse charge, 21% base) | **103.00** | Meta 13.00 (EU, Art. 196) + Anthropic 90.00 (third country) |
| 52 (output VAT 21% on row 41) | **1.11** | 0.68 + 0.43 |
| 55 (VAT calculated on row 50) | **21.63** | 2.73 (Meta) + 18.90 (Anthropic) |
| 62 (input VAT, domestic + PVN1-I-backed) | **12.79** | Swedbank 0.12 + Anthropic 18.90 − Vincit credit note 6.23 |
| 64 (input VAT on services received from EU) | **2.73** | Meta only — must be backed by PVN1-II total |
| 67 | — (empty) | EDS rejects negative values here |

**Net payable: (1.11 + 21.63) − (12.79 + 2.73) = 22.74 − 15.52 = €7.22** ✓ matches GL P.1.

Mapping notes (validated against EDS import checks, 12.06.2026):
- Rows 50/51/51.1 (and tax rows 55/56/56.1) are split **by rate** (21/12/5 %), not by geography — both the EU (Meta) and third-country (Anthropic) reverse-charge services sit in 50/55. April precedent (Hetzner, EU service → 50/55) is consistent.
- **Deduction side splits by appendix, not by service type**: row 64 is cross-checked against the PVN1-II total, so only EU-partner RC (Meta) goes there. The third-country RC deduction (Anthropic, PVN1-I code N) goes in **row 62**, which is cross-checked against the PVN1-I VAT total.
- **Row 67 must be ≥ 0** (EDS hard error on negatives). The Vincit credit-note correction is therefore netted into row 62. PVN1-I row keeps document type **4 (kredītrēķins)** with negative values; PVN1-I VAT total = 0.12 + 18.90 − 6.23 = 12.79 = row 62 exactly.
- Third-country supplier rows use PVN1-I transaction code **N** ("partner has no LV/EU VAT registration number") with the **partner-country field left blank** — EDS's Part I country classifier has no third-country entries (it deletes e.g. "US" with a warning).

## PVN1 Part I (input documents)

| # | Counterparty | Country / Reg | Type | Net | VAT | DokVeids | Document | Date |
|---|--------------|---------------|------|-----|-----|----------|----------|------|
| 1 | Swedbank AS | LV / 40003074764 | A | 0.60 | 0.12 | 1 | V0000891330 | 15.05.2026 |
| 2 | Anthropic, PBC | (blank) / — (no EU VAT nr) | N | 90.00 | 18.90 | 1 | JQYX1OS2-0011 | 05.05.2026 |
| 3 | Vincit Online, SIA | LV / 40203249460 | A | −29.65 | −6.23 | 4 (kredītrēķins) | VO-113703K | 27.05.2026 |

PVN1-I VAT total: 0.12 + 18.90 − 6.23 = **12.79** (= row 62).

## PVN1 Part II (received from EU) — Meta Platforms Ireland Limited, IE 9692928F, type P, EUR

| # | Invoice | Date | Net | RC VAT 21% |
|---|---------|------|-----|------------|
| 1 | FBADS-046-105967339 | 27.05.2026 | 2.00 | 0.42 |
| 2 | FBADS-046-105971606 | 28.05.2026 | 2.00 | 0.42 |
| 3 | FBADS-046-105977993 | 29.05.2026 | 3.00 | 0.63 |
| 4 | FBADS-046-105982609 | 30.05.2026 | 3.00 | 0.63 |
| 5 | FBADS-046-105987014 | 31.05.2026 | 3.00 | 0.63 |
| | **Total** | | **13.00** | **2.73** ✓ no rounding drift vs GL |

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
- Meta GL aggregate (€13.00 / €2.73 RC) decomposes exactly into the 5 per-invoice amounts above.

## Remaining open items (June, not blockers for May)

1. **Hetzner May invoice missing from GL** — April had 084000791607 (04.04); no May-dated Hetzner invoice is booked in May or June. Verify whether one was issued (~€1.91, ~04.05). May is hard-locked, so if found: book to June period, claim in June declaration (input VAT may be deducted in a later period).
2. **Unisend May invoice missing from GL** — April invoice 2601206 was paid in May, but no May-dated Unisend invoice is booked despite May shipments. Same treatment: book + claim in June, keeping declaration = GL = P.1.

## EDS import

`pvn-2026-05-eds-import.xml` (same folder) carries the full declaration in the EDS `DokPVNv7` format, modeled on the accepted April filing. EDS recalculates and validates on import; if import is rejected, hand-enter from this sheet — appendix rows first, then verify the main rows auto-populate.
