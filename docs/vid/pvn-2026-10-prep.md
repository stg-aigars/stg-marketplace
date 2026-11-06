# PVN deklarācija: October 2026 (2026/10), prep sheet

Prepared 06.11.2026 from the GL (O.1 completions in period `2026-10`) and the
source documents: Swedbank account statements for 2610 / 2620 (01.10–06.11),
Swedbank e-invoice V0000921544, Unisend 2603771 and Anthropic
9BF0758D-8362686. It also uses Hetzner 085001260871 and 080001231263 (PDFs,
received in a second upload).

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

## Documents: complete (updated 06.11.2026)

Every October statement line maps to a document, to existing GL, or to a
VAT-exempt fee. Nothing is missing for the return.

- **Hetzner PDFs received, and they match this sheet.** 085001260871 is
  dated 01.10.2026: €8.98, two months ("Default" 07/2026 + "STG" 08/2026).
  080001231263 is dated 04.10.2026: €4.49, "STG" 09/2026. Both are tax code
  A7, 0 % "Reverse Charge", and Hetzner's VAT number is DE812871812.
- **There will be no Hetzner invoice for October usage.** Hetzner's email of
  04.11 ("Minimum invoice amount not reached", K0393508326) says the
  October costs (€4.49) are under the €10 minimum, so invoicing is
  postponed until €10 is reached or for at most 3 months. Expect a combined
  invoice (~€8.98 for Oct+Nov) around early December. It is recognised on
  its invoice date, as usual. No accrual is needed (it is immaterial, and
  RC VAT is net zero).
- **Swedbank €2.18 debited 07.10 ("Maksājumu ierosināšanas darījumu
  komisija … EPLV_SECONDTURN; 09.2026"): resolved.** This is the monthly
  Swedbank payment-initiation (PIS) commission. It is not an e-invoice
  line. V0000915445 was debited separately on 15.09 (bank refs
  2026091500814483/-489, recorded on the September I.1). Precedent:
  `july_2026_entry_8` (€5.20, 07.07) and `2026090700375648-1` (€3.33,
  07.09) are both I.5, `fee_type = pis_commission`, VAT-exempt financial
  service. Book the October one the same way. It gives no PVN1-I row. The
  second upload (V0000909660, V0000915445) contains no invoice for it; both
  of those invoices are already in the GL (August and September).

Not missing: no Inbox.eu charge in October (BEU-1107881 in September was a
one-off payment); bank/card fees (€2.00 card, €5.00 account ×2, €0.57 / €0.21
transfer fees, card acquiring fees) are VAT-exempt financial services.

## GL close for October: posted 06.11.2026

18 entries were posted (`created_by = 'oct_2026_close_claude'`). The GL now
matches this sheet exactly: the tax_period 2026-10 sweep gives LV-OUT 2.93 /
LV-IN 1.92 / RC 6.61 ↔ 6.61, and P.1 `close_2026_10` credits 5710-09 with
€1.01. See `docs/operations/october-2026-close-status.md`.

## EDS import

`pvn-2026-10-eds-import.xml` (same folder): `DokPVNv7`, generated from the
September file with the figures above. Appendix totals have been
cross-checked against rows 41/50/52/55/62/64.
