# September 2026 close: status (08.10.2026)

First month where all marketplace activity was posted by the lifecycle
wraps, end to end (stage 3 cutover, #433). August was closed directly in
production on 11.09.2026 (`created_by = 'aug_2026_close_claude'`, entries
tagged `posting_context.aug_2026_close`). No repo script was committed for
it. August balances reconcile exactly to its recorded statement closings
(2610 €344.30, 2620 €867.22).

## Done

- **Lifecycle coverage check.** All 10 September completions have an O.x
  entry (9× O.1 LV, 1× O.5 EE). No orders in flight
  (pending/accepted/shipped/delivered/disputed).
- **Wallet integrity.** Σ wallets = GL 5351 = €409.05. 5590 suspense = 0.
- **WD-2026-00011 cash-account fix.** It completed 10.09, one day before
  #440 deployed, and was booked against 2610. Reversed and re-posted
  against 2620 (`e09d939d-…-rev-2620fix` / `-2620fix`, `created_by =
  'sep_2026_close_claude'`), with `accounting.posted` audit rows. This is
  the same pattern as August's WD-00005..00010 fixes.
- **Q3 OSS figures:** `docs/vid/oss-2026-q3-prep.md`. LT €4.15 + EE €4.59
  = €8.74. E93F is excluded because it was already declared in Q2.

## GL position 30.09.2026 (lifecycle + fix only)

| Account | GL | Notes |
|---------|---:|-------|
| 2610 | 344.30 | No September movement posted yet |
| 2620 | 262.16 | Bank-link inflows €181.00 − withdrawals €786.06 (WD-11..14) |
| 2630 | 135.20 | Unsettled card payments, see below |
| 5710-LV-OUT | 7.74 Cr | Sept output VAT, 9× O.1, base €37.01 |
| 5710-LV-IN | 0.00 | No Sept vendor invoices posted yet |
| 5710-09 | 1.20 Cr | August PVN payable. Payment not yet posted |
| 2380 | 0.07 Dr | July VID refund residual (carried) |
| 5310-UN | 51.19 Cr | Unisend 2602315 (13.24) + 2602785 (37.95). Paid in Sept |
| 5310-META | 5.00 Cr | Carried from July |
| 5711 / 5712 | 4.15 / 4.60 Cr | Q3 OSS, see prep sheet |

### Open items on 2630 (card payments with no matching C.3)

| C.1 date | Order | Amount |
|----------|-------|-------:|
| 06.06.2026 | `june_2026_entry_12` | 34.10 |
| 30.08.2026 | STG-20260830-WPXK | 16.90 |
| 07.09.2026 | STG-20260907-97MN | 31.80 |
| 08.09.2026 | STG-20260908-QFWH | 27.10 |
| 15.09.2026 | STG-20260915-7DJ7 | 16.90 |
| 16.09.2026 | STG-20260916-MCJE | 8.40 |

The June item has sat on 2630 since June. Either its settlement was netted
into a batch whose C.3 doesn't list it, or it was never settled. Check
against the EveryPay settlement report.

## Blocked: source documents needed

These need the real documents, the same way every previous month did:

1. **Swedbank statements for September 2026**, 2610 and 2620. They are
   needed for:
   - C.3 settlements of the card payments above
   - Unisend payments (06.09 for 2602785, plus 2602315)
   - The August PVN payment to VID (€1.20, C.11)
   - Bank fees (maintenance ×2, card fee, payment-order commissions for
     WD-11..14)
   - The Meta €5.00 payable
   - The `bank_statement_closures` rows for 2026-09
2. **Vendor invoices dated September:**
   - Unisend September invoice (input VAT)
   - Swedbank e-commerce platform invoice(s) for 16–31.08 and 01–15.09
   - Meta FBADS invoices (reverse charge)
   - Any SaaS invoices (Anthropic etc., reverse charge)

Once these are posted, run the period-close checklist. Then post the
September P.1 (`close_2026_09`, swept by `tax_period`) and file the
September PVN by 20.10.2026. Then soft-lock and hard-lock 2026-08 and
2026-09; both are still `open`.

The `monthly-vat-close` cron did **not** post a P.1 for 2026-09. That is
correct here: a P.1 posted before the input-VAT backfill would need
reversing, as July's did.
