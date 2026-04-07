import Link from 'next/link';
import { Card, CardBody, Badge, UserIdentity } from '@/components/ui';
import { GameThumb, GameTitle } from '@/components/listings/atoms';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus, OrderWithDetails } from '@/lib/orders/types';
import { getOrderGameSummary } from '@/lib/orders/utils';

interface OrderCardProps {
  order: OrderWithDetails;
  /** Whether to show the counterparty as buyer or seller */
  showAs: 'buyer' | 'seller';
}

export function OrderCard({ order, showAs }: OrderCardProps) {
  const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus];

  // Derive game display from order_items (preferred) or legacy listings join
  const items = order.order_items ?? [];
  const firstItem = items[0];
  const gameImage = firstItem?.listings?.games?.thumbnail ?? order.listings?.games?.thumbnail ?? null;
  const gameName = getOrderGameSummary(items.length > 0 ? items : undefined, order.listings);
  const extraItemCount = order.item_count > 1 ? order.item_count - 1 : 0;

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
            <div className="relative flex-shrink-0">
              <GameThumb
                src={gameImage}
                alt={gameName}
                size="lg"
              />
              {extraItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-semantic-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  +{extraItemCount}
                </span>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <GameTitle
                    name={gameName}
                    size="md"
                    serif
                  />
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
                    <UserIdentity
                      name={counterparty.full_name ?? 'Anonymous'}
                      avatarUrl={counterparty.avatar_url}
                      country={counterparty.country}
                      size="xs"
                    />
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
