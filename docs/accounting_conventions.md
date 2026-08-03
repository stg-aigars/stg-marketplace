# Accounting Conventions

Canonical reference for recurring accounting decisions that would otherwise
get re-investigated (or re-relitigated) every time they surface. `CLAUDE.md`
cross-references specific sections here (e.g. "§8" for the layered
idempotency pattern) — those references depend on this file's section
numbering staying stable; if you renumber, update `CLAUDE.md` too.

---

## 1. Purpose

This doc exists because of a concrete incident: a quarterly OSS return
included a €10.35 payment that didn't match the ledger's own €9.17 accrual
for the same quarter, and the €1.18 gap took real investigation to explain
(see §3 for the worked example). The gap wasn't a bug — it was an
undocumented date-convention difference between three places that all
compute "quarterly VAT liability" independently: the GL, the staff OSS page,
and the actual filed declaration. Write decisions down here so the next
gap is a five-minute lookup, not a re-investigation.

## 2. VAT/OSS revenue-recognition date convention

**Standing convention: completion-date.** The GL recognizes O.1–O.5
commission/shipping revenue (and therefore VAT/OSS liability) at order
**completion**, not at cart payment or order creation. This follows Article
63 of Directive 2006/112/EC — the general rule that VAT becomes chargeable
when the service is supplied, which for STG's commission service is when
the sale is fulfilled (order completed), not when the buyer's payment
clears escrow.

**Known exception, not yet invoked:** Article 65 makes VAT chargeable
earlier, on receipt, when payment is made "on account" before the service
is performed. Whether a buyer's escrow payment counts as payment on account
for STG's *commission service* specifically (as opposed to payment for the
goods, which is between buyer and seller and not STG's VAT event) is a real
question or straddling orders — and it is the accountant's call, not an
engineering decision. Until the accountant says otherwise, completion-date
stays the default for every system that computes VAT/OSS liability: the GL,
the `/staff/oss` page, and `/staff/bookkeeping`.

## 3. Straddling orders — worked example (E93F)

Order `STG-20260624-E93F`: paid 24.06.2026 (bank + wallet, hybrid), completed
04.07.2026 (invoice issued, O.5 posted as `july_2026_entry_2`). It straddles
the Q2/Q3 2026 boundary.

- **GL** (completion-date): books E93F entirely in Q3 (July).
- **The actual Q2 OSS filing** (EDS doc 115617661, 11.07.2026): included
  E93F's EE base (€5.00) in Q2 — the filer used payment-date for this one
  order, which was a reasonable read under Article 65 but not the standing
  GL convention.

Resolution reached 2026-08-03: **Q2 stays filed as-is.** OSS declarations
don't accept amendments (a *precizējums* costs more staff attention than
the discrepancy is worth), and the timing difference is genuinely
self-correcting — E93F's own liability sits in Q3's GL and nets out against
next quarter's declaration automatically. The lesson isn't "fix Q2," it's
"the next straddling order shouldn't take an investigation to explain" —
hence this doc.

## 4. OSS ↔ GL ↔ staff-page alignment invariant

**Invariant: every system that computes quarterly OSS liability must use
the same predicate — `orders.status = 'completed'`, bucketed by
`orders.completed_at`.** Before 2026-08-03, `/staff/oss` (`page.tsx` +
`actions.ts`) bucketed by `orders.created_at` and didn't filter by status
at all (any order not `cancelled`/`refunded` counted, including orders
still at `pending_seller`/`accepted`/`shipped` with no GL entry posted yet).
That's a materially different, more inclusive basis than the GL's — a
third divergent definition of "this quarter's liability," on top of the
payment-date-vs-completion-date question in §2. Fixed 2026-08-03 to match
the GL exactly. If you touch either query again, keep them identical:
diverging silently is exactly how the E93F gap went unnoticed for a month
instead of being an immediately-explainable timing note.

## 5. Permanent aggregate-vs-per-invoice rounding gap

Expect a cent or two of *permanent* difference between the GL's OSS
sub-totals (5711/5712) and the EDS-filed VAT amount, every quarter, even
after §4's alignment fix. Mechanism: EDS recomputes VAT from the aggregate
net base per country (`base × rate`, rounded once), while the GL sums
per-invoice VAT (each order's VAT rounded independently, then summed). Same
base, same rate, different rounding order, different cent-level result.
This is not a bug and not correctable — don't re-investigate it each
quarter. The same mechanism produced the 7-cent gap on June 2026's domestic
PVN payment (declared €13.66 vs GL's €13.59), folded into July's close
rather than amending June's filed return.

## 6. Posting an OSS quarterly payment — C.12

Once a quarter's OSS return is filed and paid, post the cash outflow via
the engine (`emit()` with `event_type: 'oss.payment_made'`) rather than a
raw one-off entry — every OSS payment before 2026-08-03 was posted as a
manual raw `insert_journal_entry` call because this type didn't exist yet
(see `scripts/july-2026-oss-and-p1-close.ts` for the last one done that
way). **One emit per consumption member state** — a quarter with both LT
and EE liability needs two C.12 events, each crediting down 2610 and
debiting the corresponding payable (5711 for LT, 5712 for EE) by that
country's declared VAT amount. Required payload: `oss_country` ('LT' |
'EE'), `payment_cents`, `oss_quarter`, `eds_document_number`.

## 7. Posting a domestic PVN payment — C.11 (existing, unchanged)

Unchanged by this doc — see `src/lib/accounting/mapping.ts`'s C.11 entry.
Included here only so this file is the one place to look for "how do I post
a VAT-authority cash payment," regardless of which regime it's under.

## 8. Layered idempotency (canonical pattern)

Referenced from `CLAUDE.md`'s Cron Routes section (`monthly-vat-close`).
Two independent layers are both required — the engine's UNIQUE constraint
alone does not catch cross-`source_doc_id` collisions within the same
period:

- **Layer 1 — engine UNIQUE.** `journal_entries` has a UNIQUE index on
  `(source_doc_type, source_doc_id, type_id)`. Catches the dominant retry
  case: the *same* caller retrying with the *same* `source_doc_id`.
- **Layer 2 — cron-level period skip.** Before emitting, the cron queries
  `journal_entries WHERE accounting_period = target AND type_id = 'P.1'`.
  If a row already exists (posted under a *different* `source_doc_id` —
  e.g. a backfill's `close_<YYYY>_<MM>`-style id versus a manual
  replacement id like `close_2026_07_corrected`), the cron returns
  `skipped_period_already_closed` instead of double-posting.

Both layers are required together: Layer 1 alone would let a backfill and a
cron fire both post a P.1 for the same period (different `source_doc_id`s,
so no UNIQUE conflict); Layer 2 alone would race under concurrent writers
without a DB-level backstop. Any future code path that decides whether to
emit a period-level consolidation entry (VAT close, future analogues) should
implement both layers, not just the engine's.
