# Bank-statement reconciliation (PR #4b) — design

**Date:** 2026-06-03
**Status:** validated design, ready for implementation plan
**Origin:** The May 2026 backfill surfaced that the period-close checklist reconciles only GL `2610` (operating) against its Swedbank statement (item 2), with the expected closing hardcoded in `BANK_WALK_CHECKPOINTS` and added by hand each backfill PR. The new e-commerce settlement account `2620` — where all marketplace cash now lands — has **no standing reconciliation gate**. This makes the bank reconciliation data-driven and multi-account.

## Decisions (brainstormed 2026-06-03)

1. **Reconcile depth:** closing-balance per account (not line-level transaction matching — overkill at soft-launch volume).
2. **Input method:** manual staff entry (no statement-file parsing — it's one figure per account per month).
3. **Account scope:** data-driven via an `accounts.is_bank_reconcilable` flag (not a hardcoded list).
4. **Historical data:** seed existing `BANK_WALK_CHECKPOINTS` closings into the new table; retire the constant.
5. **Decoupled from the May filing:** the May soft-lock + 20 June PVN do not depend on this; #4b is the durable improvement for June onward.

## Section 1 — Data model

Migration (`126_bank_statement_reconciliation.sql`):

```sql
alter table accounts add column is_bank_reconcilable boolean not null default false;
update accounts set is_bank_reconcilable = true where code in ('2610','2620');

create table bank_statement_closures (
  id uuid primary key default gen_random_uuid(),
  account_code text not null references accounts(code),
  period_key text not null,              -- 'YYYY-MM'
  closing_balance_cents bigint not null, -- signed net-debit (matches getAccountClosingBalance)
  statement_ref text,
  statement_date date,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  notes text,
  unique (account_code, period_key)
);
```

- RLS: staff-SELECT + staff-INSERT/UPDATE; service role bypasses.
- **Editable while the period is `open`** (unlike journal entries — a mistyped balance is correctable); frozen once soft/hard-locked.
- Audit event `bank_closure.recorded` (regulatory) on every write.
- Sign convention: store net-debit cents so the gate compares directly to `getAccountClosingBalance` (2610 → +38378, 2620 → +14920).

## Section 2 — Gate logic (item 2)

`buildItem2` becomes a multi-account loop backed by a new query `getBankClosureReconciliation(supabase, periodKey, asOf)` returning `{account_code, gl_closing, recorded_closing|null, status}[]`.

Per-account classification (the "in-use" guard avoids fabricated rows + spurious blocks):

```
flagged account, no GL lines by asOf   → skip (not part of this period)
has lines, no closure recorded         → manual_pending
has lines, GL closing == recorded      → pass
has lines, GL closing != recorded      → fail (with Δ)
```

Roll-up: any fail → item 2 fail; else any manual_pending → manual_pending; else pass. Detail is per-account, e.g. `2610 €383.78 ✓; 2620 €149.20 ✓` or `2610 ✓; 2620: no statement closing recorded`. Label → account-agnostic "Bank reconciliation (GL vs Swedbank statements)".

`getPhase0BankCloseForPeriod` / `BANK_WALK_CHECKPOINTS` stop being read; the constant is the seed source (Section 3) then deleted in this PR.

## Section 3 — Historical seed + in-use rule

Migration seeds existing closings so closed periods keep reconciling:
- **2610:** one row per `BANK_WALK_CHECKPOINTS` entry (2025-07 → 2026-05, real Swedbank closings), `statement_ref = 'historical-seed (migrated from BANK_WALK_CHECKPOINTS)'`, `recorded_by = null`.
- **2620:** just `2026-05 → €149.20` (its first active month).

The **in-use guard** (a flagged account is only required when it has ≥1 journal_line by `asOf`) means 2620 "appears" in the reconciliation exactly when it starts holding money — April's checklist skips 2620 entirely (no fake zero-closings, no noise on closed periods).

## Section 4 — Staff UI

Server action `recordBankStatementClosing({ period_key, account_code, closing_balance_eur, statement_ref, statement_date, notes })`:
- validates staff auth, `is_bank_reconcilable`, period `open`; euros → signed cents; upsert on `(account_code, period_key)`; fires `bank_closure.recorded`; returns `{success}|{error}`.

UI lives **inline on the period-close page** (mirrors `EverypaySettlementForm`): when item 2 shows `manual_pending` for an account, a compact "Record closing" form renders there (period + account pre-filled; staff types balance + statement ref off the open Swedbank statement). Save → Refresh → re-evaluate. Editing (while open) uses the same pre-filled form. Reuses the existing euro-amount input + cents conversion. No new nav entry.

## Section 5 — Testing

- `queries.test.ts` — `getBankClosureReconciliation`: in-use skip, recorded+match → pass, recorded+mismatch → fail, in-use+no-record → manual_pending.
- `checklist.test.ts` — `buildItem2` multi-account roll-up; update existing constant-based item-2 tests to the table-driven mock.
- `bank-closure-actions.test.ts` — action validation (non-staff, non-flagged account, locked period) + upsert + audit fire.
- `phase0-reconciliation-constants.test.ts` — retire `BANK_WALK_CHECKPOINTS` tests.
- Integration `period-close.test.ts` — verify synthetic 2027 periods skip both accounts (no lines → in-use guard) → item 2 passes; add one case seeding a closure + matching GL for the pass path.

## Out of scope (YAGNI)

- Statement-file parsing / upload (PDF/CSV/CAMT). Deferred unless line-level matching is later needed.
- Line-level transaction matching.
- Opening-balance / turnover three-point checks (closing-balance match is sufficient at current volume).

## Landing

Decoupled from the 20 June PVN filing. Soft-lock + file May on current code; ship #4b in parallel. The migration seeds May's 2610 (€383.78) + 2620 (€149.20), so once deployed, item 2 on May retroactively shows both accounts reconciled regardless of lock state (the seed is a plain insert, unaffected by the period-status trigger, which only gates `journal_entries`).
