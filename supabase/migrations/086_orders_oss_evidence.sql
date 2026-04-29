-- Bundle 0 PR 0a — Order-time evidence capture for OSS Article 24f.
--
-- VAT OSS (Article 24f of Implementing Regulation (EU) 282/2011) requires two
-- non-contradictory pieces of evidence for the customer's MS in cross-border
-- B2C supplies. STG's commission service has the seller as customer, so the
-- relevant evidence is seller-side. Today STG relies on one piece — the
-- seller's self-declared country, propagated through profile → listing →
-- order. This migration adds two corroborating columns at the moment of
-- supply.
--
-- This migration is a one-way door: order-time data sources are request-scoped
-- (Turnstile/Cloudflare headers captured and discarded) or only available at
-- the moment of order creation (the seller's then-current IBAN). Every order
-- that lands without these columns is permanently single-stranded for OSS
-- audit-defensibility. Hence the pre-launch hotfix priority.
--
-- DEVIATION FROM PLAN: the plan called this column seller_country_at_order_ip
-- on the assumption that the request IP at order creation reflects the seller.
-- In practice, the order-creation request fires from the EveryPay callback
-- redirect (browser flow) or from a cron (no request context) — the IP is the
-- BUYER's, not the seller's. Renamed to request_country_at_order to be honest
-- about the source. The seller's MS is established by the declared
-- seller_country + the seller's IBAN-country (seller_iban_country_at_order)
-- — those are the two Article 24f pieces. request_country_at_order is
-- secondary forensic evidence (fraud investigation, market analytics).

alter table public.orders
  add column request_country_at_order text,
  add column seller_iban_country_at_order text;

comment on column public.orders.request_country_at_order is
  'Country code (ISO 3166-1 alpha-2) from the Cloudflare cf-ipcountry header on the request that triggered order creation. In callback flows this is the buyer''s geolocation; in cron-reconciliation flows this is null (no request context). NOT a primary OSS Article 24f evidence piece — that role is held by seller_country + seller_iban_country_at_order. Captured for fraud-investigation forensics and as a supplementary signal where buyer/seller MS happen to coincide.';

comment on column public.orders.seller_iban_country_at_order is
  'Country code (ISO 3166-1 alpha-2) derived from the first two characters of the seller''s most recent non-rejected withdrawal_requests.bank_iban at order creation time. Snapshot — not refreshed if the seller later updates their IBAN. Primary OSS Article 24f corroborating evidence for the seller''s MS, paired with the declared seller_country. Nullable: most first-time sellers do not have a withdrawal_request yet, leaving evidence single-stranded until they request their first payout.';

-- Composite index supporting the IBAN-country lookup at order creation time.
-- Query: SELECT bank_iban FROM withdrawal_requests
--          WHERE user_id = $1 AND status <> 'rejected'
--          ORDER BY created_at DESC LIMIT 1
-- The existing idx_withdrawal_requests_user_id (user_id only) covers the
-- predicate but not the ordering; this composite handles both cleanly.
create index idx_withdrawal_requests_user_created on public.withdrawal_requests(user_id, created_at desc);
