import Image from 'next/image';
import Link from 'next/link';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus, OrderWithDetails } from '@/lib/orders/types';

interface OrderCardProps {
  order: OrderWithDetails;
  /** Whether to show the counterparty as buyer or seller */
  showAs: 'buyer' | 'seller';
}

export function OrderCard({ order, showAs }: OrderCardProps) {
  const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const gameImage = order.listings?.games?.thumbnail ?? null;

  // Action needed: seller has pending order, or buyer has delivered order
  const actionNeeded =
    (showAs === 'seller' && order.status === 'pending_seller') ||
    (showAs === 'buyer' && order.status === 'delivered');

  // Show the other party
  const counterparty = showAs === 'buyer'
    ? order.seller_profile
    : order.buyer_profile;
  const counterpartyLabel = showAs === 'buyer' ? 'Seller' : 'Buyer';

  return (
    <Link href={`/orders/${order.id}`}>
      <Card hoverable>
        <CardBody>
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-lg overflow-hidden bg-semantic-bg-subtle">
              {gameImage ? (
                <Image
                  src={gameImage}
                  alt={order.listings?.game_name ?? 'Game'}
                  fill
                  sizes="(min-width: 640px) 64px, 56px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-semantic-text-muted text-xs">
                  No image
                </div>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-semantic-text-heading truncate">
                    {order.listings?.game_name ?? 'Unknown game'}
                  </p>
                  <p className="text-xs text-semantic-text-muted mt-0.5">
                    {order.order_number}
                  </p>
                </div>
                <p className="font-semibold text-semantic-text-heading flex-shrink-0">
                  {formatCentsToCurrency(order.total_amount_cents)}
                </p>
              </div>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {statusConfig && (
                  <Badge variant={statusConfig.badgeVariant} dot>
                    {statusConfig.label}
                  </Badge>
                )}
                {actionNeeded && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-semantic-warning-hover">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-warning" />
                    Action needed
                  </span>
                )}
                <span className="text-xs text-semantic-text-muted">
                  {formatDate(order.created_at)}
                </span>
                {counterparty && (
                  <span className="text-xs text-semantic-text-muted flex items-center gap-1">
                    {counterpartyLabel}:
                    {counterparty.country && (
                      <span
                        className={getCountryFlag(counterparty.country)}
                        title={getCountryName(counterparty.country)}
                      />
                    )}
                    {counterparty.full_name ?? 'Anonymous'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
