/**
 * July 2026 close — final two entries: OSS Q2 2026 payment + corrected P.1.
 *
 * **Executed against production on 2026-08-03** (direct `execute_sql` calls
 * to `insert_journal_entry` through Supabase MCP, same constraint as every
 * other script in this backfill family — no service-role key in-session).
 *
 * Entry 1 — OSS Q2 2026 payment (`july_2026_oss_q2_payment`, id=af4782d0-
 * e4d1-4f8a-8379-e7af1059524a). Clears the €10.35 VID payment (11.07, ref
 * EDS003091DD / EDS doc 115617661) that `july-2026-backfill-data.ts` had
 * deliberately left unposted pending investigation. The €1.18 gap between
 * GL's own Q2 OSS accrual (€9.17, verified order-by-order: LT = SXYU+KFFH+
 * NNV9, EE = HVFJ+RVY5+NKZF+KUTW+YKKT) and the declared/paid €10.35 is now
 * fully explained: the EDS filing used payment-DATE for order E93F (paid
 * 24.06, straddling the quarter boundary), while GL books it on completion/
 * invoice-date (04.07, `july_2026_entry_2`) — plus ~1-2 cents of permanent
 * aggregate-vs-per-invoice rounding (EDS recomputes VAT from the aggregate
 * base per country; GL sums per-invoice). Per staff decision: Q2 stays filed
 * as-is (OSS accepts no amendments); the timing difference self-corrects at
 * Q3. Lines: Dr 5711 (LT) €3.31, Dr 5712 (EE) €7.04, Cr 2610 €10.35.
 *
 * Entry 2 — Corrected July P.1 (`close_2026_07_corrected`, id=af9cdebd-
 * d68a-4c2c-85e7-b50381477749). Replaces the reversed `close_2026_07`
 * (reversal: `close_2026_07_reversal`, see july-2026-close-p1-reversal.ts).
 * Net domestic VAT position for tax_period=2026-07 (excluding the reversed
 * pair): input €8.18 > output €3.83 → refund €4.35. Per staff decision,
 * folds in the €0.07 residual left on 5710-09 from June's PVN payment
 * discrepancy (€13.59 GL vs €13.66 actual, see july_2026_entry_16) rather
 * than amending June's filed return — total refund receivable €4.42. Lines:
 * Dr 5710-LV-OUT €3.83, Cr 5710-LV-IN €8.18, Dr 2380 €4.42, Cr 5710-09 €0.07.
 *
 * Post-run verification: global Σdebit=Σcredit (920875=920875), 2610 now
 * matches the Swedbank statement exactly (€376.67, closing the €10.35 gap
 * documented in july-2026-backfill-data.ts), 5710-09/5710-LV-IN/5710-LV-OUT
 * all cleared to zero, 5711=-165¢ (Q3 WRRJ €1.64 + 1¢ rounding), 5712=-98¢
 * (Q3 4CUP €0.97 + 1¢ rounding) — both exactly as predicted by the OSS
 * reconciliation above.
 *
 * NOT addressed here (separate follow-up, per staff decision to settle July
 * first): deciding payment-date vs completion-date as the standing OSS
 * convention, documenting the permanent aggregate-vs-per-invoice rounding
 * gap, building an engine type for OSS payments (this pass used a raw
 * manual entry, mirroring july-2026-close-p1-reversal.ts's pattern — no
 * mapping-table type exists yet for "OSS payment made"), and wiring the
 * dormant `oss_submissions` "mark filed" workflow to actually get used.
 *
 * Usage: this file is a documentation record, not a runnable idempotent
 * script (no `.env.local` credentials existed in the session that executed
 * it, so it was posted via direct SQL rather than `npx tsx`). Re-deriving
 * these entries would require the same `insert_journal_entry` calls shown
 * in the narratives above; both are already posted and idempotency-guarded
 * by `(source_doc_type, source_doc_id, type_id)`.
 */
export const JULY_2026_OSS_PAYMENT_ENTRY_ID = 'af4782d0-e4d1-4f8a-8379-e7af1059524a';
export const JULY_2026_CORRECTED_P1_ENTRY_ID = 'af9cdebd-d68a-4c2c-85e7-b50381477749';
