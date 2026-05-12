-- Seed fixed_assets with the C&C MacBook Pro 14" M5 (IT-2026-001).
--
-- The asset has been depreciating since February 2026 (Phase 0 Entry 19 = month
-- 1 of 36; Entry 20 = month 2; phase0_entry_21 from PR #293 April backfill =
-- month 3). Phase 0's data file carried the asset metadata inside the
-- depreciation entry's payload but never inserted a fixed_assets row — the table
-- was empty until this migration.
--
-- The monthly-depreciation cron (PR #296) reads from this table to determine
-- which assets to depreciate; without a seeded row, the cron has nothing to
-- iterate.
--
-- Idempotent: ON CONFLICT DO NOTHING so re-running the migration on an already-
-- seeded environment is safe.
--
-- Source documents:
--   - C&C invoice 3308109 (20.01.2026), VAT LV40103177024
--   - Phase 0 Entry 14a (capitalization, Dr 1230 €1,511.40)
--   - Phase 0 Entries 19, 20 + april `phase0_entry_21` (months 1, 2, 3 of depreciation)

insert into public.fixed_assets (
  asset_code,
  description,
  serial_number,
  acquired_date,
  acquisition_cost_cents,
  vendor_invoice_id,
  account_code,
  useful_life_months,
  depreciation_start_date,
  disposed_date,
  disposal_proceeds_cents,
  notes
) values (
  'IT-2026-001',
  'MacBook Pro 14" Apple M5 16GB/512GB Silver INT',
  'SM9PXG4P2M6',
  '2026-01-20',
  151140, -- €1,511.40
  null,   -- vendor_invoices table not populated for Phase 0; references C&C invoice 3308109
  '1230', -- Other property, plant & equipment
  36,
  '2026-02-28', -- month 1 of depreciation; matches Phase 0 Entry 19 posting_date
  null,
  null,
  'Seeded in PR #296 ahead of monthly-depreciation cron handoff. Months 1-3 ' ||
  'were posted via Phase 0 backfill (Entries 19, 20) + April 2026 backfill ' ||
  '(phase0_entry_21). Cron takes over from month 4 (May 2026).'
)
on conflict (asset_code) do nothing;
