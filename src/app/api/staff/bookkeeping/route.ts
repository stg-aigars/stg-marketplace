import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';

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

  // Seller name filter: fetch seller IDs first, then filter orders
  if (seller) {
    const { data: sellerProfiles } = await serviceClient
      .from('user_profiles')
      .select('id')
      .ilike('full_name', `%${seller}%`);

    if (sellerProfiles && sellerProfiles.length > 0) {
      query = query.in('seller_id', sellerProfiles.map((p) => p.id));
    } else {
      // No matching sellers — return empty
      return NextResponse.json({
        orders: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
      });
    }
  }

  const { data: orders, count, error } = await query;

  if (error) {
    console.error('Bookkeeping query error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }

  const total = count ?? 0;

  // Map to the shape the bookkeeping page expects
  const mapped = (orders ?? []).map((o) => ({
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

  return NextResponse.json({
    orders: mapped,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
}
