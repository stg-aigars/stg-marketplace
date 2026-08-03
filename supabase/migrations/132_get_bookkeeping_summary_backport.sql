-- Backport get_bookkeeping_summary() into migrations.
--
-- This function already exists in production (used by
-- src/app/api/staff/bookkeeping/route.ts) but was never captured in a
-- migration file -- found during the 2026-08-03 VAT-prevention review while
-- checking whether the staff Bookkeeping page shared the OSS page's
-- date-basis bug (it doesn't; this is a separate, unrelated find: schema
-- drift risk from a function created out-of-band). CREATE OR REPLACE
-- against the exact production body, purely to close the reproducibility
-- gap so a fresh environment built from migrations alone doesn't silently
-- lack this function. One deliberate addition beyond a byte-for-byte copy:
-- `set search_path = ''` (the production function doesn't have it) -- this
-- is a SECURITY DEFINER function, and the codebase's own convention
-- elsewhere (insert_journal_entry) is to pin search_path on SECURITY
-- DEFINER functions to prevent search_path hijacking. Safe here because the
-- body already fully qualifies every reference (public.orders).

create or replace function public.get_bookkeeping_summary(
  p_status text default null,
  p_search text default null,
  p_seller_ids uuid[] default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  seller_country text,
  order_count bigint,
  gmv_cents bigint,
  total_buyer_paid_cents bigint,
  commission_gross_cents bigint,
  commission_net_cents bigint,
  commission_vat_cents bigint,
  shipping_gross_cents bigint,
  shipping_net_cents bigint,
  shipping_vat_cents bigint
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    o.seller_country,
    count(*)::bigint,
    coalesce(sum(o.items_total_cents), 0)::bigint,
    coalesce(sum(o.total_amount_cents), 0)::bigint,
    coalesce(sum(o.platform_commission_cents), 0)::bigint,
    coalesce(sum(o.commission_net_cents), 0)::bigint,
    coalesce(sum(o.commission_vat_cents), 0)::bigint,
    coalesce(sum(o.shipping_cost_cents), 0)::bigint,
    coalesce(sum(o.shipping_net_cents), 0)::bigint,
    coalesce(sum(o.shipping_vat_cents), 0)::bigint
  from public.orders o
  -- Must match EXCLUDED_FROM_TOTALS in src/lib/bookkeeping-utils.ts
  where o.status not in ('cancelled', 'refunded')
    and (p_status is null or o.status = p_status)
    and (p_search is null or o.order_number ilike '%' || p_search || '%')
    and (p_seller_ids is null or o.seller_id = any(p_seller_ids))
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at <= p_date_to)
  group by o.seller_country;
$function$;
