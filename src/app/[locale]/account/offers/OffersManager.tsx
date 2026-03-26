'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, PaperPlaneTilt } from '@phosphor-icons/react/ssr';
import { Tabs, EmptyState } from '@/components/ui';
import { OfferCard } from '@/components/offers/OfferCard';
import type { OfferWithDetails } from '@/lib/shelves/types';

interface OffersManagerProps {
  sent: OfferWithDetails[];
  received: OfferWithDetails[];
}

export function OffersManager({ sent, received }: OffersManagerProps) {
  const [activeTab, setActiveTab] = useState('received');
  const router = useRouter();

  const tabs = [
    { key: 'received', label: 'Received', count: received.length },
    { key: 'sent', label: 'Sent', count: sent.length },
  ];

  function handleUpdated() {
    router.refresh();
  }

  const offers = activeTab === 'received' ? received : sent;
  const role = activeTab === 'received' ? 'seller' : 'buyer';

  return (
    <>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {offers.length === 0 ? (
        activeTab === 'received' ? (
          <EmptyState
            icon={Handshake}
            title="No offers received yet"
            description="When buyers make offers on your shelf items, they will appear here"
          />
        ) : (
          <EmptyState
            icon={PaperPlaneTilt}
            title="No offers sent yet"
            description="Browse seller shelves to find games and make offers"
          />
        )
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              role={role}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </>
  );
}
