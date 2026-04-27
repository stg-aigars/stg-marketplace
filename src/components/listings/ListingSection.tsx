import { SectionLink } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import type { ListingType } from '@/lib/listings/types';

/**
 * A listing row shape that maps to ListingCard props.
 * Auction fields are optional for pages that don't query them (e.g., seller profile).
 */
export interface ListingSectionItem {
  id: string;
  game_name: string;
  price_cents: number;
  photos: string[];
  country: string;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean } | null;
  status?: string;
  listing_type?: ListingType;
  bid_count?: number;
  auction_end_at?: string | null;
}

interface ListingSectionProps {
  heading: string;
  href?: string;
  linkText?: string;
  listings: ListingSectionItem[];
  /** Server Component only — Set doesn't survive JSON serialization */
  favoriteIds?: Set<string>;
  isAuthenticated?: boolean;
  expansionCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
  emptyState?: React.ReactNode;
  className?: string;
}

export function ListingSection({
  heading,
  href,
  linkText = 'View all',
  listings,
  favoriteIds,
  isAuthenticated,
  expansionCounts,
  commentCounts,
  emptyState,
  className,
}: ListingSectionProps) {
  if (listings.length === 0 && !emptyState) return null;

  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
          {heading}
        </h2>
        {href && <SectionLink href={href}>{linkText}</SectionLink>}
      </div>
      {listings.length === 0 ? (
        emptyState
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              id={listing.id}
              gameTitle={listing.game_name}
              gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
              firstPhoto={listing.photos?.[0] ?? null}
              photoCount={listing.photos?.length ?? 0}
              priceCents={listing.price_cents}
              sellerCountry={listing.country}
              isFavorited={favoriteIds?.has(listing.id)}
              isAuthenticated={isAuthenticated}
              expansionCount={expansionCounts?.[listing.id] ?? 0}
              commentCount={commentCounts?.[listing.id] ?? 0}
              status={listing.status}
              isExpansion={listing.games?.is_expansion ?? false}
              isAuction={listing.listing_type === 'auction'}
              bidCount={listing.bid_count}
              auctionEndAt={listing.auction_end_at}
            />
          ))}
        </div>
      )}
    </section>
  );
}
