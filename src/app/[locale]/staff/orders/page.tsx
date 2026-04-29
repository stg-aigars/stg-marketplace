import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, NavTabs, EmptyState, Input, Button } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import {
  ORDER_STATUS_CONFIG,
  SELLER_RESPONSE_REMINDER_HOURS,
  SHIPPING_REMINDER_DAYS,
  DELIVERY_REMINDER_DAYS,
} from '@/lib/orders/constants';
import type { OrderStatus } from '@/lib/orders/types';
import { getOrderGameSummary } from '@/lib/orders/utils';
import { REFUND_STATUS } from '@/lib/services/order-refund';
import { MagnifyingGlass } from '@phosphor-icons/react/ssr';

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
  accepted_at: string | null;
  shipped_at: string | null;
  order_items: Array<{ listing_id: string; listings: { game_name: string } | null }>;
  listings: { game_name: string } | null;
  buyer_profile: { full_name: string | null } | null;
  seller_profile: { full_name: string | null } | null;
}

// Stuck-tab thresholds reuse the soft-reminder thresholds the cron
// already uses — keeps the UI definition of "stuck" in lockstep with
// the deadline-enforcement cron's reminder firing. Hard auto-action
// thresholds (48h decline / 5d cancel / 21d escalate) are documented
// in CLAUDE.md "Order Deadlines".

/** Strip characters that have meaning in PostgREST `.or()` filters or
 *  PostgreSQL LIKE wildcards. The remaining set covers order numbers
 *  (STG-XXXX-YYY) and tracking barcodes (alphanumeric). Email / name /
 *  game-title search is deferred — those need separate join-aware queries. */
function sanitizeOrderSearch(input: string): string {
  return input.trim().replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 64);
}

export default async function StaffOrdersPage(
  props: {
    searchParams: Promise<{ status?: string; refund_status?: string; tab?: string; q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { serviceClient } = await requireServerAuth();

  const search = searchParams.q ? sanitizeOrderSearch(searchParams.q) : '';
  const isStuck = searchParams.tab === 'stuck';
  // Server Component request-time clock — passed into render helpers so age
  // calculations are deterministic per request.
  // eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() is safe at request time
  const requestTimeMs = Date.now();

  let query = serviceClient
    .from('orders')
    .select(`
      id, order_number, status, total_amount_cents, item_count, payment_method,
      refund_status, refund_amount_cents, created_at, accepted_at, shipped_at,
      order_items(listing_id, listings(game_name)),
      listings(game_name),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (isStuck) {
    const t24h = new Date(requestTimeMs - SELLER_RESPONSE_REMINDER_HOURS * 60 * 60 * 1000).toISOString();
    const t3d = new Date(requestTimeMs - SHIPPING_REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const t14d = new Date(requestTimeMs - DELIVERY_REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(
      `and(status.eq.pending_seller,created_at.lt.${t24h}),` +
      `and(status.eq.accepted,accepted_at.lt.${t3d}),` +
      `and(status.eq.shipped,shipped_at.lt.${t14d})`
    );
  } else if (searchParams.refund_status === 'issues') {
    query = query.in('refund_status', [REFUND_STATUS.FAILED, REFUND_STATUS.PARTIAL]);
  } else if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  }

  if (search) {
    query = query.or(`order_number.ilike.%${search}%,barcode.ilike.%${search}%`);
  }

  const { data: orders } = await query;
  const typedOrders = (orders ?? []) as unknown as StaffOrderRow[];

  // Active tab key for NavTabs highlighting
  const activeTab = isStuck
    ? 'stuck'
    : searchParams.refund_status === 'issues'
      ? 'refund_issues'
      : (searchParams.status ?? 'all');

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-4">
        All orders
      </h1>

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Order number or tracking barcode"
            prefix={<MagnifyingGlass size={16} />}
          />
        </div>
        <Button type="submit" variant="primary" size="sm">Search</Button>
        {(search || isStuck || searchParams.status || searchParams.refund_status) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/staff/orders">Reset</Link>
          </Button>
        )}
      </form>

      <NavTabs
        tabs={[
          { key: 'all', label: 'All', href: '/staff/orders' },
          { key: 'stuck', label: 'Stuck', href: '/staff/orders?tab=stuck' },
          ...(['pending_seller', 'accepted', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'] as OrderStatus[]).map((s) => ({
            key: s,
            label: ORDER_STATUS_CONFIG[s]?.label ?? s,
            href: `/staff/orders?status=${s}`,
          })),
          { key: 'refund_issues', label: 'Refund issues', href: '/staff/orders?refund_status=issues' },
        ]}
        activeTab={activeTab}
        variant="pill"
        className="mb-6"
      />

      {isStuck && (
        <p className="text-xs text-semantic-text-muted mb-4">
          Orders past their soft-reminder deadline: pending_seller older than {SELLER_RESPONSE_REMINDER_HOURS}h, accepted older than {SHIPPING_REMINDER_DAYS}d, shipped older than {DELIVERY_REMINDER_DAYS}d. The deadline-enforcement cron will auto-decline / auto-cancel / auto-escalate the harder thresholds; intervene before then if needed.
        </p>
      )}

      {typedOrders.length === 0 ? (
        <EmptyState
          title={search ? 'No matching orders' : isStuck ? 'No stuck orders' : 'No orders found'}
          description={search ? 'Adjust the search term or clear the filter.' : undefined}
        />
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
                      {order.payment_method === 'bank_link' && (
                        <Badge variant="default">bank link</Badge>
                      )}
                      {order.refund_status === REFUND_STATUS.FAILED && (
                        <Badge variant="error">refund failed</Badge>
                      )}
                      {order.refund_status === REFUND_STATUS.PARTIAL && (
                        <Badge variant="warning">refund partial</Badge>
                      )}
                      {isStuck && <StuckAgeBadge order={order} nowMs={requestTimeMs} />}
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

/** Compute the relevant age timestamp for the stuck cohort and render a
 *  warning-toned badge — `pending_seller` reads created_at, `accepted`
 *  reads accepted_at, `shipped` reads shipped_at. */
function StuckAgeBadge({ order, nowMs }: { order: StaffOrderRow; nowMs: number }) {
  let referenceTime: string | null;
  switch (order.status) {
    case 'pending_seller':
      referenceTime = order.created_at;
      break;
    case 'accepted':
      referenceTime = order.accepted_at;
      break;
    case 'shipped':
      referenceTime = order.shipped_at;
      break;
    default:
      return null;
  }
  if (!referenceTime) return null;

  const ageMs = nowMs - new Date(referenceTime).getTime();
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const label = ageHours < 48 ? `${ageHours}h` : `${Math.floor(ageHours / 24)}d`;
  return <Badge variant="warning">stuck {label}</Badge>;
}
