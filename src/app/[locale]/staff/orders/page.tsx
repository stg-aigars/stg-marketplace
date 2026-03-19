import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';

export const metadata: Metadata = {
  title: 'All Orders — Staff',
};

interface StaffOrderRow {
  id: string;
  order_number: string;
  status: string;
  total_amount_cents: number;
  payment_method: string | null;
  created_at: string;
  listings: { game_name: string } | null;
  buyer_profile: { full_name: string | null } | null;
  seller_profile: { full_name: string | null } | null;
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  pending_seller: 'warning',
  accepted: 'default',
  shipped: 'default',
  delivered: 'default',
  completed: 'success',
  cancelled: 'error',
  disputed: 'error',
  refunded: 'error',
};

export default async function StaffOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { serviceClient } = await requireServerAuth();

  let query = serviceClient
    .from('orders')
    .select(`
      id, order_number, status, total_amount_cents, payment_method, created_at,
      listings(game_name),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  }

  const { data: orders } = await query;
  const typedOrders = (orders ?? []) as unknown as StaffOrderRow[];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-4">
        All orders
      </h1>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/staff/orders"
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            !searchParams.status
              ? 'bg-semantic-primary text-semantic-text-inverse border-semantic-primary'
              : 'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle'
          }`}
        >
          All
        </Link>
        {['pending_seller', 'accepted', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'].map((s) => (
          <Link
            key={s}
            href={`/staff/orders?status=${s}`}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              searchParams.status === s
                ? 'bg-semantic-primary text-semantic-text-inverse border-semantic-primary'
                : 'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle'
            }`}
          >
            {s.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {typedOrders.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-semantic-text-muted text-center py-8">No orders found.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {typedOrders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card hoverable>
                <CardBody className="flex items-center justify-between py-3 px-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-semantic-text-heading">
                        {order.order_number}
                      </span>
                      <Badge variant={STATUS_BADGE[order.status] ?? 'default'}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                      {order.payment_method === 'wallet' && (
                        <Badge variant="default">wallet</Badge>
                      )}
                    </div>
                    <p className="text-sm text-semantic-text-secondary mt-0.5 truncate">
                      {order.listings?.game_name ?? '—'} · {order.buyer_profile?.full_name ?? 'Unknown'} → {order.seller_profile?.full_name ?? 'Unknown'}
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
