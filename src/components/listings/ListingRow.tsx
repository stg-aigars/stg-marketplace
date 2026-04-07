import Link from 'next/link';
import { ListingIdentity, Price } from './atoms';
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
      className={`block rounded-lg border border-semantic-border-subtle shadow-sm bg-semantic-bg-elevated p-3 transition-all duration-250 ease-out-custom sm:hover:shadow-md ${className}`}
    >
      <ListingIdentity
        listingId={listing.id}
        image={imageUrl ?? null}
        title={listing.game_name}
        disableLink
        price={
          <div className="flex items-center gap-2">
            <Price cents={listing.price_cents} size="sm" />
            <span className="text-xs text-semantic-text-muted">{conditionLabel}</span>
          </div>
        }
      />
    </Link>
  );
}

export { ListingRow };
export type { ListingRowProps };
