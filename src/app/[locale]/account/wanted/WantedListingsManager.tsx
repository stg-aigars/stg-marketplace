'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ImageSquare, Trash } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Badge, Button, Tabs } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { cancelWantedListing } from '@/lib/wanted/actions';
import type { WantedListingWithGame, WantedListingStatus } from '@/lib/wanted/types';
import { WANTED_LISTING_STATUS_LABELS, WANTED_LISTING_STATUS_BADGE_VARIANT } from '@/lib/wanted/types';

interface WantedListingsManagerProps {
  listings: WantedListingWithGame[];
}

const TAB_KEYS: WantedListingStatus[] = ['active', 'cancelled'];
const TAB_LABELS: Record<WantedListingStatus, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
};

export function WantedListingsManager({ listings }: WantedListingsManagerProps) {
  const [activeTab, setActiveTab] = useState<WantedListingStatus>('active');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = listings.filter((l) => l.status === activeTab);

  const tabs = TAB_KEYS.map((key) => ({
    key,
    label: TAB_LABELS[key],
    count: listings.filter((l) => l.status === key).length,
  }));

  function handleCancel(id: string) {
    setCancellingId(id);
    startTransition(async () => {
      await cancelWantedListing(id);
      setCancellingId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as WantedListingStatus)}
      />

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-semantic-text-muted py-4 text-center">
            No {activeTab} wanted listings.
          </p>
        ) : (
          filtered.map((listing) => (
            <Card key={listing.id}>
              <CardBody>
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 shrink-0 bg-semantic-bg-surface rounded overflow-hidden flex items-center justify-center">
                    {(listing.version_thumbnail ?? listing.thumbnail) ? (
                      <Image
                        src={listing.version_thumbnail ?? listing.thumbnail!}
                        alt={listing.game_name}
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
                      {listing.game_name}
                      {(listing.edition_year ?? listing.game_year) ? ` (${listing.edition_year ?? listing.game_year})` : ''}
                    </p>
                    {(listing.language || listing.publisher) && (
                      <p className="text-xs text-semantic-text-muted mt-0.5">
                        {[listing.language, listing.publisher].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-semantic-text-muted mt-1">
                      Posted {formatDate(listing.created_at)}
                    </p>
                  </div>

                  {/* Status + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant={WANTED_LISTING_STATUS_BADGE_VARIANT[listing.status]}>
                      {WANTED_LISTING_STATUS_LABELS[listing.status]}
                    </Badge>
                    {listing.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(listing.id)}
                        loading={isPending && cancellingId === listing.id}
                      >
                        <Trash size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
