import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, NavTabs, EmptyState } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus } from '@/lib/orders/types';
import { getOrderGameSummary } from '@/lib/orders/utils';

export const metadata: Metadata = {
  title: 'All Orders — Staff',
};

interface StaffOrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount_cents: number;
  item_count: number;
  payment_method: string | null;
  refund_status: string | null;
  refund_amount_cents: number | null;
  created_at: string;
  order_items: Array<{ listing_id: string; listings: { game_name: string } | null }>;
  listings: { game_name: string } | null;
  buyer_profile: { full_name: string | null } | null;
  seller_profile: { full_name: string | null } | null;
}

export default async function StaffOrdersPage(
  props: {
    searchParams: Promise<{ status?: string; refund_status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { serviceClient } = await requireServerAuth();

  let query = serviceClient
    .from('orders')
    .select(`
      id, order_number, status, total_amount_cents, item_count, payment_method,
      refund_status, refund_amount_cents, created_at,
      order_items(listing_id, listings(game_name)),
      listings(game_name),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (searchParams.refund_status === 'issues') {
    query = query.in('refund_status', ['failed', 'partial']);
  } else if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  }

  const { data: orders } = await query;
  const typedOrders = (orders ?? []) as unknown as StaffOrderRow[];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-4">
        All orders
      </h1>

      <NavTabs
        tabs={[
          { key: 'all', label: 'All', href: '/staff/orders' },
          ...(['pending_seller', 'accepted', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'] as OrderStatus[]).map((s) => ({
            key: s,
            label: ORDER_STATUS_CONFIG[s]?.label ?? s,
            href: `/staff/orders?status=${s}`,
          })),
          { key: 'refund_issues', label: 'Refund issues', href: '/staff/orders?refund_status=issues' },
        ]}
        activeTab={searchParams.refund_status === 'issues' ? 'refund_issues' : (searchParams.status ?? 'all')}
        variant="pill"
        className="mb-6"
      />

      {typedOrders.length === 0 ? (
        <EmptyState title="No orders found" />
      ) : (
        <div className="space-y-2">
          {typedOrders.map((order) => (
            <Link key={order.id} href={`/staff/orders/${order.id}`}>
              <Card hoverable>
                <CardBody className="flex items-center justify-between py-3 px-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-semantic-text-heading">
                        {order.order_number}
                      </span>
                      <Badge variant={ORDER_STATUS_CONFIG[order.status]?.badgeVariant ?? 'default'}>
                        {ORDER_STATUS_CONFIG[order.status]?.label ?? order.status}
                      </Badge>
                      {order.payment_method === 'wallet' && (
                        <Badge variant="default">wallet</Badge>
                      )}
                      {order.refund_status === 'failed' && (
                        <Badge variant="error">refund failed</Badge>
                      )}
                      {order.refund_status === 'partial' && (
                        <Badge variant="warning">refund partial</Badge>
                      )}
                    </div>
                    <p className="text-sm text-semantic-text-secondary mt-0.5 truncate">
                      {getOrderGameSummary(order.order_items, order.listings)} · {order.buyer_profile?.full_name ?? 'Unknown'} → {order.seller_profile?.full_name ?? 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="font-semibold text-semantic-text-heading">
                      {formatCentsToCurrency(order.total_amount_cents)}
                    </p>
                    <p className="text-xs text-semantic-text-muted">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
