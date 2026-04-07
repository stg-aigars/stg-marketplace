'use client';

import Link from 'next/link';
import { PuzzlePiece } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import { GameThumb } from './GameThumb';

interface ListingIdentityProps {
  listingId: string;
  image: string | null;
  title: string;
  expansionCount?: number;
  /** Typically `<Price cents={…} size="sm" />`, but callers own the rendering */
  price?: React.ReactNode;
  /** Controls GameThumb size only. sm = 48px, md = 56px. Title/text sizes are fixed. */
  size?: 'sm' | 'md';
  /** Trailing slot for context-specific actions (remove button, pay button, etc.) */
  action?: React.ReactNode;
  /** Render as plain div instead of Link (for callers that wrap the whole row in a link) */
  disableLink?: boolean;
  /** Reduces opacity for unavailable items */
  disabled?: boolean;
  className?: string;
}

const thumbSize = { sm: 'md', md: 'lg' } as const;

function ListingIdentity({
  listingId,
  image,
  title,
  expansionCount,
  price,
  size = 'sm',
  action,
  disableLink,
  disabled,
  className = '',
}: ListingIdentityProps) {
  const t = useTranslations('listing');

  const content = (
    <>
      <GameThumb src={image} alt={title} size={thumbSize[size]} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-semantic-text-heading truncate group-hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
          {title}
        </p>
        {expansionCount != null && expansionCount > 0 && (
          <p className="flex items-center gap-1 text-xs text-semantic-text-muted mt-0.5">
            <PuzzlePiece size={12} className="shrink-0" />
            {t('expansionCount', { count: expansionCount })}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-50' : ''} ${className}`}>
      {disableLink ? (
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {content}
        </div>
      ) : (
        <Link
          href={`/listings/${listingId}`}
          className="flex items-center gap-3 flex-1 min-w-0 group"
        >
          {content}
        </Link>
      )}
      {price && <div className="shrink-0">{price}</div>}
      {action}
    </div>
  );
}

export { ListingIdentity };
export type { ListingIdentityProps };
