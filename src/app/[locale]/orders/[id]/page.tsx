import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getOrder } from '@/lib/services/orders';
import { Badge, Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus } from '@/lib/orders/types';

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: `Order ${id.slice(0, 8)}`,
  };
}

export default async function OrderDetailPage({
  params: { id },
}: {
  params: { id: string; locale: string };
}) {
  await requireServerAuth();

  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const condition = order.listings?.condition as ListingCondition | undefined;
  const badgeKey = condition ? conditionToBadgeKey[condition] : undefined;
  const conditionInfo = badgeKey ? conditionConfig[badgeKey] : undefined;
  const gameImage = order.listings?.games?.thumbnail ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-semantic-text-muted">
        <Link href="/account/orders" className="sm:hover:text-semantic-text-secondary transition-colors">
          Your orders
        </Link>
        <span className="mx-2">/</span>
        <span className="text-semantic-text-secondary">{order.order_number}</span>
      </nav>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
          Order {order.order_number}
        </h1>
        {statusConfig && (
          <Badge variant={statusConfig.badgeVariant}>{statusConfig.label}</Badge>
        )}
      </div>

      <div className="space-y-6">
        {/* Game details */}
        <Card>
          <CardBody>
            <div className="flex gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-semantic-bg-subtle">
                {gameImage ? (
                  <img
                    src={gameImage}
                    alt={order.listings?.game_name ?? 'Game'}
                    className="w-full h-full object-cover"
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
                  className="font-semibold text-semantic-text-heading sm:hover:text-semantic-primary transition-colors"
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
                  <span className="text-sm text-semantic-text-primary">
                    {order.seller_profile?.full_name ?? 'Anonymous'}
                  </span>
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
