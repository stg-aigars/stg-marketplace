'use client';

import Link from 'next/link';
import { Warning } from '@phosphor-icons/react/ssr';
import { Avatar, Badge, BackLink, Card, CardBody } from '@/components/ui';
import { GameThumb, GameTitle } from '@/components/listings/atoms';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus, OrderWithDetails, CancellationReason } from '@/lib/orders/types';
import { ShippingInfo } from './ShippingInfo';
import { UnifiedTimeline } from './UnifiedTimeline';
import type { TrackingEventRow } from '@/lib/services/tracking';
import { OrderActions } from './OrderActions';
import { DisputeDetails } from './DisputeDetails';
import { ReviewForm, ReviewItem } from '@/components/reviews';
import type { ReviewRow } from '@/lib/reviews/types';
import { REVIEW_WINDOW_DAYS } from '@/lib/reviews/constants';
import { OrderMessageList } from './OrderMessageList';
import { OrderMessageForm } from './OrderMessageForm';
import type { OrderMessage } from '@/lib/order-messages/types';

interface OrderDetailClientProps {
  order: OrderWithDetails;
  userRole: 'buyer' | 'seller';
  sellerPhone: string | null;
  existingReview: ReviewRow | null;
  isReviewEligible: boolean;
  trackingEvents: TrackingEventRow[];
  messages: OrderMessage[];
  isStaff: boolean;
}

/** Buyer-facing cancelled copy based on cancellation reason */
function getCancelledMessage(role: 'buyer' | 'seller', reason: CancellationReason | null): string {
  if (role === 'seller') {
    return reason === 'declined' ? 'You declined this order' : 'This order was cancelled';
  }
  switch (reason) {
    case 'declined':
      return 'The seller declined this order. Your payment has been refunded.';
    case 'response_timeout':
      return 'This order expired because the seller didn\'t respond in time. Your payment has been refunded.';
    case 'shipping_timeout':
      return 'This order was cancelled because it was not shipped in time. Your payment has been refunded.';
    default:
      return 'This order was cancelled. Your payment has been refunded.';
  }
}

/** Contextual status message for the current user */
function getStatusMessage(status: OrderStatus, role: 'buyer' | 'seller', cancellationReason?: CancellationReason | null, parcelId?: number | null): string | null {
  if (status === 'cancelled') {
    return getCancelledMessage(role, cancellationReason ?? null);
  }

  const messages: Record<string, Partial<Record<OrderStatus, string>>> = {
    seller: {
      pending_seller: 'Waiting for you to accept this order',
      accepted: parcelId
        ? `Drop your parcel at any Unisend terminal. Use parcel ID: ${parcelId}`
        : 'Drop your parcel at any Unisend terminal',
      shipped: 'Waiting for the buyer to pick up the parcel',
      delivered: 'Buyer has picked up the parcel',
      completed: 'Order complete',
      disputed: 'The buyer reported an issue with this order. Please review and respond.',
      refunded: 'This order has been refunded',
    },
    buyer: {
      pending_seller: 'Waiting for the seller to accept your order',
      accepted: 'The seller is preparing your shipment',
      shipped: 'Your game is on the way — pick it up at your selected terminal',
      delivered: 'Confirm you received your game in good condition',
      completed: 'Order complete — enjoy your game',
      disputed: 'You reported an issue. The seller has been notified.',
      refunded: 'This order has been refunded',
    },
  };

  return messages[role]?.[status] ?? null;
}

export function OrderDetailClient({ order, userRole, sellerPhone, existingReview, isReviewEligible, trackingEvents, messages, isStaff }: OrderDetailClientProps) {
  const status = order.status as OrderStatus;
  const statusConfig = ORDER_STATUS_CONFIG[status];
  const statusMessage = getStatusMessage(status, userRole, order.cancellation_reason, order.unisend_parcel_id);

  // Derive items from order_items (preferred) or legacy listings join
  const items = order.order_items ?? [];
  const hasMultipleItems = items.length > 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/account/orders" label="Your orders" />

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Order {order.order_number}
        </h1>
        {statusConfig && (
          <Badge variant={statusConfig.badgeVariant} dot>{statusConfig.label}</Badge>
        )}
      </div>

      {/* Status message */}
      {statusMessage && (
        <div className="mb-6 p-4 rounded-lg bg-semantic-bg-subtle border border-semantic-border-subtle">
          <p className="text-sm text-semantic-text-secondary">{statusMessage}</p>
        </div>
      )}

      {/* Shipping error (seller only) */}
      {userRole === 'seller' && order.shipping_error && !order.unisend_parcel_id && (
        <div className="mb-6 p-4 rounded-lg bg-aurora-yellow/10 border border-aurora-yellow/30">
          <div className="flex items-start gap-3">
            <Warning size={20} className="text-aurora-yellow mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-semantic-text-heading">
                Shipping setup failed
              </p>
              <p className="text-sm text-semantic-text-secondary mt-1">
                {order.shipping_error}
              </p>
              <p className="text-sm text-semantic-text-muted mt-2">
                The order has been accepted. You can retry creating the shipping parcel below.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Actions (top for prominence) */}
        <OrderActions
          order={order}
          userRole={userRole}
          sellerPhone={sellerPhone}
          dispute={order.dispute}
        />

        {/* Dispute details */}
        {order.dispute && (
          <DisputeDetails dispute={order.dispute} />
        )}

        {/* Review section (buyer only) */}
        {userRole === 'buyer' && (existingReview || isReviewEligible) && (
          <Card>
            <CardBody>
              {existingReview ? (
                <div>
                  <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
                    Your review
                  </h2>
                  <ReviewItem review={existingReview} reviewerName="You" />
                </div>
              ) : isReviewEligible ? (
                <ReviewForm
                  orderId={order.id}
                  sellerId={order.seller_id}
                  sellerName={order.seller_profile?.full_name ?? 'the seller'}
                />
              ) : null}
            </CardBody>
          </Card>
        )}

        {/* Review window expired notice */}
        {userRole === 'buyer'
          && !existingReview
          && !isReviewEligible
          && ['delivered', 'completed'].includes(status)
          && order.delivered_at
          && (Date.now() - new Date(order.delivered_at).getTime()) >= REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
          && (
          <Card>
            <CardBody>
              <p className="text-sm text-semantic-text-muted">
                The review window for this order has closed.
              </p>
            </CardBody>
          </Card>
        )}

        {/* Unified order + tracking timeline */}
        <UnifiedTimeline
          order={{
            status,
            created_at: order.created_at,
            accepted_at: order.accepted_at,
            shipped_at: order.shipped_at,
            delivered_at: order.delivered_at,
            completed_at: order.completed_at,
            cancelled_at: order.cancelled_at,
            disputed_at: order.disputed_at,
            refunded_at: order.refunded_at,
            cancellation_reason: order.cancellation_reason,
            seller_country: order.seller_country,
            destination_country: order.terminal_country,
          }}
          trackingEvents={trackingEvents}
          trackingUrl={order.tracking_url}
          destinationTerminal={order.terminal_name ?? undefined}
        />

        {/* Terminal reference panel */}
        <ShippingInfo
          terminalName={order.terminal_name}
          terminalAddress={order.terminal_address}
          terminalCity={order.terminal_city}
          terminalPostalCode={order.terminal_postal_code}
          terminalCountry={order.terminal_country}
          userRole={userRole}
        />

        {/* Items */}
        <Card>
          <CardBody>
            {hasMultipleItems && (
              <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
                Items ({items.length})
              </h2>
            )}
            <div className={hasMultipleItems ? 'space-y-3' : ''}>
              {items.map((item) => {
                const itemCondition = item.listings?.condition as ListingCondition | undefined;
                const itemBadgeKey = itemCondition ? conditionToBadgeKey[itemCondition] : undefined;
                const itemConditionInfo = itemBadgeKey ? conditionConfig[itemBadgeKey] : undefined;
                const itemImage = item.listings?.games?.thumbnail ?? null;
                const itemGameName = item.listings?.game_year
                  ? `${item.listings.game_name ?? 'Unknown game'} (${item.listings.game_year})`
                  : item.listings?.game_name ?? 'Unknown game';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const itemExpansions = ((item.listings as any)?.listing_expansions ?? []) as Array<{ game_name: string }>;

                return (
                  <div key={item.id} className={`flex gap-4 ${hasMultipleItems ? 'pb-3 border-b border-semantic-border-subtle last:border-0 last:pb-0' : ''}`}>
                    <GameThumb src={itemImage} alt={itemGameName} size={hasMultipleItems ? 'lg' : 'xl'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            href={`/listings/${item.listing_id}`}
                            className="sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom"
                          >
                            <GameTitle name={itemGameName} size={hasMultipleItems ? 'md' : 'lg'} serif />
                          </Link>
                          {itemExpansions.length > 0 && (
                            <p className="text-xs text-semantic-text-muted mt-0.5">
                              +{itemExpansions.length} {itemExpansions.length === 1 ? 'expansion' : 'expansions'}:{' '}
                              {itemExpansions.map((e) => e.game_name).join(', ')}
                            </p>
                          )}
                        </div>
                        {hasMultipleItems && (
                          <span className="text-sm font-semibold text-semantic-text-heading flex-shrink-0">
                            {formatCentsToCurrency(item.price_cents)}
                          </span>
                        )}
                      </div>
                      {itemBadgeKey && itemConditionInfo && (
                        <div className="mt-1">
                          <Badge condition={itemBadgeKey}>{itemConditionInfo.label}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Price breakdown */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Price breakdown
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-semantic-text-secondary">
                  {hasMultipleItems ? `Items (${items.length})` : 'Item price'}
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
            </div>
          </CardBody>
        </Card>

        {/* Buyer & Seller */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Participants
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-semantic-text-muted mb-1">Buyer</p>
                <div className="flex items-center gap-2">
                  <Avatar name={order.buyer_profile?.full_name ?? '?'} src={order.buyer_profile?.avatar_url} size="sm" />
                  {order.buyer_profile?.country && (
                    <span
                      className={getCountryFlag(order.buyer_profile.country)}
                      title={getCountryName(order.buyer_profile.country)}
                    />
                  )}
                  <span className="text-sm text-semantic-text-primary">
                    {order.buyer_profile?.full_name ?? 'Anonymous'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-semantic-text-muted mb-1">Seller</p>
                <div className="flex items-center gap-2">
                  <Avatar name={order.seller_profile?.full_name ?? '?'} src={order.seller_profile?.avatar_url} size="sm" />
                  {order.seller_profile?.country && (
                    <span
                      className={getCountryFlag(order.seller_profile.country)}
                      title={getCountryName(order.seller_profile.country)}
                    />
                  )}
                  <Link
                    href={`/sellers/${order.seller_id}`}
                    className="text-sm text-semantic-text-primary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom"
                  >
                    {order.seller_profile?.full_name ?? 'Anonymous'}
                  </Link>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Messages */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Messages
            </h2>
            <OrderMessageList messages={messages} isStaff={isStaff} />
            <div className="mt-4 pt-4 border-t border-semantic-border-subtle">
              <OrderMessageForm orderId={order.id} />
            </div>
          </CardBody>
        </Card>

        <p className="text-sm text-semantic-text-muted">
          Need help?{' '}
          <Link
            href="/contact"
            className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
          >
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
