import Link from 'next/link';
import { GameThumb } from './atoms/GameThumb';
import { GameTitle } from './atoms/GameTitle';
import { Price } from './atoms/Price';
import { getConditionLabel } from '@/lib/condition-config';
import type { ListingCondition } from '@/lib/listings/types';

interface ListingRowProps {
  listing: {
    id: string;
    game_name: string;
    game_year?: number | null;
    price_cents: number;
    condition: ListingCondition;
    photos?: string[];
    bgg_thumbnail?: string | null;
  };
  className?: string;
}

function ListingRow({ listing, className = '' }: ListingRowProps) {
  const imageUrl = listing.bgg_thumbnail ?? listing.photos?.[0];
  const conditionLabel = getConditionLabel(listing.condition);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`flex items-center gap-3 rounded-lg border border-semantic-border-subtle shadow-sm bg-semantic-bg-elevated p-3 transition-all duration-250 ease-out-custom sm:hover:shadow-md ${className}`}
    >
      <GameThumb src={imageUrl} alt={listing.game_name} size="md" />
      <div className="flex-1 min-w-0">
        <GameTitle name={listing.game_name} size="sm" serif />
        <div className="flex items-center gap-2 mt-1">
          <Price cents={listing.price_cents} size="sm" />
          <span className="text-xs text-semantic-text-muted">{conditionLabel}</span>
        </div>
      </div>
    </Link>
  );
}

export { ListingRow };
export type { ListingRowProps };
