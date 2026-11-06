# October 2026 close: status (06.11.2026)

**GL closed for 2026-10.** Both bank accounts reconcile exactly to the
Swedbank statements, and P.1 `close_2026_10` is posted. The PVN return is
ready to file (`docs/vid/pvn-2026-10-prep.md`). The period is still **open**
(not soft-locked).

## What was posted (`created_by = 'oct_2026_close_claude'`, `posting_context.oct_2026_close`)

18 entries were posted via `insert_journal_entry` through execute_sql, the
same route as September. Each has an `accounting.posted` audit row
(`metadata.manual_execute_sql = true`).

| Group | Entries |
|-------|---------|
| EveryPay card settlements (C.3, 2630→2620) | GNV2 15.40, G8VV 8.10, 8FNF 20.10 (MDR €0.52 netted to 7710) |
| Vendor invoices (I.1) | Swedbank V0000921544 €0.96 (2610) · Unisend 2603771 €10.14 (5310-UN, paid 06.11) |
| Reverse charge (I.3, EU) | Hetzner 085001260871 €8.98 · Hetzner 080001231263 €4.49 · Anthropic Ireland 9BF0758D-8362686 €18.00 |
| Vendor payment (I.7) | Unisend 2603263 €15.58 (06.10) |
| Bank fees (I.5) | 2610: €10.89 (incl. €2.18 PIS commission "09.2026") · 2620: €5.21 |
| P.1 `close_2026_10` | Dr 5710-LV-OUT 2.93 / Cr 5710-LV-IN 1.92 / Cr 5710-09 1.01 |

The following were already in the GL before this close: lifecycle C.1 / C.2 /
C.4 / O.1, P.6 depreciation (cron), and September's C.11 (€2.93) and Q3 OSS
C.12 (LT 4.15 / EE 4.59), all posted 08.10.

`bank_statement_closures` rows for 2026-10: 2610 €178.92 and 2620 €370.66,
each with a `bank_closure.recorded` audit row.

## Position 31.10.2026

| Account | Balance | |
|---------|--------:|-|
| 2610 | 178.92 | = statement ✓ |
| 2620 | 370.66 | = statement ✓ |
| 2630 | 9.10 Dr | 6YXW card payment in transit (settled 01.11) ✓ |
| 5590 suspense | 9.10 Cr | 6YXW, completed 04.11 ✓ |
| 5351 seller wallets | 403.95 Cr | Equals 400.05 + Oct credits 79.20 − GNV2 wallet spend 31.50 − WD-2026-00015 43.80. Today's Σ wallets 438.15 = 403.95 + November credits 34.20 ✓ |
| 5710-LV-IN / -OUT | 0 / 0 | cleared by P.1 |
| 5710-09 | 1.01 Cr | October PVN payable, due 23.11 |
| 5310-UN | 10.14 Cr | Unisend 2603771, paid 06.11 |
| 5711 | 0 | Q3 OSS LT paid |
| 5712 | 0.01 Cr | Q3 OSS EE rounding residual: GL 4.60 vs filed/paid 4.59 (known, see September status) |
| 2380 | 0.07 Dr | July VID-refund residual (carried) |

## Open

1. **File the October PVN by 20.11 and pay €1.01 by 23.11.** Then post C.11
   in November.
2. **Soft-lock 2026-10** once the return is filed.
3. **November:** Unisend 2603771 payment (06.11, €10.14 + €0.57 fee), the
   6YXW settlement (01.11), and the PIS commission "10.2026" (expected
   early November). Also the Hetzner October+November combined invoice,
   expected around early December, since the October usage of €4.49 was
   below Hetzner's €10 minimum.
4. **OSS Q4:** ML8U (LT seller) is the first candidate, if it completes.
5. 5712 €0.01 residual: write off at year-end, or leave as is.
