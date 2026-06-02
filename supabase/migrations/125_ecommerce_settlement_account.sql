-- Add the Swedbank e-commerce settlement account (2620).
--
-- STG opened a dedicated Swedbank account (IBAN LV24 HABA 0551 0646 4950 3)
-- as the landing account for marketplace receipts and EveryPay platform fees,
-- separate from the operating account (2610, IBAN LV89 …5377 7). The May 2026
-- bank statements are the first period where marketplace cash flows into this
-- account rather than the operating account, so the chart of accounts (seeded
-- in migration 096 with only 2610 / 2630 / 2670) needs a code for it.
--
-- Asset, top-level (no parent) — sibling of 2610 'Swedbank operatīvais konts'.
-- Used by:
--   - the May 2026 backfill (marketplace cash legs, EveryPay fees, the
--     2610→2620 funding transfer)
--   - the engine cash rails post-cutover: C.2 (bank-link) / C.3 (EveryPay
--     settlement) accept a payload `bank_account` override that the cart wrap
--     passes as '2620' once the Stage 3 cutover lands.
insert into public.accounts (code, name_lv, name_en, type, is_vat, parent_code) values
  ('2620', 'Swedbank e-komercijas norēķinu konts', 'Swedbank e-commerce settlement account', 'asset', false, null)
on conflict (code) do nothing;
