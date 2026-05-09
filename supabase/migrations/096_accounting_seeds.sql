-- Accounting module — seed data (PR 1, migration 4 of 4).
--
-- Seeds:
--   - 52 accounts: chart of accounts (Latvian SME standard with marketplace
--     adaptations per Phase 0 v2 + v3 mapping table §A).
--   - 97 periods: monthly 2025-05 → 2030-12 (68), quarterly 2025-Q2 →
--     2030-Q4 (23), annual 2025 → 2030 (6). All seeded with status='open'.
--     Generated via generate_series so extending the window in a future
--     migration is a single end-date change. Window covers Phase 0 backfill
--     plus a 5+ year forward buffer; before this buffer expires (~2029) a
--     follow-up migration or cron route should extend it.
--   - 4 vat_rates: LV 21%, LT 21%, EE 20% (closed 2025-06-30), EE 24%
--     (open from 2025-07-01).
--   - 2 counterparties: VID tax authority and STG_INTERNAL self-counterparty,
--     with pinned constant UUIDs matching src/lib/accounting/
--     system-counterparties.ts (referenced by PR #2's posting engine and
--     PR #3's Phase 0 backfill).
--
-- All inserts use ON CONFLICT (pk) DO NOTHING so re-running is a no-op.

-- ============================================================================
-- 1. accounts (52 rows)
-- ============================================================================
--
-- Notes:
--   - is_vat=true for VAT clearing/payable accounts (5710 family, 5711, 5712).
--   - parent_code wires sub-accounts to their parent (5310-AN → 5310,
--     5710-LV-OUT → 5710, etc.) so trial-balance roll-ups can group cleanly.
--   - 1239 and 2352-A are contra_asset type (offset against parent assets).
--
-- VAT prefix is 5710 (Latvian SME standard adopted in Phase 0 v2). OSS-LT
-- and OSS-EE are top-level accounts (5711 / 5712) per v3 mapping table §A —
-- not 5710 sub-accounts — because OSS clearing has separate retention
-- semantics, separate reporting (OSS portal), and accountant guidance was to
-- keep OSS isolated from LV VAT in the GL.

insert into public.accounts (code, name_lv, name_en, type, is_vat, parent_code) values
  -- Assets (11)
  ('1230', 'Pārējie pamatlīdzekļi', 'Other property, plant & equipment', 'asset', false, null),
  ('1239', 'Uzkrātais nolietojums', 'Accumulated depreciation', 'contra_asset', false, '1230'),
  ('2310', 'Norēķini ar pircējiem un pasūtītājiem', 'Trade receivables', 'asset', false, null),
  ('2350', 'Norēķini ar citiem debitoriem', 'Other receivables (parent)', 'asset', false, null),
  ('2351', 'Atmaksu klīringa konts', 'Refund clearing', 'asset', false, '2350'),
  ('2352', 'Norēķini ar pārdevējiem (negatīvs wallet)', 'Negative wallet receivable', 'asset', false, '2350'),
  ('2352-A', 'Uzkrājumi šaubīgiem debitoriem', 'Allowance for doubtful accounts', 'contra_asset', false, '2352'),
  ('2380', 'Norēķini ar valsts un pašvaldību budžetu', 'VID receivable (tax authority)', 'asset', false, null),
  ('2610', 'Swedbank operatīvais konts', 'Swedbank operating account', 'asset', false, null),
  ('2630', 'EveryPay norēķinu konts (klīringa)', 'EveryPay clearing', 'asset', false, null),
  ('2670', 'Pārējie naudas līdzekļi', 'Other cash equivalents', 'asset', false, null),

  -- Liabilities & provisions (27)
  ('4190', 'Uzkrājumi paredzamajiem maksājumiem', 'Provisions (chargeback reserve)', 'liability', false, null),
  ('5310', 'Norēķini ar piegādātājiem', 'Trade payables (parent)', 'liability', false, null),
  ('5310-AN', 'Norēķini — Anthropic', 'Anthropic payable', 'liability', false, '5310'),
  ('5310-CC', 'Norēķini — C&C', 'C&C payable', 'liability', false, '5310'),
  ('5310-EP', 'Norēķini — EveryPay/Maksekeskus', 'EveryPay/Maksekeskus payable', 'liability', false, '5310'),
  ('5310-HE', 'Norēķini — Hetzner', 'Hetzner payable', 'liability', false, '5310'),
  ('5310-MK', 'Norēķini — Maksekeskus (collecting)', 'Maksekeskus collecting payable (post-PSD2 sunset)', 'liability', false, '5310'),
  ('5310-UN', 'Norēķini — Unisend', 'Unisend payable', 'liability', false, '5310'),
  ('5340', 'Aizņēmumi no saistītajām personām', 'Loans from related parties', 'liability', false, null),
  ('5350', 'Norēķini ar pārējiem kreditoriem', 'Other payables (parent)', 'liability', false, null),
  ('5351', 'Pārdevēju wallet saistības', 'Seller wallet liability', 'liability', false, '5350'),
  ('5410', 'Uzkrātās saistības', 'Accrued liabilities (parent)', 'liability', false, null),
  ('5410-EP', 'Uzkrātās maksājumu apstrādes izmaksas', 'Accrued payment-processing', 'liability', false, '5410'),
  ('5410-UN', 'Uzkrātās piegādes izmaksas', 'Accrued shipping', 'liability', false, '5410'),
  ('5590', 'Pagaidu (klīringa) konts', 'Suspense / unidentified', 'liability', false, null),
  ('5591', 'Phase-3 backfill korekcija', 'Backfill adjustment', 'liability', false, '5590'),
  ('5710', 'Norēķini par PVN', 'VAT payable (parent)', 'liability', true, null),
  ('5710-LV-OUT', 'PVN izejošais — LV', 'LV output VAT', 'liability', true, '5710'),
  ('5710-LV-IN', 'PVN ienākošais — LV (priekšnodoklis)', 'LV input VAT', 'liability', true, '5710'),
  ('5710-LV-RC-OUT', 'Iekšējais reversais — izejošais', 'Domestic RC output (Article 143.7)', 'liability', true, '5710'),
  ('5710-LV-RC-IN', 'Iekšējais reversais — ienākošais', 'Domestic RC input', 'liability', true, '5710'),
  ('5710-RC-OUT', 'Ārējais reversais — izejošais', 'Foreign RC output (non-LV services received)', 'liability', true, '5710'),
  ('5710-RC-IN', 'Ārējais reversais — ienākošais', 'Foreign RC input', 'liability', true, '5710'),
  ('5710-RC-EUSALES', 'EU B2B 0% reverse-charge sales', 'EU B2B 0% RC sales (PVN 2 ESL reporting)', 'liability', true, '5710'),
  ('5710-09', 'PVN klīringa konts', 'VAT settlement clearing', 'liability', true, '5710'),
  ('5711', 'OSS-LT (Lietuva)', 'OSS-LT clearing (B2C VAT to consumption MS LT)', 'liability', true, null),
  ('5712', 'OSS-EE (Igaunija)', 'OSS-EE clearing (B2C VAT to consumption MS EE)', 'liability', true, null),

  -- Equity (3)
  ('3110', 'Pamatkapitāls', 'Share capital', 'equity', false, null),
  ('3410', 'Pārskata gada nesadalītā peļņa', 'Retained earnings — current year', 'equity', false, null),
  ('3420', 'Iepriekšējo gadu nesadalītā peļņa', 'Retained earnings — prior years', 'equity', false, null),

  -- Revenue (4)
  ('6310', 'Ieņēmumi no komisijas un starpniecības', 'Commission / intermediary revenue (parent)', 'revenue', false, null),
  ('6310-C', 'Komisijas ieņēmumi', 'Commission revenue (10%)', 'revenue', false, '6310'),
  ('6310-S', 'Piegādes pārvaldības ieņēmumi', 'Shipping-management revenue', 'revenue', false, '6310'),
  ('6310-D', 'Konta uzturēšanas ieņēmumi', 'Dormancy fee revenue', 'revenue', false, '6310'),

  -- Expenses (7)
  ('7610', 'Pamatlīdzekļu nolietojums', 'PP&E depreciation', 'expense', false, null),
  ('7710', 'Maksājumu apstrādes izmaksas', 'Payment-processing cost', 'expense', false, null),
  ('7720', 'Piegādes/loģistikas izmaksas', 'Shipping/logistics', 'expense', false, null),
  ('7730', 'IT/SaaS izmaksas', 'IT/SaaS', 'expense', false, null),
  ('7740', 'Domēna un hostinga izmaksas', 'Domain & hosting', 'expense', false, null),
  ('7770', 'Citas saimnieciskās izmaksas', 'Other operating costs', 'expense', false, null),
  ('7790', 'Šaubīgo debitoru zaudējumi', 'Bad debt expense', 'expense', false, null)
on conflict (code) do nothing;

-- ============================================================================
-- 2. periods (97 rows)
-- ============================================================================
--
-- Window: 2025-05 → 2030-12 monthly, 2025-Q2 → 2030-Q4 quarterly, 2025 →
-- 2030 annual. Covers Phase 0 backfill (May 2025 onward) plus a 5+ year
-- forward buffer for the posting engine. Extending the window later is a
-- single end-date change in a follow-up migration; alternatively, a
-- cron/seed-periods route can maintain a rolling buffer.
--
-- All status='open' at seed time; transitions are operational. Quarterly
-- and annual periods exist alongside monthly so OSS / year-end-close
-- queries can address them by key.

-- Monthly: 68 rows (2025-05 → 2030-12)
insert into public.periods (period_key, period_type, status)
select to_char(d, 'YYYY-MM'), 'month', 'open'
from generate_series('2025-05-01'::date, '2030-12-01'::date, '1 month'::interval) as d
on conflict (period_key, period_type) do nothing;

-- Quarterly: 23 rows (2025-Q2 → 2030-Q4)
insert into public.periods (period_key, period_type, status)
select to_char(d, 'YYYY') || '-Q' || to_char(d, 'Q'), 'quarter', 'open'
from generate_series('2025-04-01'::date, '2030-10-01'::date, '3 months'::interval) as d
on conflict (period_key, period_type) do nothing;

-- Annual: 6 rows (2025 → 2030)
insert into public.periods (period_key, period_type, status)
select to_char(d, 'YYYY'), 'year', 'open'
from generate_series('2025-01-01'::date, '2030-01-01'::date, '1 year'::interval) as d
on conflict (period_key, period_type) do nothing;

-- ============================================================================
-- 3. vat_rates (4 rows)
-- ============================================================================
--
-- LV: 21% standard (PVN likums Article 41(1)).
-- LT: 21% standard (Lithuanian VAT Law Article 19(1)).
-- EE: 20% standard until 2025-06-30; 24% from 2025-07-01 (Estonian Parliament
--     decision 19 June 2025; permanent).
-- valid_from backdated to 2024-01-01 to safely cover any historical reference
-- in posted entries; rate values represent the rate that was in effect during
-- each window.

insert into public.vat_rates (country, rate, valid_from, valid_to, notes) values
  ('LV', 21.00, '2024-01-01', null, 'PVN likums Article 41(1)'),
  ('LT', 21.00, '2024-01-01', null, 'Lithuanian VAT Law Article 19(1)'),
  ('EE', 20.00, '2024-01-01', '2025-06-30', 'Estonian standard rate prior to 2025-07-01'),
  ('EE', 24.00, '2025-07-01', null, 'Estonian Parliament decision 2025-06-19; permanent')
on conflict (country, valid_from) do nothing;

-- ============================================================================
-- 4. counterparties — system entities (2 rows, pinned UUIDs)
-- ============================================================================
--
-- These UUIDs are referenced from src/lib/accounting/system-counterparties.ts
-- and from PR #2 (posting engine) + PR #3 (Phase 0 backfill, e.g. Entry 17
-- VID refund). Do NOT change them — downstream code imports the constants by
-- value, and changing them would orphan existing FKs in the GL.

insert into public.counterparties (
  id, type, full_name, country, tin, vat_number, legal_compliance_status, kyc_status
) values
  (
    '00000000-0000-0000-0000-000000000001',
    'tax_authority',
    'Valsts ieņēmumu dienests (VID)',
    'LV',
    '90000010008',
    null,
    'ok',
    'not_required'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'internal',
    'Second Turn Games SIA',
    'LV',
    null,
    'LV50203665371',
    'ok',
    'not_required'
  )
on conflict (id) do nothing;
