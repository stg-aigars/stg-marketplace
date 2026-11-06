# PVN deklarācija: October 2026 (2026/10), prep sheet

Prepared 06.11.2026 from the GL (O.1 completions in period `2026-10`) and the
source documents: Swedbank account statements for 2610 / 2620 (01.10–06.11),
Swedbank e-invoice V0000921544, Unisend 2603771 and Anthropic
9BF0758D-8362686. The Hetzner figures come from the bank card charges and the
invoice numbers recorded in `docs/operations/september-2026-close-status.md`.
The Hetzner PDFs were **not** in the upload (see "Missing documents").

**Status: NOT FILED.** File by 20.11.2026. **Payable position: €1.01**, pay
by 23.11.2026.

## Main form

| Row | Value (EUR) | Source |
|-----|------------:|--------|
| 41 (21% supplies, net) | **14.07** | 4 O.1 completions, PVN1 Part III |
| 43 / 44 | 0 / 0 | Standing convention |
| 50 (RC services received, 21% base) | **31.47** | Hetzner 8.98 + 4.49, Anthropic Ireland 18.00 |
| 52 (output VAT on row 41) | **2.93** | Per-invoice sum (EDS will suggest 2.95, see below) |
| 55 (VAT on row 50) | **6.61** | Hetzner 1.89 + 0.94, Anthropic 3.78 |
| 62 (input VAT, PVN1-I) | **1.92** | Swedbank 0.16 + Unisend 1.76 |
| 64 (input VAT on EU services, PVN1-II) | **6.61** | = row 55 |
| 67 | (empty) | No credit notes |

**Net: (2.93 + 6.61) − (1.92 + 6.61) = €1.01 payable.**

### Expected EDS warning: row 52

EDS computes 14.07 × 0.21 = 2.9547 → **2.95**. The GL figure 2.93 is the sum
of four individually rounded invoices (rounding gap, `accounting_conventions.md`
§5, same as September). File **2.93**.

## PVN1 Part I (domestic input documents)

| # | Counterparty | Reg | Type | Net | VAT | Document | Date |
|---|--------------|-----|------|----:|----:|----------|------|
| 1 | Swedbank AS | 40003074764 | A | 0.80 | 0.16 | V0000921544 | 15.10.2026 |
| 2 | Unisend Latvia SIA | 40203523445 | A | 8.38 | 1.76 | 2603771 | 31.10.2026 |

Total VAT 1.92 = row 62.

- **Swedbank V0000921544** (01–15.10, 4 transactions × €0.10 processing +
  €0.10 initiation). Debited directly on 15.10 (4 lines, €0.96).
- **Unisend 2603771**: 5 parcels (1 LV-LV, 3 LV-EE M/L, 1 LV-LT), €10.14.
  Paid 06.11. These match the 5 October dispatches by `shipped_at`: GNV2,
  WDYG, G8VV, 8FNF, 6YXW.
- **Not here**: Unisend 2603263 (€15.58, paid 06.10) and Swedbank
  V0000915445 (re-sent in this upload) were both claimed in **September**.

## PVN1 Part II (services from EU, type P)

| # | Counterparty | VAT nr | Net | RC VAT | Document | Date |
|---|--------------|--------|----:|-------:|----------|------|
| 1 | Hetzner Online GmbH | DE 812871812 | 8.98 | 1.89 | 085001260871 | 01.10.2026 |
| 2 | Hetzner Online GmbH | DE 812871812 | 4.49 | 0.94 | 080001231263 | 04.10.2026 |
| 3 | Anthropic Ireland, Limited | IE 4276970QH | 18.00 | 3.78 | 9BF0758D-8362686 | 11.10.2026 |

Totals 31.47 / 6.61 = rows 50 / 55 / 64. RC VAT is rounded per invoice;
EDS's 31.47 × 0.21 = 6.6087 → 6.61 agrees, so no warning here.

Hetzner is dated October (invoice date), following the June precedent: the
Jul+Aug usage invoice (€8.98) and the September usage invoice (€4.49). Both
were card-charged on 04.10 and 07.10. No Meta ad spend in October.

## PVN1 Part III (output documents, all "X" private person, type 41)

| # | Document | Date | Net | VAT |
|---|----------|------|----:|----:|
| 1 | STG-20261003-GNV2 | 06.10.2026 | 5.29 | 1.11 |
| 2 | STG-20261012-WDYG | 15.10.2026 | 3.31 | 0.69 |
| 3 | STG-20261017-G8VV | 20.10.2026 | 2.24 | 0.46 |
| 4 | STG-20261028-8FNF | 30.10.2026 | 3.23 | 0.67 |
| | **Total** | | **14.07** | **2.93** |

Net = 6310-C + 6310-S per O.1 entry; VAT = Cr 5710-LV-OUT. All four sellers
are LV. No refunds or cancellations in October. 6YXW (shipped 31.10, completed
04.11) and the two 01.11 orders belong to **November**.

PVN2 (ESL): empty. **OSS Q4: nothing yet.** No LT/EE-seller completions in
October; ML8U (LT seller, accepted 01.11) will be the first Q4 OSS item if it
completes.

## Missing documents

1. **Hetzner 085001260871 (€8.98) and 080001231263 (€4.49).** The PDFs are
   needed for the file, and to confirm the number/date/0% RC wording. The
   figures above match the card charges exactly. If either number or date
   differs on the PDF, correct the PVN1-II row before filing.
2. **Swedbank "Maksājumu ierosināšanas darījumu komisija … EPLV_SECONDTURN;
   09.2026", €2.18, debited 07.10 (2610).** This is not V0000915445: that
   invoice was settled from 2610 on 15.09. It looks like the 16–30.09
   platform charge. No e-invoice was uploaded, so it is treated as a fee with
   no VAT deduction (I.5, same as the €3.33 "08.2026" line on 07.09). If a
   Swedbank V-invoice exists for it (would be ~€1.80 + €0.38 VAT), it can be
   claimed in November.

Not missing: no Inbox.eu charge in October (BEU-1107881 in September was a
one-off payment); bank/card fees (€2.00 card, €5.00 account ×2, €0.57 / €0.21
transfer fees, card acquiring fees) are VAT-exempt financial services.

## GL close for October: not yet posted

The VAT figures above do not depend on the GL. The October close entries
(the September pattern, `created_by = 'oct_2026_close_claude'`) are **not
posted yet** and are waiting for confirmation:

| Group | Entries |
|-------|---------|
| EveryPay card settlements (C.3, 2630→2620) | GNV2 15.40→15.22 (06.10), G8VV 8.10→8.00 (19.10), 8FNF 20.10→19.86 (30.10); MDR €0.52 to 7710. 6YXW 9.10 stays in 2630 (settled 01.11) |
| Vendor invoices (I.1) | Swedbank V0000921544 €0.96 (2610, 15.10) · Unisend 2603771 €10.14 (5310-UN, paid 06.11) |
| Reverse charge (I.3) | Hetzner 085001260871 €8.98, 080001231263 €4.49 · Anthropic 9BF0758D-8362686 €18.00 (all 2610) |
| Vendor payments (I.7) | Unisend 2603263 €15.58 (06.10) |
| Bank fees (I.5) | 2610: 2.00 + 0.57×3 + 2.18 + 5.00 = €10.89 · 2620: 0.21 + 5.00 = €5.21 |
| P.1 `close_2026_10` | Dr 5710-LV-OUT 2.93 / Cr 5710-LV-IN 1.92 / Cr 5710-09 1.01 |

Already in GL: C.11 September PVN €2.93 and C.12 Q3 OSS LT 4.15 / EE 4.59
(all 08.10), plus the lifecycle C.1/C.2/C.4/O.1 entries and P.6.

Expected 31.10 bank closings (from statements): **2610 €178.92**,
**2620 €370.66**. Both statements agree forward from the 01.10 opening and
backward from the 06.11 closing.

## EDS import

`pvn-2026-10-eds-import.xml` (same folder): `DokPVNv7`, generated from the
September file with the figures above. Appendix totals have been
cross-checked against rows 41/50/52/55/62/64.
