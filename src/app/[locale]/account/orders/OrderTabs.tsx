'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
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
      {/* Tab buttons */}
      <div className="flex gap-1 mb-6 border-b border-semantic-border-subtle">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'purchases'
              ? 'text-semantic-primary'
              : 'text-semantic-text-muted sm:hover:text-semantic-text-secondary'
          }`}
        >
          Purchases ({purchases.length})
          {activeTab === 'purchases' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-semantic-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'sales'
              ? 'text-semantic-primary'
              : 'text-semantic-text-muted sm:hover:text-semantic-text-secondary'
          }`}
        >
          Sales ({sales.length})
          {activeTab === 'sales' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-semantic-primary" />
          )}
        </button>
      </div>

      {/* Order list */}
      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-semantic-text-muted">
            {activeTab === 'purchases'
              ? 'No purchases yet. Browse pre-loved games to find your next favourite.'
              : 'No sales yet. List a game to start selling.'}
          </p>
          <Link href={activeTab === 'purchases' ? '/browse' : '/sell'} className="inline-block mt-4">
            <Button>{activeTab === 'purchases' ? 'Browse games' : 'List a game'}</Button>
          </Link>
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
