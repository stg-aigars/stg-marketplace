import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getTrackingEvents } from '@/lib/services/tracking';
import { getOrderMessages } from '@/lib/order-messages/actions';
import { Badge, BackLink } from '@/components/ui';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus, OrderWithDetails, DisputeRow } from '@/lib/orders/types';
import { OrderDetailClient } from '@/components/orders/OrderDetailClient';
import {
  StaffOrderAdditions,
  type RefundAuditEntry,
} from '@/components/staff/StaffOrderAdditions';

export const metadata: Metadata = {
  title: 'Order Detail — Staff',
};

export default async function StaffOrderDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const { serviceClient } = await requireServerAuth();

  // serviceClient bypasses RLS — staff is neither buyer nor seller, but
  // needs read access to every order. Same select shape as `getOrder()` so
  // OrderDetailClient renders identically to the user-facing path.
  const { data: order, error } = await serviceClient
    .from('orders')
    .select(`
      *,
      order_items(id, order_id, listing_id, price_cents, active, created_at,
        listings(game_name, game_year, condition, photos, games(thumbnail),
          listing_expansions(game_name))
      ),
      listings(game_name, game_year, condition, photos, games(thumbnail)),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, avatar_url, country, phone, email),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name, avatar_url, country, phone, email)
    `)
    .eq('id', params.id)
    .single<OrderWithDetails>();

  if (error || !order) {
    notFound();
  }

  const [disputeResult, trackingEvents, refundAuditResult, messages] = await Promise.all([
    serviceClient
      .from('disputes')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle<DisputeRow>(),
    order.barcode ? getTrackingEvents(order.id) : Promise.resolve([]),
    serviceClient
      .from('audit_log')
      .select('created_at, actor_type, metadata')
      .eq('resource_type', 'order')
      .eq('resource_id', order.id)
      .eq('action', 'order.refunded')
      .order('created_at', { ascending: false })
      .limit(5),
    getOrderMessages(order.id),
  ]);

  const dispute = disputeResult.data ?? null;
  const refundAuditEntries = (refundAuditResult.data ?? []) as RefundAuditEntry[];
  const orderWithDispute = { ...order, dispute };
  const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus];

  return (
    <div>
      <BackLink href="/staff/orders" label="All orders" />

      <div className="flex items-center gap-3 mt-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
          {order.order_number}
        </h2>
        {statusConfig && (
          <Badge variant={statusConfig.badgeVariant}>{statusConfig.label}</Badge>
        )}
        {order.payment_method === 'wallet' && (
          <Badge variant="default">wallet</Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Same view the seller sees — STG is the seller's commercial agent
            (Article 3(b) PSD2; Article 7 of 282/2011 ESS commission), so the
            seller-shaped view is the operationally correct vantage point. */}
        <div className="lg:col-span-2">
          <OrderDetailClient
            order={orderWithDispute}
            userRole="seller"
            sellerPhone={order.seller_profile?.phone ?? null}
            existingReview={null}
            isReviewEligible={false}
            trackingEvents={trackingEvents}
            messages={messages}
            isStaff={true}
          />
        </div>

        <div className="lg:col-span-1">
          <StaffOrderAdditions
            order={order}
            dispute={dispute}
            refundAuditEntries={refundAuditEntries}
          />
        </div>
      </div>
    </div>
  );
}
