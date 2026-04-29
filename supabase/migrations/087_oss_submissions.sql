-- Bundle 2 PR C — VAT OSS quarterly submission tracking.
--
-- STG is OSS-registered in LV (home MS) for cross-border B2C supplies of
-- electronically-supplied services to LT and EE sellers. Per accountant memo
-- (docs/legal_audit/accountant-vat-confirmation.md), commission is ESS under
-- Article 7 of Implementing Regulation (EU) 282/2011, place of supply Article
-- 58 (consumer's MS), VAT at seller's country rate. OSS applies only to
-- non-LV sellers; LV→LV stays in the regular LV VAT return.
--
-- Quarterly cadence per Article 369i of Directive 2006/112/EC: submission
-- due by end of month following quarter end (Apr 30 / Jul 31 / Oct 31 /
-- Jan 31). 10-year retention per Article 369k of the same directive.
--
-- This table records the SUBMISSION EVENT, not the underlying transaction
-- data — the per-order data is on `orders` and aggregates are computed at
-- query time via `aggregateVatByMS`. Append-only with `supersedes_submission_id`
-- self-FK for amendments (corrections to a prior quarter's filing happen).
-- Payment confirmation columns (payment_cleared_at, confirmation_url) are
-- filled in days/weeks after the original submission via a narrow UPDATE
-- policy — see RLS below.

create table public.oss_submissions (
  id uuid primary key default gen_random_uuid(),
  -- Quarter being declared (UTC start; e.g. 2026-01-01 for Q1 2026).
  quarter_start date not null,
  quarter_end date not null,
  -- Statutory deadline (end of month following quarter end).
  deadline date not null,
  -- Amendment chain — null for original filings, points to the row being amended.
  supersedes_submission_id uuid references public.oss_submissions(id) on delete restrict,
  -- Filing event
  filed_at timestamptz not null default now(),
  filed_by uuid references auth.users(id) on delete set null,
  -- Declared amounts as JSON keyed by MS: { "LT": { "net_cents": 12345, "vat_cents": 2592 }, "EE": { ... } }
  declared_amounts jsonb not null,
  -- Bank-side payment reference (entered manually after filing the OSS portal form).
  payment_reference text,
  -- Filled in when the bank confirms payment cleared.
  payment_cleared_at timestamptz,
  -- Optional artefact: scanned/saved confirmation document URL.
  confirmation_url text,
  -- Free-text amendment reason (only meaningful when supersedes_submission_id IS NOT NULL).
  amendment_reason text,
  created_at timestamptz not null default now()
);

comment on table public.oss_submissions is
  'OSS quarterly submission tracking. Append-only — amendments insert a new row pointing at the superseded one via supersedes_submission_id, never UPDATE original rows. Payment-confirmation columns (payment_cleared_at, confirmation_url) and payment_reference can be updated post-insert via a narrow RLS policy. 10-year retention per Article 369k of Directive 2006/112/EC. Audit events: oss.submission_recorded, oss.submission_amended, oss.payment_recorded — all with retention_class=regulatory.';

create index idx_oss_submissions_quarter on public.oss_submissions(quarter_start desc);
create index idx_oss_submissions_supersedes on public.oss_submissions(supersedes_submission_id)
  where supersedes_submission_id is not null;

alter table public.oss_submissions enable row level security;

-- Staff-only INSERT.
create policy oss_submissions_insert on public.oss_submissions
  for insert to authenticated with check (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- Staff-only SELECT.
create policy oss_submissions_select on public.oss_submissions
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- Staff-only narrow UPDATE — only the post-filing payment-confirmation columns
-- are mutable. The append-only invariant relaxes precisely: "no row ever
-- vanishes, no row ever rewrites the original filing data, only the
-- post-filing payment columns can change." Every UPDATE emits an
-- `oss.payment_recorded` audit event in the application layer.
create policy oss_submissions_update_payment on public.oss_submissions
  for update to authenticated
  using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  )
  with check (
    -- Same staff check on the new row
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- DB-level guard: forbid mutation of every column except the three payment-
-- confirmation columns. The RLS policies above gate WHO can update; this
-- trigger gates WHAT can be updated.
create or replace function public.oss_submissions_guard_update()
returns trigger language plpgsql as $$
begin
  if (new.id is distinct from old.id)
     or (new.quarter_start is distinct from old.quarter_start)
     or (new.quarter_end is distinct from old.quarter_end)
     or (new.deadline is distinct from old.deadline)
     or (new.supersedes_submission_id is distinct from old.supersedes_submission_id)
     or (new.filed_at is distinct from old.filed_at)
     or (new.filed_by is distinct from old.filed_by)
     or (new.declared_amounts is distinct from old.declared_amounts)
     or (new.amendment_reason is distinct from old.amendment_reason)
     or (new.created_at is distinct from old.created_at) then
    raise exception 'oss_submissions: only payment_reference, payment_cleared_at, and confirmation_url may be updated after insert';
  end if;
  return new;
end $$;

create trigger trg_oss_submissions_guard_update
  before update on public.oss_submissions
  for each row execute function public.oss_submissions_guard_update();

-- No DELETE policy — DELETE forbidden by default (RLS denies what isn't allowed).
