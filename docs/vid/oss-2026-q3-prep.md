# Union OSS — Q3 2026 (01.07–30.09.2026) declaration prep

Prepared 08.10.2026 from production GL (O.3 / O.5 entries, completion-date
basis per `docs/accounting_conventions.md` §2). Filing + payment deadline:
**31.10.2026**.

**FILED 08.10.2026, EDS 117020607.** LT 19.76/4.15 and EE 19.12/4.59, exactly as below. Recorded in `oss_submissions` (Q2 backfilled alongside it from EDS 115617661). Payment of €8.74 is due 31.10.2026 and not yet made.

## Per-order detail (GL)

| Completed  | Type | Invoice / order         | Country | Net base | VAT (GL) |
|------------|------|-------------------------|---------|---------:|---------:|
| 11.07.2026 | O.3  | INV-2026-00031          | LT      |     7.86 |     1.64 |
| 11.08.2026 | O.3  | STG-20260806-P96H       | LT      |     3.31 |     0.69 |
| 14.08.2026 | O.3  | STG-20260811-KBNW       | LT      |     3.47 |     0.73 |
| 19.08.2026 | O.3  | STG-20260814-8B37       | LT      |     5.12 |     1.08 |
| 04.07.2026 | O.5  | INV-2026-00028 (E93F)   | EE      |     5.00 |     1.20 |
| 17.07.2026 | O.5  | INV-2026-00033          | EE      |     4.03 |     0.97 |
| 07.08.2026 | O.5  | STG-20260802-B64J       | EE      |     2.99 |     0.72 |
| 19.08.2026 | O.5  | STG-20260813-9FAP       | EE      |     7.50 |     1.80 |
| 17.09.2026 | O.5  | STG-20260907-97MN       | EE      |     4.60 |     1.10 |

No Q3 credit notes (O.7/O.8) on LT/EE orders. Every Q3 completion has its GL
entry. No orders are in flight.

## E93F: already declared in Q2, so exclude it

`STG-20260624-E93F` (INV-2026-00028) was **already declared in the Q2 OSS
return** (EDS doc 115617661, payment-date basis). GL books it in Q3. Per the
2026-08-03 decision (§3), Q2 stays as filed and the timing difference
corrects itself now. So **leave E93F out of the Q3 EE line**, or the €1.20 is
declared twice.

## Figures to file

| Member state | Rate | Taxable base | VAT (EDS aggregate, base × rate) |
|--------------|-----:|-------------:|---------------------------------:|
| LT           |  21% |    **19.76** |      19.76 × 0.21 = 4.1496 → **4.15** |
| EE           |  24% |    **19.12** |      19.12 × 0.24 = 4.5888 → **4.59** |
| **Total payable** | |              |                         **8.74** |

## GL tie-out

| Account | Balance 30.09.2026 | Payment | Residual after C.12 | Explanation |
|---------|-------------------:|--------:|--------------------:|-------------|
| 5711 (LT) | 4.15 Cr | 4.15 | 0.00 | Q3 per-invoice 4.14 + Q2 residual 0.01 (accrued 3.32, paid 3.31) |
| 5712 (EE) | 4.60 Cr | 4.59 | 0.01 Cr | Q3 per-invoice 5.79 − E93F 1.20 prepaid in Q2 + 0.01 Q2 rounding |

The leftover cent on 5712 is the permanent aggregate-vs-per-invoice rounding
gap (§5). It is expected; don't investigate it.

## EDS import

`oss-2026-q3-eds-import.xml` (same folder) uses the `DokOSSDv2` format,
modelled on the filed Q2 declaration (EDS 115617661). The Q2 file confirms
the E93F treatment: Q2's EE base 29.35 = GL Q2 base 24.35 + E93F 5.00.
LT 15.78 matches GL exactly. `Korekcija` is left empty on purpose: E93F is
excluded from Q3 rather than corrected as a prior-quarter adjustment.

## After filing

Post two C.12 events (§6), one per member state, crediting 2610:
`oss_country`, `payment_cents` (415 / 459), `oss_quarter: '2026-Q3'`,
`eds_document_number`. Then record `oss.submission_recorded` via
`/staff/oss` → "Mark filed".
