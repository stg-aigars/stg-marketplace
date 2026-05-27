-- Add advertising expense account + Meta Platforms Ireland vendor payable
-- and counterparty for I.3 (EU B2B RC) vendor invoice posting.

-- 7750: advertising & marketing expense (Meta Ads, future Google Ads, etc.)
insert into public.accounts (code, name_lv, name_en, type, is_vat, parent_code) values
  ('7750', 'Reklāmas un mārketinga izmaksas', 'Advertising & marketing', 'expense', false, null)
on conflict (code) do nothing;

-- 5310-META: Meta Platforms Ireland trade payable sub-account
insert into public.accounts (code, name_lv, name_en, type, is_vat, parent_code) values
  ('5310-META', 'Norēķini — Meta', 'Meta payable', 'liability', false, '5310')
on conflict (code) do nothing;

-- Meta Platforms Ireland counterparty (IE, EU B2B reverse charge)
insert into public.counterparties (
  id, type, full_name, country, tax_status, vat_number, vies_verified_at, vendor_code,
  legal_compliance_status, kyc_status
) values (
  'a9999999-9999-4999-8999-999999999999',
  'vendor',
  'Meta Platforms Ireland Limited',
  'IE',
  'vat_registered',
  'IE9692928F',
  '2026-05-27T00:00:00Z',
  'META',
  'ok',
  'not_required'
) on conflict (id) do nothing;
