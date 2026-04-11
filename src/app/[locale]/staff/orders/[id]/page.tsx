import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getTrackingEvents } from '@/lib/services/tracking';
import { Card, CardBody, Badge, BackLink, ConditionBadge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus, OrderWithDetails, DisputeRow } from '@/lib/orders/types';
import type { ListingCondition } from '@/lib/listings/types';
import {
  EnvelopeSimple,
  Phone,
  User,
  CreditCard,
  Warning,
  Info,
} from '@phosphor-icons/react/ssr';

export const metadata: Metadata = {
  title: 'Order Detail — Staff',
};

interface RefundAuditEntry {
  created_at: string;
  actor_type: string;
  metadata: {
    cardRefunded?: number;
    walletRefunded?: number;
    totalRefunded?: number;
    refundStatus?: string;
    expectedTotal?: number;
  } | null;
}

export default async function StaffOrderDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const { serviceClient } = await requireServerAuth();

  // Fetch order with full relations using service client (bypasses RLS)
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

  const [disputeResult, trackingEvents, refundAuditResult] = await Promise.all([
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
  ]);

  const dispute = disputeResult.data;
  const refundAuditEntries = (refundAuditResult.data ?? []) as RefundAuditEntry[];
  const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus];

  return (
    <div>
      <BackLink href="/staff/orders" label="All orders" />

      {/* Header */}
      <div className="flex items-center gap-3 mt-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
          {order.order_number}
        </h2>
        <Badge variant={statusConfig?.badgeVariant ?? 'default'}>
          {statusConfig?.label ?? order.status}
        </Badge>
        {order.payment_method === 'wallet' && (
          <Badge variant="default">wallet</Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
          {/* Price breakdown */}
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
                Price breakdown
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-semantic-text-secondary">
                    {order.order_items.length > 1 ? `Items (${order.order_items.length})` : 'Item price'}
                  </span>
                  <span className="text-semantic-text-primary">
                    {formatCentsToCurrency(order.items_total_cents)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-semantic-text-secondary">Shipping</span>
                  <span className="text-semantic-text-primary">
                    {formatCentsToCurrency(order.shipping_cost_cents)}
                  </span>
                </div>
                <div className="border-t border-semantic-border-subtle pt-2">
                  <div className="flex justify-between font-semibold">
                    <span className="text-semantic-text-heading">Total paid</span>
                    <span className="text-semantic-text-heading">
                      {formatCentsToCurrency(order.total_amount_cents)}
                    </span>
                  </div>
                </div>
                {order.platform_commission_cents != null && (
                  <>
                    <div className="border-t border-semantic-border-subtle pt-2 flex justify-between text-sm">
                      <span className="text-semantic-text-secondary">Commission (10%)</span>
                      <span className="text-semantic-text-primary">
                        {formatCentsToCurrency(order.platform_commission_cents)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-semantic-text-secondary">Seller receives</span>
                      <span className="text-semantic-success font-medium">
                        {formatCentsToCurrency(order.items_total_cents - order.platform_commission_cents)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Participants */}
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
                Participants
              </h3>
              <div className="space-y-4">
                <ParticipantInfo
                  role="Buyer"
                  name={order.buyer_profile?.full_name}
                  email={order.buyer_profile?.email}
                  phone={order.buyer_phone ?? order.buyer_profile?.phone}
                  country={order.buyer_profile?.country}
                />
                <div className="border-t border-semantic-border-subtle" />
                <ParticipantInfo
                  role="Seller"
                  name={order.seller_profile?.full_name}
                  email={order.seller_profile?.email}
                  phone={order.seller_phone ?? order.seller_profile?.phone}
                  country={order.seller_profile?.country}
                />
              </div>
            </CardBody>
          </Card>

          {/* Payment info */}
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
                <CreditCard size={16} className="inline mr-1.5 -mt-0.5" />
                Payment
              </h3>
              <dl className="space-y-2 text-sm">
                {order.everypay_payment_reference && (
                  <div>
                    <dt className="text-semantic-text-muted">EveryPay ref</dt>
                    <dd className="font-mono text-semantic-text-primary truncate">
                      {order.everypay_payment_reference}
                    </dd>
                  </div>
                )}
                {order.everypay_payment_state && (
                  <div>
                    <dt className="text-semantic-text-muted">Payment state</dt>
                    <dd className="text-semantic-text-primary capitalize">
                      {order.everypay_payment_state}
                    </dd>
                  </div>
                )}
                {order.payment_method && (
                  <div>
                    <dt className="text-semantic-text-muted">Method</dt>
                    <dd className="text-semantic-text-primary capitalize">
                      {order.payment_method === 'bank_link' ? 'Bank link' : order.payment_method}
                    </dd>
                  </div>
                )}
                {order.buyer_wallet_debit_cents > 0 && (
                  <div>
                    <dt className="text-semantic-text-muted">Wallet debit</dt>
                    <dd className="text-semantic-text-primary">
                      {formatCentsToCurrency(order.buyer_wallet_debit_cents)}
                    </dd>
                  </div>
                )}
                {order.seller_wallet_credit_cents != null && order.seller_wallet_credit_cents > 0 && (
                  <div>
                    <dt className="text-semantic-text-muted">Seller credit</dt>
                    <dd className="text-semantic-success font-medium">
                      {formatCentsToCurrency(order.seller_wallet_credit_cents)}
                    </dd>
                  </div>
                )}
                {order.wallet_credited_at && (
                  <div>
                    <dt className="text-semantic-text-muted">Credited at</dt>
                    <dd className="text-semantic-text-primary">
                      {formatDateTime(order.wallet_credited_at)}
                    </dd>
                  </div>
                )}
                {order.refund_amount_cents != null && order.refund_amount_cents > 0 && (
                  <div>
                    <dt className="text-semantic-text-muted">Refund</dt>
                    <dd className="text-semantic-error font-medium">
                      {formatCentsToCurrency(order.refund_amount_cents)}
                      {order.refund_status && (
                        <span className="text-semantic-text-muted font-normal ml-1">
                          ({order.refund_status})
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          {/* Shipping info */}
          {order.terminal_name && (
            <Card>
              <CardBody>
                <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
                  Shipping
                </h3>
                <div className="text-sm space-y-1">
                  <p className="text-semantic-text-primary font-medium">{order.terminal_name}</p>
                  {order.terminal_address && (
                    <p className="text-semantic-text-secondary">{order.terminal_address}</p>
                  )}
                  <p className="text-semantic-text-secondary">
                    {[order.terminal_city, order.terminal_postal_code, order.terminal_country].filter(Boolean).join(', ')}
                  </p>
                  {order.barcode && (
                    <p className="text-semantic-text-muted font-mono text-xs mt-2">
                      {order.barcode}
                    </p>
                  )}
                  {order.tracking_url && (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-semantic-brand text-xs sm:hover:underline inline-block mt-1"
                    >
                      Track shipment
                    </a>
                  )}
                </div>

                {/* Tracking events */}
                {trackingEvents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-semantic-border-subtle">
                    <p className="text-xs font-medium text-semantic-text-muted mb-2">
                      Tracking ({trackingEvents.length})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {trackingEvents.map((event, i) => (
                        <div key={i} className="text-xs">
                          <span className="text-semantic-text-muted">
                            {formatDateTime(event.event_timestamp)}
                          </span>
                          <span className="text-semantic-text-secondary ml-1.5">
                            {event.state_text}
                          </span>
                          {event.location && (
                            <span className="text-semantic-text-muted ml-1">
                              ({event.location})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
          {/* Refund status panel — prominent when refund is failed or partial */}
          {order.refund_status && order.refund_status !== 'completed' && (
            <Card className={
              order.refund_status === 'failed'
                ? 'border-semantic-error/30 bg-semantic-error/5'
                : 'border-semantic-warning/30 bg-semantic-warning/5'
            }>
              <CardBody>
                <div className="flex items-start gap-3">
                  <Warning size={20} className={
                    order.refund_status === 'failed'
                      ? 'text-semantic-error shrink-0 mt-0.5'
                      : 'text-semantic-warning shrink-0 mt-0.5'
                  } />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-semantic-text-heading">
                        Refund {order.refund_status}
                      </p>
                      <Badge variant={order.refund_status === 'failed' ? 'error' : 'warning'}>
                        {order.refund_status}
                      </Badge>
                    </div>
                    <p className="text-sm text-semantic-text-secondary">
                      {order.refund_status === 'failed'
                        ? 'No refund was processed. Resolve manually via EveryPay merchant portal (card) or direct wallet credit, then update refund_status in SQL.'
                        : 'Refund was partially processed. Reconcile the shortfall manually.'}
                    </p>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-semantic-text-muted">Expected total</dt>
                      <dd className="text-semantic-text-primary font-medium">
                        {formatCentsToCurrency(order.total_amount_cents)}
                      </dd>
                      <dt className="text-semantic-text-muted">Refunded</dt>
                      <dd className="text-semantic-text-primary font-medium">
                        {formatCentsToCurrency(order.refund_amount_cents ?? 0)}
                      </dd>
                      {order.refund_amount_cents != null && order.refund_amount_cents < order.total_amount_cents && (
                        <>
                          <dt className="text-semantic-text-muted">Shortfall</dt>
                          <dd className="text-semantic-error font-semibold">
                            {formatCentsToCurrency(order.total_amount_cents - order.refund_amount_cents)}
                          </dd>
                        </>
                      )}
                      {order.refunded_at && (
                        <>
                          <dt className="text-semantic-text-muted">Last attempt</dt>
                          <dd className="text-semantic-text-primary">
                            {formatDateTime(order.refunded_at)}
                          </dd>
                        </>
                      )}
                    </dl>

                    {refundAuditEntries.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-semantic-border-subtle">
                        <p className="text-xs font-medium text-semantic-text-muted mb-2">
                          Refund attempts ({refundAuditEntries.length})
                        </p>
                        <div className="space-y-1.5 text-xs">
                          {refundAuditEntries.map((entry) => {
                            const m = entry.metadata ?? {};
                            const card = m.cardRefunded ?? 0;
                            const wallet = m.walletRefunded ?? 0;
                            return (
                              <div key={entry.created_at} className="font-mono">
                                <span className="text-semantic-text-muted">
                                  {formatDateTime(entry.created_at)}
                                </span>
                                <span className="text-semantic-text-secondary ml-2">
                                  card: {formatCentsToCurrency(card)} · wallet: {formatCentsToCurrency(wallet)}
                                  {m.refundStatus && (
                                    <span className="ml-2 text-semantic-text-muted">
                                      → {m.refundStatus}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Dispute action card */}
          {order.status === 'disputed' && dispute?.id && (
            <Card className="border-semantic-error/30 bg-semantic-error/5">
              <CardBody className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Warning size={20} className="text-semantic-error shrink-0" />
                  <div>
                    <p className="font-semibold text-semantic-text-heading">Open dispute</p>
                    <p className="text-sm text-semantic-text-secondary mt-0.5">
                      Review buyer and seller claims, then resolve.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/staff/disputes/${dispute.id}`}
                  className="text-sm font-medium text-semantic-brand sm:hover:underline shrink-0"
                >
                  Resolve dispute
                </Link>
              </CardBody>
            </Card>
          )}

          {/* Refund notice (informational — action deferred to future PR) */}
          {order.status === 'cancelled' && !order.refunded_at && (
            <Card className="border-semantic-warning/30 bg-semantic-warning/5">
              <CardBody className="flex items-center gap-3">
                <Info size={20} className="text-semantic-warning shrink-0" />
                <div>
                  <p className="font-semibold text-semantic-text-heading">Refund not processed</p>
                  <p className="text-sm text-semantic-text-secondary mt-0.5">
                    This cancelled order has no refund on record. Process via EveryPay dashboard or wait for the reconciliation sweep.
                  </p>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Order items */}
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
                Items ({order.order_items.length})
              </h3>
              <div className="space-y-3">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {item.listings?.photos?.[0] && (
                      <div className="relative w-12 h-12 rounded-md overflow-hidden border border-semantic-border-subtle shrink-0">
                        <Image
                          src={item.listings.photos[0]}
                          alt={item.listings.game_name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-semantic-text-heading truncate">
                        {item.listings?.game_name ?? 'Game'}
                      </p>
                      {item.listings?.condition && (
                        <ConditionBadge condition={item.listings.condition as ListingCondition} />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-semantic-text-heading shrink-0">
                      {formatCentsToCurrency(item.price_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
                Timeline
              </h3>
              <div className="space-y-2 text-sm">
                <TimelineEntry label="Created" date={order.created_at} />
                <TimelineEntry label="Accepted" date={order.accepted_at} />
                <TimelineEntry label="Shipped" date={order.shipped_at} />
                <TimelineEntry label="Delivered" date={order.delivered_at} />
                <TimelineEntry label="Completed" date={order.completed_at} />
                <TimelineEntry label="Cancelled" date={order.cancelled_at} />
                {order.cancellation_reason && (
                  <div className="flex justify-between">
                    <span className="text-semantic-text-secondary">Reason</span>
                    <span className="text-semantic-text-primary capitalize">
                      {order.cancellation_reason.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                <TimelineEntry label="Disputed" date={order.disputed_at} />
                <TimelineEntry label="Refunded" date={order.refunded_at} />
              </div>
            </CardBody>
          </Card>

          {/* Dispute details (if exists) */}
          {dispute && (
            <Card>
              <CardBody>
                <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
                  Dispute details
                </h3>
                <p className="text-sm text-semantic-text-primary whitespace-pre-wrap mb-3">
                  {dispute.reason}
                </p>
                {dispute.photos && dispute.photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {dispute.photos.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square rounded-md overflow-hidden border border-semantic-border-subtle"
                      >
                        <Image
                          src={url}
                          alt={`Evidence ${i + 1}`}
                          fill
                          sizes="(min-width: 640px) 25vw, 50vw"
                          className="object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {dispute.resolution && (
                  <div className="border-t border-semantic-border-subtle pt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-semantic-text-muted">Resolution</span>
                      <Badge variant={dispute.resolution === 'refunded' ? 'error' : 'success'}>
                        {dispute.resolution === 'refunded' ? 'Refunded' : 'No refund'}
                      </Badge>
                    </div>
                    {dispute.refund_amount_cents != null && dispute.refund_amount_cents > 0 && (
                      <div className="flex justify-between">
                        <span className="text-semantic-text-muted">Refund amount</span>
                        <span className="text-semantic-text-primary font-medium">
                          {formatCentsToCurrency(dispute.refund_amount_cents)}
                        </span>
                      </div>
                    )}
                    {dispute.resolution_notes && (
                      <div>
                        <span className="text-semantic-text-muted">Notes</span>
                        <p className="mt-1 p-2 rounded bg-semantic-bg-subtle text-semantic-text-secondary text-xs">
                          {dispute.resolution_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ParticipantInfo({
  role,
  name,
  email,
  phone,
  country,
}: {
  role: string;
  name: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  country: string | null | undefined;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-semantic-text-muted mb-1.5">
        <User size={12} />
        <span className="uppercase tracking-wide">{role}</span>
        {country && (
          <span className="text-semantic-text-muted">({country})</span>
        )}
      </div>
      <p className="font-medium text-semantic-text-heading text-sm">
        {name ?? 'Unknown'}
      </p>
      {email && (
        <div className="flex items-center gap-1.5 text-sm text-semantic-text-secondary mt-0.5">
          <EnvelopeSimple size={12} className="shrink-0" />
          <span className="truncate">{email}</span>
        </div>
      )}
      {phone && (
        <div className="flex items-center gap-1.5 text-sm text-semantic-text-secondary mt-0.5">
          <Phone size={12} className="shrink-0" />
          <span>{phone}</span>
        </div>
      )}
    </div>
  );
}

function TimelineEntry({ label, date }: { label: string; date: string | null }) {
  if (!date) return null;
  return (
    <div className="flex justify-between">
      <span className="text-semantic-text-secondary">{label}</span>
      <span className="text-semantic-text-primary">{formatDateTime(date)}</span>
    </div>
  );
}
