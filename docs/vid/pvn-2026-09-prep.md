# PVN deklarācija: September 2026 (2026/9), prep sheet

Prepared 08.10.2026 from the GL (period `2026-09`, P.1 = `close_2026_09`) and
the source documents (Swedbank camt.052 reports 1216347833 / 1216347881, plus
5 PDF and 2 e-invoice XML documents).

**FILED 08.10.2026, EDS 117020580.** Filed values match this sheet exactly (row 52 filed as 7.74 despite the expected EDS warning). Payment of €2.93 is due 23.10.2026 and not yet made.
**Payable position: €2.93.**

## Main form

| Row | Value (EUR) | Source |
|-----|------------:|--------|
| 41 (21% supplies, net) | **37.01** | 9 O.1 completions, PVN1 Part III |
| 43 / 44 | 0 / 0 | Standing convention |
| 50 (RC services received, 21% base) | **18.00** | Anthropic Ireland (EU, Art. 196) |
| 52 (output VAT on row 41) | **7.74** | Per-invoice sum (EDS will suggest 7.77, see below) |
| 55 (VAT on row 50) | **3.78** | Anthropic |
| 62 (input VAT, PVN1-I) | **4.81** | Swedbank 0.38 + Inbox.eu 1.73 + Unisend 2.70 |
| 64 (input VAT on EU services, PVN1-II) | **3.78** | Anthropic |
| 67 | (empty) | No credit notes |

**Net: (7.74 + 3.78) − (4.81 + 3.78) = €2.93 payable.** This matches GL
`close_2026_09` (Cr 5710-09 €2.93).

### Expected EDS warning: row 52

EDS computes row 52 as 37.01 × 0.21 = 7.7721 → **7.77**. The GL figure 7.74
is the sum of nine individually rounded invoices. This is the permanent
rounding gap in `docs/accounting_conventions.md` §5. File **7.74**; the
warning is advisory only.

### Change this month: Anthropic is now an EU supplier

Invoice 9BF0758D-5665749 was issued by **Anthropic Ireland, Limited** (IE
VAT IE4276970QH). Until July, the issuer was Anthropic, PBC (US), filed in
PVN1-I with code N and its deduction in row 62. From now on Anthropic goes in
**PVN1-II (type P)**, with its deduction in **row 64**. A new counterparty
was created (`a2222222-…-22222222e1e1`, vendor_code `AN-IE`).

## PVN1 Part I (domestic input documents)

| # | Counterparty | Reg | Type | Net | VAT | Document | Date |
|---|--------------|-----|------|----:|----:|----------|------|
| 1 | Swedbank AS | 40003074764 | A | 1.80 | 0.38 | V0000915445 | 15.09.2026 |
| 2 | SIA INBOKSS (Inbox.eu) | 40003560720 | A | 8.26 | 1.73 | BEU-1107881-09/2026 | 16.09.2026 |
| 3 | Unisend Latvia SIA | 40203523445 | A | 12.88 | 2.70 | 2603263 | 30.09.2026 |

Total VAT 4.81 = row 62.

## PVN1 Part II (services from EU)

| # | Counterparty | VAT nr | Type | Net | RC VAT | Document | Date |
|---|--------------|--------|------|----:|-------:|----------|------|
| 1 | Anthropic Ireland, Limited | IE 4276970QH | P | 18.00 | 3.78 | 9BF0758D-5665749 | 11.09.2026 |

No Meta ad spend in September.

## PVN1 Part III (output documents, all "X" private person, type 41)

| # | Document | Date | Net | VAT |
|---|----------|------|----:|----:|
| 1 | STG-20260830-WPXK | 02.09.2026 | 2.81 | 0.59 |
| 2 | STG-20260828-2VTD | 05.09.2026 | 3.81 | 0.79 |
| 3 | STG-20260901-UDQV | 07.09.2026 | 11.24 | 2.36 |
| 4 | STG-20260905-LV87 | 10.09.2026 | 2.98 | 0.62 |
| 5 | STG-20260910-3KRZ | 12.09.2026 | 3.80 | 0.80 |
| 6 | STG-20260908-QFWH | 17.09.2026 | 3.81 | 0.79 |
| 7 | STG-20260912-YMBP | 17.09.2026 | 3.64 | 0.76 |
| 8 | STG-20260915-7DJ7 | 17.09.2026 | 2.81 | 0.59 |
| 9 | STG-20260916-MCJE | 24.09.2026 | 2.11 | 0.44 |
| | **Total** | | **37.01** | **7.74** |

PVN2 (ESL): empty. The one EE-seller completion (97MN) goes to OSS Q3; see
`oss-2026-q3-prep.md`.

## GL vs filing: Meta duplicate (€5.00 RC base, net VAT €0)

Meta invoice **FBADS-046-106285148** (31.07, €5.00) was declared in
**July's** PVN1-II, which is correct. August's close booked it a second time
in GL. If August's return was filed from the GL, it appears there twice
(rows 50/55/64 overstated by 5.00 / 1.05 / 1.05).

The GL correction was posted in September (`meta-FBADS-046-106285148-rev-dupfix`,
tax_period 2026-09). So GL's September RC sweep shows 2.73 (3.78 − 1.05),
while this sheet files 3.78, using real September documents only. Net VAT
effect is zero either way.

**Decision (08.10.2026): leave August as filed. No *precizējums*.** The
error has no tax effect (RC output = RC input), so there is no unpaid tax
and therefore no penalty or interest base. If VID ever asks, the answer is:
a duplicate booking of a July invoice, corrected in GL on 30.09.2026
(`meta-FBADS-046-106285148-rev-dupfix`).

Accepted permanent differences:
- August filing vs. corrected GL: rows 50/55/64 +5.00/+1.05/+1.05.
- September filing (3.78) vs. GL September RC sweep (2.73).
- Q3 reverse-charge base declared to VID is €5.00 above Meta's actual
  invoices, which is what Meta's VIES report will show.
- August PVN1-I probably also lists the Swedbank €0.84 invoice as
  "6012050226 (16-31.07.2026)" dated 31.07. The real invoice is
  V0000909660, dated 15.08. Same amount and VAT, left as filed.

## EDS import

`pvn-2026-09-eds-import.xml` (same folder) uses the `DokPVNv7` format,
generated from the July file with the figures above.
