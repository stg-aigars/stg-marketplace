import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { getVatRate } from '@/lib/services/pricing';
import type { BookkeepingSummary, CountryVatBreakdown, VatBreakdownCents } from '@/lib/bookkeeping-utils';
import { HOME_COUNTRY } from '@/lib/oss/types';

const BOOKKEEPING_SCOPES = ['all', 'domestic', 'cross_border'] as const;
type BookkeepingScope = typeof BOOKKEEPING_SCOPES[number];

function isBookkeepingScope(value: string | null): value is BookkeepingScope {
  return !!value && (BOOKKEEPING_SCOPES as readonly string[]).includes(value);
}

const PAGE_SIZE = 20;

/** Extract full_name from a Supabase FK join result (may be object or array) */
function extractName(profile: unknown): string {
  if (!profile) return 'Unknown';
  const p = Array.isArray(profile) ? profile[0] : profile;
  return (p as { full_name?: string | null })?.full_name ?? 'Unknown';
}

export async function GET(request: Request) {
  const { response } = await requireStaffAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const seller = searchParams.get('seller');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const rawScope = searchParams.get('scope');
  const scope: BookkeepingScope = isBookkeepingScope(rawScope) ? rawScope : 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10));

  const serviceClient = createServiceClient();

  // Build query for orders with buyer/seller names
  let query = serviceClient
    .from('orders')
    .select(`
      id, order_number, status, created_at, seller_country,
      items_total_cents, shipping_cost_cents, platform_commission_cents, total_amount_cents,
      commission_net_cents, commission_vat_cents, shipping_net_cents, shipping_vat_cents,
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (search) {
    query = query.ilike('order_number', `%${search}%`);
  }
  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo);
  }
  if (scope === 'domestic') {
    query = query.eq('seller_country', HOME_COUNTRY);
  } else if (scope === 'cross_border') {
    query = query.neq('seller_country', HOME_COUNTRY);
  }

  // Seller name filter: resolve seller IDs before applying to queries
  let sellerIds: string[] | null = null;
  if (seller) {
    const { data: sellerProfiles } = await serviceClient
      .from('user_profiles')
      .select('id')
      .ilike('full_name', `%${seller}%`);

    if (sellerProfiles && sellerProfiles.length > 0) {
      sellerIds = sellerProfiles.map((p) => p.id);
      query = query.in('seller_id', sellerIds);
    } else {
      return NextResponse.json({
        orders: [],
        summary: null,
        countryBreakdown: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
      });
    }
  }

  // Execute paginated query and summary RPC in parallel
  const [paginatedResult, summaryRpcResult] = await Promise.all([
    query,
    serviceClient.rpc('get_bookkeeping_summary', {
      p_status: (status && status !== 'all') ? status : null,
      p_search: search || null,
      p_seller_ids: sellerIds,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
    }),
  ]);

  if (paginatedResult.error) {
    console.error('Bookkeeping query error:', paginatedResult.error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }

  const total = paginatedResult.count ?? 0;

  // Map paginated rows for the table
  const mapped = (paginatedResult.data ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    created_at: o.created_at,
    seller_country: o.seller_country,
    items_total_cents: o.items_total_cents,
    shipping_cost_cents: o.shipping_cost_cents,
    platform_commission_cents: o.platform_commission_cents,
    total_amount_cents: o.total_amount_cents,
    commission_net_cents: o.commission_net_cents,
    commission_vat_cents: o.commission_vat_cents,
    shipping_net_cents: o.shipping_net_cents,
    shipping_vat_cents: o.shipping_vat_cents,
    buyer_name: extractName(o.buyer_profile),
    seller_name: extractName(o.seller_profile),
  }));

  // Build summary and country breakdown from RPC result (one row per country)
  interface SummaryRow {
    seller_country: string;
    order_count: number;
    gmv_cents: number;
    total_buyer_paid_cents: number;
    commission_gross_cents: number;
    commission_net_cents: number;
    commission_vat_cents: number;
    shipping_gross_cents: number;
    shipping_net_cents: number;
    shipping_vat_cents: number;
  }
  const allSummaryRows = (summaryRpcResult.data ?? []) as SummaryRow[];

  // Apply the same scope filter to the per-country aggregates as the orders
  // query. Direct equality matches the orders-side `.eq()` / `.neq()`:
  // `seller_country` is uppercase by the migration 001 CHECK constraint.
  const summaryRows = scope === 'domestic'
    ? allSummaryRows.filter((row) => row.seller_country === HOME_COUNTRY)
    : scope === 'cross_border'
      ? allSummaryRows.filter((row) => row.seller_country !== HOME_COUNTRY)
      : allSummaryRows;

  // Aggregate across countries for overall summary
  const platformRevenue: VatBreakdownCents = { grossCents: 0, netCents: 0, vatCents: 0 };
  const shippingRevenue: VatBreakdownCents = { grossCents: 0, netCents: 0, vatCents: 0 };
  let orderCount = 0;
  let gmvCents = 0;
  let totalBuyerPaidCents = 0;

  const countryBreakdown: CountryVatBreakdown[] = summaryRows.map((row) => {
    orderCount += row.order_count;
    gmvCents += row.gmv_cents;
    totalBuyerPaidCents += row.total_buyer_paid_cents;
    platformRevenue.grossCents += row.commission_gross_cents;
    platformRevenue.netCents += row.commission_net_cents;
    platformRevenue.vatCents += row.commission_vat_cents;
    shippingRevenue.grossCents += row.shipping_gross_cents;
    shippingRevenue.netCents += row.shipping_net_cents;
    shippingRevenue.vatCents += row.shipping_vat_cents;

    return {
      country: row.seller_country,
      vatRate: getVatRate(row.seller_country),
      commissionVatCents: row.commission_vat_cents,
      shippingVatCents: row.shipping_vat_cents,
      totalVatCents: row.commission_vat_cents + row.shipping_vat_cents,
      orderCount: row.order_count,
    };
  });

  const summary: BookkeepingSummary = {
    orderCount,
    gmvCents,
    totalBuyerPaidCents,
    platformRevenue,
    shippingRevenue,
    totalVatCents: platformRevenue.vatCents + shippingRevenue.vatCents,
  };

  return NextResponse.json({
    orders: mapped,
    summary: summaryRows.length > 0 ? summary : null,
    countryBreakdown,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
}
