'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Warning } from '@phosphor-icons/react/ssr';
import { Badge, Breadcrumb, Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus, OrderWithDetails } from '@/lib/orders/types';
import { OrderTimeline } from './OrderTimeline';
import { ShippingInfo } from './ShippingInfo';
import { OrderActions } from './OrderActions';
import { DisputeDetails } from './DisputeDetails';
import { ReviewForm, ReviewItem } from '@/components/reviews';
import type { ReviewRow } from '@/lib/reviews/types';
import { REVIEW_WINDOW_DAYS } from '@/lib/reviews/constants';

interface OrderDetailClientProps {
  order: OrderWithDetails;
  userRole: 'buyer' | 'seller';
  sellerPhone: string | null;
  existingReview: ReviewRow | null;
  isReviewEligible: boolean;
}

/** Contextual status message for the current user */
function getStatusMessage(status: OrderStatus, role: 'buyer' | 'seller'): string | null {
  const messages: Record<string, Record<OrderStatus, string | null>> = {
    seller: {
      pending_seller: 'Waiting for you to accept this order',
      accepted: 'Drop your parcel at any Unisend terminal',
      shipped: 'Waiting for the buyer to pick up the parcel',
      delivered: 'Buyer has picked up the parcel',
      completed: 'Order complete',
      cancelled: 'You declined this order',
      disputed: 'The buyer reported an issue with this order. Please review and respond.',
      refunded: 'This order has been refunded',
    },
    buyer: {
      pending_seller: 'Waiting for the seller to accept your order',
      accepted: 'The seller is preparing your shipment',
      shipped: 'Your game is on the way — pick it up at your selected terminal',
      delivered: 'Confirm you received your game in good condition',
      completed: 'Order complete — enjoy your game',
      cancelled: 'This order was cancelled',
      disputed: 'You reported an issue. The seller has been notified.',
      refunded: 'This order has been refunded',
    },
  };

  return messages[role]?.[status] ?? null;
}

export function OrderDetailClient({ order, userRole, sellerPhone, existingReview, isReviewEligible }: OrderDetailClientProps) {
  const status = order.status as OrderStatus;
  const statusConfig = ORDER_STATUS_CONFIG[status];
  const condition = order.listings?.condition as ListingCondition | undefined;
  const badgeKey = condition ? conditionToBadgeKey[condition] : undefined;
  const conditionInfo = badgeKey ? conditionConfig[badgeKey] : undefined;
  const gameImage = order.listings?.games?.thumbnail ?? null;
  const statusMessage = getStatusMessage(status, userRole);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Your orders', href: '/account/orders' },
        { label: order.order_number },
      ]} />

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

        {/* Timeline */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Order progress
            </h2>
            <OrderTimeline
              status={status}
              timestamps={{
                created_at: order.created_at,
                accepted_at: order.accepted_at,
                shipped_at: order.shipped_at,
                delivered_at: order.delivered_at,
                completed_at: order.completed_at,
                cancelled_at: order.cancelled_at,
                disputed_at: order.disputed_at,
                refunded_at: order.refunded_at,
              }}
            />
          </CardBody>
        </Card>

        {/* Shipping info (shown after accept) */}
        <ShippingInfo
          terminalName={order.terminal_name}
          terminalCountry={order.terminal_country}
          parcelId={order.unisend_parcel_id}
          barcode={order.barcode}
          trackingUrl={order.tracking_url}
          userRole={userRole}
        />

        {/* Game details */}
        <Card>
          <CardBody>
            <div className="flex gap-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-semantic-bg-subtle">
                {gameImage ? (
                  <Image
                    src={gameImage}
                    alt={order.listings?.game_name ?? 'Game'}
                    fill
                    sizes="(min-width: 640px) 80px, 64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-semantic-text-muted text-xs">
                    No image
                  </div>
                )}
              </div>
              <div>
                <Link
                  href={`/listings/${order.listing_id}`}
                  className="font-semibold text-semantic-text-heading sm:hover:text-semantic-primary transition-colors duration-250 ease-out-custom"
                >
                  {order.listings?.game_name ?? 'Unknown game'}
                  {order.listings?.game_year && (
                    <span className="text-semantic-text-muted font-normal ml-1">
                      ({order.listings.game_year})
                    </span>
                  )}
                </Link>
                {badgeKey && conditionInfo && (
                  <div className="mt-1">
                    <Badge condition={badgeKey}>{conditionInfo.label}</Badge>
                  </div>
                )}
              </div>
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
                <span className="text-semantic-text-secondary">Item price</span>
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
                  {order.seller_profile?.country && (
                    <span
                      className={getCountryFlag(order.seller_profile.country)}
                      title={getCountryName(order.seller_profile.country)}
                    />
                  )}
                  <Link
                    href={`/sellers/${order.seller_id}`}
                    className="text-sm text-semantic-text-primary sm:hover:text-semantic-primary transition-colors duration-250 ease-out-custom"
                  >
                    {order.seller_profile?.full_name ?? 'Anonymous'}
                  </Link>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Order meta */}
        <p className="text-sm text-semantic-text-muted">
          Order placed {formatDate(order.created_at)}
        </p>
      </div>
    </div>
  );
}
