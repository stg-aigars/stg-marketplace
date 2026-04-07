'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ImageSquare, Gavel, Timer } from '@phosphor-icons/react/ssr';
import { Button, Tabs, Card, CardBody, Alert } from '@/components/ui';
import { OrderCard } from '@/components/orders/OrderCard';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';
import type { OrderWithDetails } from '@/lib/orders/types';

interface WonAuction {
  id: string;
  game_name: string;
  game_year: number | null;
  thumbnail: string | null;
  current_bid_cents: number;
  payment_deadline_at: string | null;
  seller_country: string | null;
}

interface OrderTabsProps {
  purchases: OrderWithDetails[];
  sales: OrderWithDetails[];
  wonAuctions?: WonAuction[];
  defaultTab?: 'purchases' | 'sales';
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
                  <div className="flex gap-3">
                    <div className="relative w-14 h-14 shrink-0 bg-semantic-bg-surface rounded overflow-hidden flex items-center justify-center">
                      {auction.thumbnail ? (
                        <Image src={auction.thumbnail} alt={auction.game_name} fill className="object-contain p-1" sizes="56px" />
                      ) : (
                        <ImageSquare size={24} className="text-semantic-text-muted" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/listings/${auction.id}`}
                        className="text-sm font-medium text-semantic-text-heading truncate block active:text-semantic-brand sm:hover:text-semantic-brand"
                      >
                        {auction.game_name}
                        {auction.game_year ? ` (${auction.game_year})` : ''}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-semantic-text-muted">
                        <Gavel size={12} weight="bold" />
                        <span>Won for {formatCentsToCurrency(auction.current_bid_cents)}</span>
                      </div>
                      {auction.payment_deadline_at && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-aurora-orange">
                          <Timer size={12} weight="bold" />
                          <span>Pay by {formatDateTime(auction.payment_deadline_at)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center shrink-0">
                      <Button size="sm" asChild>
                        <Link href={`/checkout/auction/${auction.id}`}>Pay now</Link>
                      </Button>
                    </div>
                  </div>
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
