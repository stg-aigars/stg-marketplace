-- Add 'vat_payment' to journal_entries.entry_type (June 2026 backfill, C.11).
--
-- C.11 (VID VAT payment made) mirrors C.8 (VID VAT refund received) but was
-- missing an entry_type: the TypeScript JournalEntryType union already got
-- 'vat_payment' (mapping.ts / types.ts), but this DB-level CHECK constraint —
-- defined inline on the table in migration 093 — was not updated in the same
-- pass, so the first live emit (June 2026 backfill entry 62, clearing the May
-- PVN payable) failed with a 23514 check_violation. Postgres has no ALTER
-- syntax for an inline CHECK, so this drops and recreates it by name with the
-- new value appended.

alter table public.journal_entries
  drop constraint journal_entries_entry_type_check;

alter table public.journal_entries
  add constraint journal_entries_entry_type_check
  check (entry_type in (
    'checkout',
    'order',
    'refund',
    'dispute',
    'settlement',
    'payout',
    'accrual',
    'manual',
    'reversal',
    'dormancy',
    'writeoff',
    'provision',
    'depreciation',
    'period_close',
    'equity_contribution',
    'shareholder_loan',
    'vendor_invoice',
    'vendor_payment',
    'vat_refund',
    'vat_payment'
  ));
