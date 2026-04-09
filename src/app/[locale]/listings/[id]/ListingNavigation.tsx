'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr';
import { BackLink } from '@/components/ui';
import { readBrowseContext } from '@/lib/listings/browse-context';

interface ListingNavigationProps {
  listingId: string;
}

export function ListingNavigation({ listingId }: ListingNavigationProps) {
  const router = useRouter();
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);

  useEffect(() => {
    const ctx = readBrowseContext();
    if (!ctx) return;

    const index = ctx.ids.indexOf(listingId);
    if (index === -1) return;

    setPrevId(index > 0 ? ctx.ids[index - 1] : null);
    setNextId(index < ctx.ids.length - 1 ? ctx.ids[index + 1] : null);
    setBackUrl(`/browse${ctx.searchParams}`);
  }, [listingId]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowLeft' && prevId) {
        router.push(`/listings/${prevId}`);
      } else if (e.key === 'ArrowRight' && nextId) {
        router.push(`/listings/${nextId}`);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [prevId, nextId, router]);

  // Don't render if no browse context for this listing
  if (!backUrl) return null;

  return (
    <div className="flex items-center justify-between mb-4">
      <BackLink href={backUrl} label="Back to results" className="" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => prevId && router.push(`/listings/${prevId}`)}
          disabled={!prevId}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-secondary sm:hover:text-semantic-text-primary disabled:text-semantic-text-tertiary disabled:cursor-default transition-colors duration-250 ease-out-custom"
          aria-label="Previous listing"
        >
          <CaretLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => nextId && router.push(`/listings/${nextId}`)}
          disabled={!nextId}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-secondary sm:hover:text-semantic-text-primary disabled:text-semantic-text-tertiary disabled:cursor-default transition-colors duration-250 ease-out-custom"
          aria-label="Next listing"
        >
          <CaretRight size={20} />
        </button>
      </div>
    </div>
  );
}
