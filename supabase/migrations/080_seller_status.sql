-- Phase 6 of PTAC distance-trading compliance plan.
-- Adds the seller_status enum used for PTAC §6.1 reputation gating + the trigger
-- that pauses active listings when a seller is suspended.

-- 1. seller_status column on user_profiles
alter table public.user_profiles
  add column seller_status text not null default 'active'
    check (seller_status in ('active','warned','suspended'));

create index idx_user_profiles_seller_status on public.user_profiles(seller_status)
  where seller_status <> 'active';

comment on column public.user_profiles.seller_status is
  'PTAC §6.1 reputation gating — active|warned|suspended. Suspension blocks new listings (gated in src/lib/listings/actions.ts) and pauses live listings (via trg_pause_listings_on_suspension). Suspension is a human staff decision; never automated. See docs/legal_audit/trader-detection-deferral.md.';

-- 2. Extend listings.status enum to include 'paused' (currently active|sold|cancelled|reserved|auction_ended per migration 032)
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('active','sold','cancelled','reserved','auction_ended','paused'));

-- 3. Trigger: pause active listings when seller_status flips to 'suspended'
create or replace function public.pause_listings_on_suspension()
returns trigger language plpgsql security definer as $$
begin
  -- DELIBERATE ASYMMETRY #1: we pause on suspend but DO NOT auto-unpause on un-suspend.
  -- Rationale: a re-activated seller should manually re-list each item as a re-confirmation
  -- that the listing still complies with our terms. Auto-unpausing would re-publish stale
  -- or mis-priced listings without seller review. Do not "fix" this asymmetry without
  -- explicit product decision.
  --
  -- DELIBERATE ASYMMETRY #2: the WHERE filter only catches status='active'. Listings in
  -- 'reserved' (mid-checkout) and 'auction_ended' (winner has 24h to pay) are intentionally
  -- left in their current state. Disrupting in-flight transactions when a seller is
  -- suspended creates worse problems than the suspension solves — the buyer has already
  -- paid into escrow or won an auction in good faith. The staff suspension UI surfaces
  -- a warning when a seller has reserved/auction_ended listings; suspension still proceeds,
  -- but those orders complete normally.
  if new.seller_status = 'suspended' and old.seller_status is distinct from 'suspended' then
    update public.listings set status = 'paused'
      where seller_id = new.id and status = 'active';
  end if;
  return new;
end $$;

comment on function public.pause_listings_on_suspension() is
  'Pauses active listings when seller is suspended. Intentionally (a) does not reverse on un-suspend, (b) leaves reserved/auction_ended listings alone so in-flight transactions complete. See function body comment for rationale.';

create trigger trg_pause_listings_on_suspension
  after update of seller_status on public.user_profiles
  for each row execute function public.pause_listings_on_suspension();
