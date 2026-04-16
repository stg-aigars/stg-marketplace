'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Warning, FileText, Copy, Check } from '@phosphor-icons/react/ssr';
import { Alert, Badge, BackLink, Card, CardBody, UserIdentity } from '@/components/ui';
import { ListingIdentity } from '@/components/listings/atoms';
import { formatCentsToCurrency, calculateSellerEarnings } from '@/lib/services/pricing';
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
function getStatusMessage(status: OrderStatus, role: 'buyer' | 'seller', cancellationReason?: CancellationReason | null): string | null {
  if (status === 'cancelled') {
    return getCancelledMessage(role, cancellationReason ?? null);
  }

  const messages: Record<string, Partial<Record<OrderStatus, string>>> = {
    seller: {
      pending_seller: 'Waiting for you to accept this order',
      accepted: 'Drop your parcel at any compatible parcel locker',
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

function getAlertVariant(status: OrderStatus): 'error' | 'success' | 'warning' | 'info' {
  // Derived from ORDER_STATUS_CONFIG.badgeVariant, with 'default' → 'info'
  // and 'delivered' overridden to 'info' (action-required: buyer must confirm receipt)
  const v = ORDER_STATUS_CONFIG[status].badgeVariant;
  if (status === 'delivered') return 'info';
  return v === 'default' ? 'info' : v;
}

function BarcodeCard({ barcode }: { barcode: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard API may not be available */ }
  }

  return (
    <div className="mb-6 p-4 rounded-lg bg-semantic-brand/10 border border-semantic-brand/30">
      <p className="text-sm text-semantic-text-secondary mb-2">
        Enter this barcode at the parcel locker kiosk to print your shipping label
      </p>
      <div className="flex items-center gap-2">
        <code className="font-mono text-lg font-semibold tracking-wider text-semantic-text-heading">
          {barcode}
        </code>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-sm text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
        >
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>
    </div>
  );
}

export function OrderDetailClient({ order, userRole, sellerPhone, existingReview, isReviewEligible, trackingEvents, messages, isStaff }: OrderDetailClientProps) {
  const status = order.status as OrderStatus;
  const statusConfig = ORDER_STATUS_CONFIG[status];
  const statusMessage = getStatusMessage(status, userRole, order.cancellation_reason);

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
        <Alert variant={getAlertVariant(status)} className="mb-6">
          <p className="text-sm">{statusMessage}</p>
        </Alert>
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

      {/* Barcode card (seller only, accepted/shipped) */}
      {userRole === 'seller' && order.barcode && ['accepted', 'shipped'].includes(status) && (
        <BarcodeCard barcode={order.barcode} />
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
          // eslint-disable-next-line react-hooks/purity -- one-time render check for review window
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

        {/* Order summary */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Order summary
            </h2>

            {/* Item rows */}
            <div className="space-y-3 mb-4">
              {items.map((item) => {
                const itemImage = item.listings?.games?.thumbnail ?? null;
                const itemGameName = item.listings?.game_name ?? 'Unknown game';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const itemExpansionCount = ((item.listings as any)?.listing_expansions ?? []).length as number;
                return (
                  <ListingIdentity
                    key={item.id}
                    listingId={item.listing_id}
                    image={itemImage}
                    title={itemGameName}
                    expansionCount={itemExpansionCount}
                    price={
                      <span className="text-sm font-semibold text-semantic-text-heading">
                        {formatCentsToCurrency(item.price_cents)}
                      </span>
                    }
                  />
                );
              })}
            </div>

            {/* Price breakdown — buyer view */}
            {userRole === 'buyer' && (() => {
              const isCancelled = status === 'cancelled';
              const isRefunded = status === 'refunded';

              return (
                <div className="space-y-2 text-sm border-t border-semantic-border-subtle pt-3">
                  {hasMultipleItems && (
                    <div className="flex justify-between">
                      <span className="text-semantic-text-secondary">Items ({items.length})</span>
                      <span>{formatCentsToCurrency(order.items_total_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-semantic-text-secondary">Shipping</span>
                    <span>{formatCentsToCurrency(order.shipping_cost_cents)}</span>
                  </div>

                  <div className="border-t border-semantic-border-subtle pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-semantic-text-heading">
                        {isCancelled ? 'Total' : 'Total paid'}
                      </span>
                      <span className={isCancelled ? 'text-semantic-text-muted line-through' : 'text-semantic-text-heading'}>
                        {formatCentsToCurrency(order.total_amount_cents)}
                      </span>
                    </div>
                  </div>

                  {/* Refund line — cancelled or refunded */}
                  {(isCancelled || isRefunded) && (
                    <div className="flex justify-between font-medium text-semantic-success">
                      <span>Refunded</span>
                      <span>{formatCentsToCurrency(order.refund_amount_cents ?? order.total_amount_cents)}</span>
                    </div>
                  )}

                  {/* Payment method — only for active/completed orders (not cancelled) */}
                  {!isCancelled && (
                    <>
                      {order.payment_method === 'wallet' ? (
                        <div className="flex justify-between">
                          <span className="text-semantic-text-secondary">Paid from wallet</span>
                        </div>
                      ) : order.buyer_wallet_debit_cents > 0 ? (
                        <>
                          <div className="flex justify-between text-semantic-brand-active">
                            <span>Wallet</span>
                            <span>-{formatCentsToCurrency(order.buyer_wallet_debit_cents)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-semantic-text-secondary">
                              Paid by {order.payment_method === 'card' ? 'card' : 'bank link'}
                            </span>
                            <span>
                              {formatCentsToCurrency(order.total_amount_cents - order.buyer_wallet_debit_cents)}
                            </span>
                          </div>
                        </>
                      ) : order.payment_method ? (
                        <div className="flex justify-between">
                          <span className="text-semantic-text-secondary">
                            Paid by {order.payment_method === 'card' ? 'card' : 'bank link'}
                          </span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Price breakdown — seller view */}
            {userRole === 'seller' && (() => {
              const isCancelled = status === 'cancelled';
              const isRefunded = status === 'refunded';

              // Cancelled orders: no transaction occurred — skip financial breakdown
              if (isCancelled) {
                return (
                  <div className="text-sm border-t border-semantic-border-subtle pt-3">
                    <p className="text-semantic-text-muted">No charges applied</p>
                  </div>
                );
              }

              const hasActualAmounts = order.platform_commission_cents != null && order.seller_wallet_credit_cents != null;
              const estimated = calculateSellerEarnings(order.items_total_cents);

              const displayCommission = hasActualAmounts
                ? formatCentsToCurrency(order.platform_commission_cents!)
                : formatCentsToCurrency(estimated.commissionCents);

              const displayEarnings = hasActualAmounts
                ? formatCentsToCurrency(order.seller_wallet_credit_cents!)
                : `~${formatCentsToCurrency(estimated.walletCreditCents)}`;

              return (
                <div className="space-y-2 text-sm border-t border-semantic-border-subtle pt-3">
                  <div className="flex justify-between">
                    <span className="text-semantic-text-secondary">Items</span>
                    <span>{formatCentsToCurrency(order.items_total_cents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-semantic-text-secondary">Commission (10%)</span>
                    <span className="text-semantic-error">-{displayCommission}</span>
                  </div>

                  <div className="border-t border-semantic-border-subtle pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-semantic-text-heading">
                        {hasActualAmounts ? (isRefunded ? 'You received' : 'You receive') : 'You receive (est.)'}
                      </span>
                      <span className="text-semantic-brand-active">
                        {displayEarnings}
                      </span>
                    </div>
                  </div>

                  {/* Clawback line for refunded orders */}
                  {isRefunded && hasActualAmounts && (
                    <div className="flex justify-between font-medium text-semantic-error">
                      <span>Clawback</span>
                      <span>-{displayEarnings}</span>
                    </div>
                  )}

                  {/* Shipping note — only reference documents when they're accessible */}
                  <p className="text-xs text-semantic-text-muted">
                    Shipping ({formatCentsToCurrency(order.shipping_cost_cents)}) billed separately
                    {isRefunded && ' — see credit note'}
                    {status === 'completed' && ' — see commission invoice'}
                  </p>
                </div>
              );
            })()}

            {/* Document links */}
            {['completed', 'refunded'].includes(status) && (
              <div className="flex flex-wrap gap-3 border-t border-semantic-border-subtle pt-3 mt-3">
                {userRole === 'buyer' && (
                  <Link
                    href={`/orders/${order.id}/confirmation`}
                    className="flex items-center gap-1.5 text-sm text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom"
                  >
                    <FileText size={16} />
                    Order confirmation
                  </Link>
                )}
                {userRole === 'seller' && (
                  <>
                    <Link
                      href={`/orders/${order.id}/invoice`}
                      className="flex items-center gap-1.5 text-sm text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom"
                    >
                      <FileText size={16} />
                      Commission invoice
                    </Link>
                    {status === 'refunded' && (
                      <Link
                        href={`/orders/${order.id}/credit-note`}
                        className="flex items-center gap-1.5 text-sm text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom"
                      >
                        <FileText size={16} />
                        Credit note
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
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
                <UserIdentity
                  name={order.buyer_profile?.full_name ?? 'Anonymous'}
                  avatarUrl={order.buyer_profile?.avatar_url}
                  country={order.buyer_profile?.country}
                  size="sm"
                />
              </div>
              <div>
                <p className="text-sm text-semantic-text-muted mb-1">Seller</p>
                <UserIdentity
                  name={order.seller_profile?.full_name ?? 'Anonymous'}
                  avatarUrl={order.seller_profile?.avatar_url}
                  country={order.seller_profile?.country}
                  size="sm"
                  href={`/sellers/${order.seller_id}`}
                />
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
