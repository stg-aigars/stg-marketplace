import { SectionLink } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import type { ListingType } from '@/lib/listings/types';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { isPriceDropActive } from '@/lib/listings/price-drop';

/**
 * A listing row shape that maps to ListingCard props.
 * `bid_count` / `auction_end_at` are optional for pages that don't query them
 * (e.g., seller profile, which doesn't show countdowns).
 */
export interface ListingSectionItem {
  id: string;
  game_name: string;
  price_cents: number;
  previous_price_cents: number | null;
  price_changed_at: string | null;
  photos: string[];
  country: string;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean } | null;
  status?: string;
  listing_type: ListingType;
  bid_count?: number;
  auction_end_at?: string | null;
}

interface ListingSectionProps {
  heading: string;
  /** Optional small label above the heading (uppercase, muted). Matches other landing sections. */
  eyebrow?: string;
  /** Optional muted line below the heading (sentence case). Use for value-prop or context copy. */
  description?: string;
  href?: string;
  linkText?: string;
  listings: ListingSectionItem[];
  /** Server Component only — Set doesn't survive JSON serialization */
  favoriteIds?: Set<string>;
  isAuthenticated?: boolean;
  expansionCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
  upgradeCounts?: Record<string, number>;
  emptyState?: React.ReactNode;
  className?: string;
}

export function ListingSection({
  heading,
  eyebrow,
  description,
  href,
  linkText = 'View all',
  listings,
  favoriteIds,
  isAuthenticated,
  expansionCounts,
  commentCounts,
  upgradeCounts,
  emptyState,
  className,
}: ListingSectionProps) {
  if (listings.length === 0 && !emptyState) return null;

  return (
    <section className={className}>
      <div className="mb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-2">
                {eyebrow}
              </p>
            )}
            <h2 className={SECTION_HEADING_CLASS}>
              {heading}
            </h2>
          </div>
          {href && (
            <div className="shrink-0">
              <SectionLink href={href}>{linkText}</SectionLink>
            </div>
          )}
        </div>
        {description && (
          <p className="text-sm text-semantic-text-secondary mt-1">
            {description}
          </p>
        )}
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
              previousPriceCents={isPriceDropActive(listing) ? listing.previous_price_cents! : undefined}
              isFavorited={favoriteIds?.has(listing.id)}
              isAuthenticated={isAuthenticated}
              expansionCount={expansionCounts?.[listing.id] ?? 0}
              commentCount={commentCounts?.[listing.id] ?? 0}
              upgradeCount={upgradeCounts?.[listing.id] ?? 0}
              status={listing.status}
              isExpansion={listing.games?.is_expansion ?? false}
              isAuction={listing.listing_type === 'auction'}
              bidCount={listing.bid_count}
              auctionEndAt={listing.auction_end_at}
              isDeclining={listing.listing_type === 'declining'}
            />
          ))}
        </div>
      )}
    </section>
  );
}
