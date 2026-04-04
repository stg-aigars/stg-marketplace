import Link from 'next/link';
import Image from 'next/image';
import { Camera, ImageSquare, Gavel, ChatCircle, PuzzlePiece } from '@phosphor-icons/react/ssr';
import { isBggImage, toBggFullSize } from '@/lib/bgg/utils';
import { Card } from '@/components/ui';
import { AuctionCountdown } from '@/components/auctions/AuctionCountdown';
import { GameTitle, Price } from './atoms';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { FavoriteButton } from './FavoriteButton';

interface ListingCardProps {
  id: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  priceCents: number;
  sellerCountry: string;
  /** Number of photos (shows count badge when > 0) */
  photoCount?: number;
  isFavorited?: boolean;
  isAuthenticated?: boolean;
  /** If true, show "Sold" or "No longer available" overlay */
  unavailable?: boolean;
  /** Expansion count for "+N expansions" badge */
  expansionCount?: number;
  /** Comment count for comment indicator */
  commentCount?: number;
  /** Whether this listing is for an expansion (not a base game) */
  isExpansion?: boolean;
  /** Auction fields */
  isAuction?: boolean;
  bidCount?: number;
  auctionEndAt?: string | null;
}

function ListingCard({
  id,
  gameTitle,
  gameThumbnail,
  firstPhoto,
  photoCount,
  priceCents,
  sellerCountry,
  isFavorited,
  isAuthenticated = false,
  unavailable = false,
  expansionCount = 0,
  commentCount = 0,
  isExpansion = false,
  isAuction = false,
  bidCount = 0,
  auctionEndAt,
}: ListingCardProps) {
  const imageUrl = toBggFullSize(gameThumbnail) ?? firstPhoto ?? null;
  const flagClass = getCountryFlag(sellerCountry);
  const countryName = getCountryName(sellerCountry);
  const hasPhotos = photoCount !== undefined && photoCount > 0;

  return (
    <Link href={`/listings/${id}`} className={`group block ${unavailable ? 'opacity-60' : ''}`}>
      <Card
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
              className="object-contain transition-transform duration-350 ease-out-custom group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={isBggImage(imageUrl)}
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
          {isAuction && auctionEndAt && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 bg-polar-night/70 backdrop-blur-sm text-snow-white px-1.5 py-0.5 rounded text-xs font-medium">
              <Gavel size={11} />
              <AuctionCountdown endAt={auctionEndAt} overlay />
            </span>
          )}
          {!unavailable && (commentCount > 0 || hasPhotos) && (
            <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
              {commentCount > 0 && (
                <span className="flex items-center gap-1 bg-polar-night/70 text-snow-white px-1.5 py-0.5 rounded text-xs font-medium">
                  <ChatCircle size={12} />
                  {commentCount}
                </span>
              )}
              {hasPhotos && (
                <span className="flex items-center gap-1 bg-polar-night/70 text-snow-white px-1.5 py-0.5 rounded text-xs font-medium">
                  <Camera size={12} />
                  {photoCount}
                </span>
              )}
            </div>
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
            <GameTitle name={gameTitle} size="md" serif clamp={2} />
            {(isExpansion || expansionCount > 0) && (
              <div className="flex items-center gap-2 text-xs text-semantic-text-muted mt-0.5">
                {isExpansion && (
                  <span className="inline-flex items-center gap-0.5">
                    <PuzzlePiece size={11} />
                    Expansion
                  </span>
                )}
                {expansionCount > 0 && (
                  <span>+{expansionCount} {expansionCount === 1 ? 'expansion' : 'expansions'}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              {isAuction && bidCount === 0 && (
                <span className="text-xs text-semantic-text-muted mr-1">Starting at</span>
              )}
              <Price cents={priceCents} />
              {isAuction && (
                <span className="text-xs text-semantic-text-muted ml-3">
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

        </div>
      </Card>
    </Link>
  );
}

export { ListingCard };
export type { ListingCardProps };
