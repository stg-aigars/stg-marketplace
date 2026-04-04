'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Tabs } from '@/components/ui';
import { OrderCard } from '@/components/orders/OrderCard';
import type { OrderWithDetails } from '@/lib/orders/types';

interface OrderTabsProps {
  purchases: OrderWithDetails[];
  sales: OrderWithDetails[];
}

export function OrderTabs({ purchases, sales }: OrderTabsProps) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>('purchases');

  const orders = activeTab === 'purchases' ? purchases : sales;
  const showAs = activeTab === 'purchases' ? 'buyer' : 'seller';

  return (
    <div>
      <Tabs
        tabs={[
          { key: 'purchases', label: 'Purchases', count: purchases.length },
          { key: 'sales', label: 'Sales', count: sales.length },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as 'purchases' | 'sales')}
        className="mb-6"
      />

      {/* Order list */}
      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-semantic-text-muted">
            {activeTab === 'purchases'
              ? 'No purchases yet. Browse pre-loved games to find your next favourite.'
              : 'No sales yet. List a game to start selling.'}
          </p>
          <Button asChild>
            <Link href={activeTab === 'purchases' ? '/browse' : '/sell'} className="inline-block mt-4">
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
