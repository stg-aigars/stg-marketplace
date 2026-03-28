import Link from 'next/link';
import Image from 'next/image';
import { Camera, ImageSquare, Gavel } from '@phosphor-icons/react/ssr';
import { Card, Badge } from '@/components/ui';
import { AuctionCountdown } from '@/components/auctions/AuctionCountdown';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { FavoriteButton } from './FavoriteButton';

interface ListingCardProps {
  id: string;
  gameTitle: string;
  gameYear: number | null;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
  sellerCountry: string;
  /** Number of photos (shows count badge when > 1) */
  photoCount?: number;
  isFavorited?: boolean;
  isAuthenticated?: boolean;
  /** If true, show "Sold" or "No longer available" overlay */
  unavailable?: boolean;
  /** Auction fields */
  isAuction?: boolean;
  bidCount?: number;
  auctionEndAt?: string | null;
}

function ListingCard({
  id,
  gameTitle,
  gameYear,
  gameThumbnail,
  firstPhoto,
  photoCount,
  condition,
  priceCents,
  sellerCountry,
  isFavorited,
  isAuthenticated = false,
  unavailable = false,
  isAuction = false,
  bidCount = 0,
  auctionEndAt,
}: ListingCardProps) {
  const imageUrl = firstPhoto || gameThumbnail;
  const badgeKey = conditionToBadgeKey[condition];
  const conditionLabel = conditionConfig[badgeKey].label;
  const flagClass = getCountryFlag(sellerCountry);
  const countryName = getCountryName(sellerCountry);

  return (
    <Link href={`/listings/${id}`} className={`group block ${unavailable ? 'opacity-60' : ''}`}>
      <Card
        hoverable={!unavailable}
        className={`overflow-hidden border border-semantic-border-subtle transition-all duration-350 ease-out-custom ${
          !unavailable ? 'sm:hover:border-semantic-brand sm:hover:shadow-lg sm:hover:-translate-y-0.5' : ''
        }`}
      >
        {/* Image — square aspect ratio */}
        <div className="aspect-square bg-semantic-bg-secondary flex items-center justify-center overflow-hidden relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={gameTitle}
              fill
              className="object-cover transition-transform duration-350 ease-out-custom group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={imageUrl.includes('cf.geekdo-images.com')}
            />
          ) : (
            <ImageSquare size={48} className="text-semantic-text-muted" />
          )}
          {unavailable && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="text-sm font-medium text-semantic-text-secondary bg-white/90 px-3 py-1 rounded-md">
                No longer available
              </span>
            </div>
          )}
          {!unavailable && photoCount !== undefined && photoCount > 1 && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-polar-night/70 text-snow-white px-1.5 py-0.5 rounded text-xs font-medium">
              <Camera size={12} />
              {photoCount}
            </span>
          )}
          {isFavorited !== undefined && (
            <FavoriteButton
              listingId={id}
              initialFavorited={isFavorited}
              isAuthenticated={isAuthenticated}
              overlay
            />
          )}
        </div>

        {/* Details */}
        <div className="px-3 py-3 space-y-2">
          <div>
            <h3 className="font-semibold font-display tracking-tight text-semantic-text-heading text-sm leading-tight line-clamp-2">
              {gameTitle}
            </h3>
            {gameYear && (
              <p className="text-xs text-semantic-text-muted mt-0.5">
                {gameYear}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Badge condition={badgeKey}>{conditionLabel}</Badge>
            {isAuction && (
              <Badge variant="default">
                <Gavel size={10} className="mr-0.5" />
                Auction
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              {isAuction && bidCount === 0 && (
                <span className="text-xs text-semantic-text-muted mr-1">Starting at</span>
              )}
              <span className="font-bold font-sans tracking-tight text-semantic-text-heading">
                {formatCentsToCurrency(priceCents)}
              </span>
              {isAuction && (
                <span className="text-xs text-semantic-text-muted ml-1">
                  {bidCount > 0 ? `(${bidCount} ${bidCount === 1 ? 'bid' : 'bids'})` : '(no bids)'}
                </span>
              )}
            </div>
            {flagClass && (
              <span
                className={`${flagClass} text-base`}
                title={countryName}
                aria-label={countryName}
              />
            )}
          </div>

          {isAuction && auctionEndAt && (
            <AuctionCountdown endAt={auctionEndAt} className="text-xs" />
          )}
        </div>
      </Card>
    </Link>
  );
}

export { ListingCard };
export type { ListingCardProps };
