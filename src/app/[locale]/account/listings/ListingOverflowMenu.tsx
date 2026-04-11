'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DotsThreeVertical, PencilSimple, Trash } from '@phosphor-icons/react/ssr';
import { RemoveListingModal } from '@/components/listings/RemoveListingModal';
import { isAuctionWithBids, type ListingType } from '@/lib/listings/types';
import { useClickOutside } from '@/hooks/useClickOutside';

interface ListingOverflowMenuProps {
  listingId: string;
  listingType: ListingType;
  bidCount: number;
}

export function ListingOverflowMenu({ listingId, listingType, bidCount }: ListingOverflowMenuProps) {
  const { locale } = useParams<{ locale: string }>();
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasAuctionBids = isAuctionWithBids(listingType, bidCount);

  useClickOutside(() => setOpen(false), open, menuRef);

  if (hasAuctionBids) return null;

  return (
    <>
      <div ref={menuRef} className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm active:bg-semantic-bg-overlay sm:hover:bg-semantic-bg-overlay transition-colors duration-250 ease-out-custom"
          aria-label="Listing actions"
        >
          <DotsThreeVertical size={18} weight="bold" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg overflow-hidden">
            <Link
              href={`/${locale}/listings/${listingId}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-semantic-text-primary hover:bg-semantic-bg-surface transition-colors duration-250 ease-out-custom"
            >
              <PencilSimple size={16} />
              Edit
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setShowConfirm(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-semantic-error hover:bg-semantic-bg-surface transition-colors duration-250 ease-out-custom"
            >
              <Trash size={16} />
              Remove
            </button>
          </div>
        )}
      </div>

      <RemoveListingModal
        listingId={listingId}
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
      />
    </>
  );
}
