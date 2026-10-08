# September 2026 close: status (08.10.2026)

**GL closed for 2026-09.** Both banks reconcile exactly to the Swedbank
statements. P.1 `close_2026_09` is posted. VAT return and Q3 OSS figures are
ready to file. The periods are not locked yet; see "Remaining" below.

Background: this is the first month where all marketplace activity was
posted by the lifecycle wraps (stage 3 cutover, #433). August was closed
directly in production on 11.09.2026 (`created_by =
'aug_2026_close_claude'`). No repo script was committed for it.

## What was posted (`created_by = 'sep_2026_close_claude'`, `posting_context.sep_2026_close`)

29 entries in total, each with an `accounting.posted` audit row
(`metadata.manual_execute_sql = true`). They were posted through
`insert_journal_entry` via execute_sql, the same route July and August used.

| Group | Entries |
|-------|---------|
| WD-2026-00011 cash-account fix | C.4 reversal + re-post to 2620 (it completed one day before #440 deployed) |
| EveryPay card settlements (C.3, 2630→2620) | WPXK 16.90, 97MN 31.80, QFWH 27.10, 7DJ7 16.90, MCJE 8.40 (MDR fees €1.21 netted to 7710) |
| Vendor invoices (I.1) | Swedbank V0000915445 €2.18 · Inbox.eu BEU-1107881-09/2026 €9.99 · Unisend 2603263 €15.58 (payable, paid 06.10) |
| Reverse charge (I.3) | Anthropic Ireland 9BF0758D-5665749 €18.00 (new EU counterparty) |
| Vendor payments (I.7) | Unisend 2602785 €37.95, Unisend 2602315 €13.24 |
| VID (C.11) | August PVN €1.20 (EDS0032718F) |
| Bank fees (I.5) | 2610: €12.32 · 2620: €6.56 |
| Meta duplicate fix | Reverse August's second booking of FBADS-046-106285148 + I.7 clearing 5310-META €5.00 (net 2610 effect zero) |
| P.1 `close_2026_09` | Dr 5710-LV-OUT 7.74 / Cr 5710-LV-IN 4.81 / Cr 5710-09 2.93 |

Counterparties created: **Anthropic Ireland, Limited** (IE4276970QH) and
**SIA INBOKSS** (LV40003560720).

`bank_statement_closures` 2026-09 rows: 2610 €249.49, 2620 €355.49, each
with a `bank_closure.recorded` audit row. The camt.052 reports run to
08.10, so the 30.09 closings were derived both forward (from the opening
balance) and backward (from the 08.10 balance minus October lines). Both
directions agree.

## Position 30.09.2026

| Account | Balance | |
|---------|--------:|-|
| 2610 | 249.49 | = statement ✓ |
| 2620 | 355.49 | = statement ✓ |
| 2630 | 0.00 | UJRJ €34.10 written off to 7790 (see below) |
| 5351 seller wallets | 400.05 Cr | = Σ wallets ✓ (Sept-end; October activity excluded) |
| 5590 suspense | 0 | ✓ |
| 5710-LV-IN / -OUT | 0 / 0 | cleared by P.1 |
| 5710-09 | 2.93 Cr | Sept PVN payable, due 23.10 |
| 2380 | 0.07 Dr | July VID-refund residual (carried, as in August) |
| 5310-UN | 15.58 Cr | Unisend 2603263, paid 06.10 |
| 5310-META | 0 | cleared (was 5.00, duplicate fix) |
| 5711 / 5712 | 4.15 / 4.60 Cr | Q3 OSS, see `docs/vid/oss-2026-q3-prep.md` |

## Document check: anything missing for September?

Nothing for September. Every statement line maps to a document or to
existing GL:

- **Hetzner 085001260871 (01.10, Jul+Aug usage €8.98) and 080001231263
  (04.10, Sep usage €4.49).** Both are dated October and card-charged
  04.10 / 07.10, so they belong to **October**, following the June
  precedent (invoice date). The expense lags the usage months by one to
  three months. It is immaterial, and RC VAT is net zero.
- **Swedbank e-invoices.** V0000915445 (01–15.09) is booked here.
  V0000909660 (01–15.08, €0.84) is **already in the GL**, but August
  mislabelled it as "6012050226 (16-31.07.2026)" (`swedbank-6012050226-
  2026-07-b-2610fix`). Amount, VAT and tax period (August) are all correct;
  only the label is wrong. No repost needed.
- **Unisend 2603263.** 8 parcels match the 8 September dispatches by
  `shipped_at`: 4 LV-EE (UDQV, LV87, QFWH, 97MN) and 4 LV-LV (3KRZ, 7DJ7,
  YMBP, MCJE).

## Remaining (updated 08.10.2026)

Done:
- September PVN filed: EDS 117020580 (€2.93).
- Q3 OSS filed: EDS 117020607 (€8.74).
- `oss_submissions` rows recorded for Q2 (EDS 115617661, paid 11.07) and Q3,
  each with an `oss.submission_recorded` audit row. The amounts come from
  the filed XMLs, not from the `/staff/oss` recompute. That recompute
  bucket-includes E93F in Q3 EE and would show ≈5.79 instead of the filed
  4.59.
- August decision recorded (leave as filed). UJRJ written off.
- **2026-08 and 2026-09 soft-locked** 08.10.2026. All checklist items 1–9
  were verified via SQL: Σ balanced, bank closures match, wallets
  927.36 / 400.05, 5590 = in-flight (44.00 / 0), 2351 and 5410 at 0,
  2630 = in-transit (51.00 / 0), P.1 present, no negative wallets.
  `accounting.period_status_changed` audit rows written.

Open:
1. **Pay:** PVN €2.93 by 23.10, OSS €8.74 by 31.10. Then post C.11 (PVN)
   and two C.12 entries (OSS: LT 4.15 / EE 4.59). These go in October,
   where the cash moves. Set `oss_submissions.payment_cleared_at` for Q3.
2. **Hard-lock 2026-08 and 2026-09.** Hard-lock is irreversible; waiting
   for confirmation.
3. **October:** Hetzner ×2 (RC, dated October), Unisend 2603263 payment
   (06.10), Swedbank V-invoice for 01–15.10.
