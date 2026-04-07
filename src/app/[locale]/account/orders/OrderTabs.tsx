'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gavel, Timer } from '@phosphor-icons/react/ssr';
import { Button, Tabs, Card, CardBody } from '@/components/ui';
import { ListingIdentity } from '@/components/listings/atoms';
import { OrderCard } from '@/components/orders/OrderCard';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';
import { usePayAuction } from '@/lib/hooks/usePayAuction';
import type { ListingCondition } from '@/lib/listings/types';
import type { OrderWithDetails } from '@/lib/orders/types';

interface WonAuction {
  id: string;
  game_name: string;
  game_year: number | null;
  thumbnail: string | null;
  current_bid_cents: number;
  payment_deadline_at: string | null;
  condition: string;
  seller_id: string;
  seller_country: string;
  seller_name: string;
  seller_avatar_url: string | null;
}

interface OrderTabsProps {
  purchases: OrderWithDetails[];
  sales: OrderWithDetails[];
  wonAuctions?: WonAuction[];
  defaultTab?: 'purchases' | 'sales';
}

function PayAuctionButton({ auction }: { auction: WonAuction }) {
  const { payNow } = usePayAuction({
    id: auction.id,
    gameTitle: auction.game_name,
    gameThumbnail: auction.thumbnail,
    currentBidCents: auction.current_bid_cents,
    paymentDeadlineAt: auction.payment_deadline_at,
    sellerCountry: auction.seller_country,
    sellerId: auction.seller_id,
    sellerName: auction.seller_name,
    sellerAvatarUrl: auction.seller_avatar_url,
    condition: auction.condition as ListingCondition,
  });
  return <Button size="sm" onClick={payNow}>Pay now</Button>;
}

export function OrderTabs({ purchases, sales, wonAuctions = [], defaultTab = 'purchases' }: OrderTabsProps) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>(defaultTab);

  const orders = activeTab === 'purchases' ? purchases : sales;
  const showAs = activeTab === 'purchases' ? 'buyer' : 'seller';

  return (
    <div>
      <Tabs
        tabs={[
          { key: 'purchases', label: 'Purchases', count: purchases.length + wonAuctions.length },
          { key: 'sales', label: 'Sales', count: sales.length },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as 'purchases' | 'sales')}
        className="mb-6"
      />

      {/* Won auctions awaiting payment — purchases tab only */}
      {activeTab === 'purchases' && wonAuctions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
            Awaiting payment
          </h2>
          <div className="space-y-3">
            {wonAuctions.map((auction) => (
              <Card key={auction.id}>
                <CardBody>
                  <ListingIdentity
                    listingId={auction.id}
                    image={auction.thumbnail}
                    title={auction.game_name + (auction.game_year ? ` (${auction.game_year})` : '')}
                    size="md"
                    price={
                      <div className="flex items-center gap-1.5 text-xs text-semantic-text-muted">
                        <Gavel size={12} weight="bold" />
                        <span>Won for {formatCentsToCurrency(auction.current_bid_cents)}</span>
                      </div>
                    }
                    action={<PayAuctionButton auction={auction} />}
                  />
                  {auction.payment_deadline_at && (
                    <div className="flex items-center gap-1.5 mt-1 ml-[68px] text-xs text-aurora-orange">
                      <Timer size={12} weight="bold" />
                      <span>Pay by {formatDateTime(auction.payment_deadline_at)}</span>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Order list */}
      {orders.length === 0 && (activeTab !== 'purchases' || wonAuctions.length === 0) ? (
        <div className="text-center py-12">
          <p className="text-semantic-text-muted">
            {activeTab === 'purchases'
              ? 'No purchases yet. Browse pre-loved games to find your next favourite.'
              : 'No sales yet. List a game to start selling.'}
          </p>
          <Button className="mt-4" asChild>
            <Link href={activeTab === 'purchases' ? '/browse' : '/sell'}>
              {activeTab === 'purchases' ? 'Browse games' : 'List a game'}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} showAs={showAs} />
          ))}
        </div>
      )}
    </div>
  );
}
