-- Phase 8 of PTAC distance-trading compliance plan.
-- Adds the version stamp on orders so we have forensic record of which Terms
-- and Seller Agreement were in force at the moment of contract conclusion.
-- This is independent of the inline-in-email durable-medium delivery (the
-- email body is the artifact the buyer holds; the order row stamp is what
-- staff/legal queries when answering "what version did this buyer agree to?").

alter table public.orders
  add column terms_version text,
  add column seller_terms_version text;

comment on column public.orders.terms_version is
  'TERMS_VERSION at the moment of order creation — preserves "what the buyer agreed to" for forensics, independent of email durable-medium delivery';

comment on column public.orders.seller_terms_version is
  'SELLER_TERMS_VERSION at the moment of order creation — paired with terms_version for the full set of contractual constants in force at order time';
