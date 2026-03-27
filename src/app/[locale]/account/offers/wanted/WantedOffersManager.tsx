'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ImageSquare, Handshake, PaperPlaneTilt } from '@phosphor-icons/react/ssr';
import { Tabs, EmptyState, Card, CardBody, Badge, Button } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { conditionToBadgeKey } from '@/lib/listings/types';
import { formatDate } from '@/lib/date-utils';
import { OFFER_STATUS_LABELS, OFFER_STATUS_BADGE_VARIANT } from '@/lib/shelves/types';
import {
  acceptWantedOffer,
  declineWantedOffer,
  cancelWantedOffer,
} from '@/lib/wanted/offer-actions';
import type { WantedOfferWithDetails } from '@/lib/wanted/types';

interface WantedOffersManagerProps {
  received: WantedOfferWithDetails[];
  sent: WantedOfferWithDetails[];
}

export function WantedOffersManager({ received, sent }: WantedOffersManagerProps) {
  const [activeTab, setActiveTab] = useState('received');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const tabs = [
    { key: 'received', label: 'Received', count: received.length },
    { key: 'sent', label: 'Sent', count: sent.length },
  ];

  const offers = activeTab === 'received' ? received : sent;
  const isReceiver = activeTab === 'received';

  function handleAction(offerId: string, action: () => Promise<unknown>) {
    setPendingId(offerId);
    startTransition(async () => {
      await action();
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {offers.length === 0 ? (
        isReceiver ? (
          <EmptyState
            icon={Handshake}
            title="No wanted offers received yet"
            description="When sellers make offers on your wanted games, they will appear here"
          />
        ) : (
          <EmptyState
            icon={PaperPlaneTilt}
            title="No wanted offers sent yet"
            description="Browse wanted games and make offers to buyers"
            action={{ label: 'Browse wanted', href: '/wanted', variant: 'primary' }}
          />
        )
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const agreedPrice = offer.counter_price_cents ?? offer.price_cents;
            const isActionable = offer.status === 'pending' || offer.status === 'countered';
            const loading = isPending && pendingId === offer.id;

            return (
              <Card key={offer.id}>
                <CardBody>
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-14 shrink-0 bg-semantic-bg-surface rounded overflow-hidden flex items-center justify-center">
                      {offer.thumbnail ? (
                        <Image
                          src={offer.thumbnail}
                          alt={offer.game_name}
                          fill
                          className="object-contain p-1"
                          sizes="56px"
                        />
                      ) : (
                        <ImageSquare size={24} className="text-semantic-text-muted" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-semantic-text-heading truncate">
                        {offer.game_name}
                        {offer.game_year ? ` (${offer.game_year})` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge condition={conditionToBadgeKey[offer.condition]} />
                        <span className="text-sm font-semibold text-semantic-text-heading">
                          {formatCentsToCurrency(agreedPrice)}
                        </span>
                        {offer.counter_price_cents && (
                          <span className="text-xs text-semantic-text-muted line-through">
                            {formatCentsToCurrency(offer.price_cents)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-semantic-text-muted mt-1">
                        {isReceiver ? `From ${offer.seller_name}` : `To ${offer.buyer_name}`}
                        {' · '}
                        {formatDate(offer.created_at)}
                      </p>
                    </div>

                    {/* Status + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={OFFER_STATUS_BADGE_VARIANT[offer.status]}>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>

                      {isActionable && isReceiver && offer.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleAction(offer.id, () => acceptWantedOffer(offer.id))}
                            loading={loading}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(offer.id, () => declineWantedOffer(offer.id))}
                            loading={loading}
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {isActionable && !isReceiver && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(offer.id, () => cancelWantedOffer(offer.id))}
                          loading={loading}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
