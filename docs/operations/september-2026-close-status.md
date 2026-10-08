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

## Remaining

1. **File the September PVN** by 20.10 (€2.93, pay by 23.10):
   `docs/vid/pvn-2026-09-prep.md` + `pvn-2026-09-eds-import.xml`.
2. **File Q3 OSS** by 31.10 (LT €4.15 + EE €4.59): `docs/vid/oss-2026-q3-prep.md` + `oss-2026-q3-eds-import.xml`.
   After payment, post two C.12 events.
3. ~~Meta duplicate in August's PVN1-II~~ **Decided 08.10.2026: leave August as filed** (no tax effect). See `pvn-2026-09-prep.md`.
4. ~~UJRJ €34.10 on 2630~~ **Written off 08.10.2026** (staff decision:
   write off, no claw-back of the €28.80 seller credit). Entry
   `ujrj-writeoff-b7a371ed`: Dr 7790 bad debt / Cr 2630 €34.10, dated
   30.09. Root cause: EveryPay auto-refunded the buyer 1.3 seconds after
   payment (the cart-rollback incident,
   `docs/plans/2026-06-24-cart-rollback-refund-fix.md`), but the order
   completed anyway. There is no VAT effect: the June commission and
   shipping supply to the seller did happen. Typed as C.3 with the
   EveryPay payment id in `included_txn_refs`, so the period-close
   checklist sees the card receipt as cleared. Two things left for the
   accountant: (a) whether a €34.10 write-off that doesn't meet the UIN
   doubtful-debt criteria is a non-business expense for CIT; (b) the
   order row still shows `everypay_payment_state='settled'` and
   `refund_status=null`. That is untouched app data and can be fixed
   separately if wanted.
5. **Lock periods.** 2026-08 and 2026-09 are both still `open`. Soft-lock
   them, and hard-lock after the PVN is filed (lifecycle-cutover runbook
   discipline).
6. **October:** Hetzner ×2, Unisend 2603263 payment (06.10), Swedbank
   V-invoice for 01–15.10.
