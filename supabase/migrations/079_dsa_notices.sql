-- Phase 5 of PTAC distance-trading compliance plan.
-- Adds the persistent queue + review UI backing for DSA Art. 16 notices that the
-- existing /api/report-illegal-content route was always intended to feed (per
-- CLAUDE.md:264). Renames the existing 'illegal_content.reported' audit event to
-- the broader 'dsa_notice.received' to match the actual scope (notice-and-action
-- covers more than illegal content — IP, misleading listings, Terms violations).

create table public.dsa_notices (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: not every notice is bound to a listing (forum content, profiles,
  -- future entities). Staff dashboard treats listing_id IS NULL as a valid
  -- "non-listing-bound" case, not a data bug.
  listing_id uuid references public.listings(id) on delete set null,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  notifier_name text,
  category text not null check (
    category in (
      'counterfeit',
      'ip_infringement',
      'illegal_goods',
      'csam',
      'hate_or_harassment',
      'misleading_listing',
      'other'
    )
  ),
  content_reference text not null,
  explanation text not null,
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  staff_note text,
  reporter_ip inet,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.dsa_notices is
  'DSA Art. 16 notice-and-action queue. listing_id is nullable — not every notice is bound to a listing (e.g. notices about forum content, profiles, or future entities). Staff dashboard treats listing_id IS NULL as a valid non-listing-bound case, not a data bug. Anonymous reports allowed (reporter_id + reporter_email both null); the Art. 16(5) confirmation-of-receipt obligation is satisfied by the absence of a notice provider to confirm to (operational constraint, not regulatory exemption). Art. 17 statement-of-reasons obligation is to the affected seller, handled at the listings.status mutation site (see seller-side notify + listing.actioned_by_staff audit event in the staff dashboard handler).';

create index idx_dsa_notices_listing on public.dsa_notices(listing_id) where listing_id is not null;
create index idx_dsa_notices_status on public.dsa_notices(status) where status in ('open','reviewing');

alter table public.dsa_notices enable row level security;

-- Anyone can insert (DSA Art. 16). Per-IP rate limit is enforced upstream by
-- applyRateLimit(reportIllegalContentLimiter, request) in the route.
create policy dsa_notices_insert on public.dsa_notices
  for insert to anon, authenticated with check (true);

-- Only staff can read / update
create policy dsa_notices_staff_read on public.dsa_notices
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );
create policy dsa_notices_staff_update on public.dsa_notices
  for update to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- Audit-event rename: 'illegal_content.reported' -> 'dsa_notice.received' (broader DSA Art. 16 scope).
-- Live-test status: rows touched are test data; UPDATE pattern is what runs on prod when real data lands.
update public.audit_log
   set action = 'dsa_notice.received'
 where action = 'illegal_content.reported';
