// Mirrors ListingCard.tsx — keep visual parity. Same body, no <Link>, no FavoriteButton,
// no live AuctionCountdown. Used by the sell-flow Review step to render "this is what
// buyers will see on browse" before a listing exists in the DB.

import Image from 'next/image';
import { Camera, ImageSquare, Gavel, PuzzlePiece } from '@phosphor-icons/react/ssr';
import { isBggImage, toBggFullSize } from '@/lib/bgg/utils';
import { Card } from '@/components/ui';
import { GameTitle, Price } from './atoms';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { formatExpansionCount } from '@/lib/listings/types';

interface ListingPreviewCardProps {
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  priceCents: number;
  sellerCountry: string;
  photoCount?: number;
  expansionCount?: number;
  isExpansion?: boolean;
  isAuction?: boolean;
  bidCount?: number;
}

function ListingPreviewCard({
  gameTitle,
  gameThumbnail,
  firstPhoto,
  photoCount,
  priceCents,
  sellerCountry,
  expansionCount = 0,
  isExpansion = false,
  isAuction = false,
  bidCount = 0,
}: ListingPreviewCardProps) {
  const imageUrl = toBggFullSize(gameThumbnail) ?? firstPhoto ?? null;
  const flagClass = getCountryFlag(sellerCountry);
  const countryName = getCountryName(sellerCountry);
  const hasPhotos = photoCount !== undefined && photoCount > 0;

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="aspect-square bg-semantic-bg-secondary flex items-center justify-center overflow-hidden relative">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={gameTitle}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized={isBggImage(imageUrl)}
          />
        ) : (
          <ImageSquare size={48} className="text-semantic-text-muted" />
        )}
        {isAuction && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 bg-polar-night/70 backdrop-blur-sm text-snow-white px-1.5 py-0.5 rounded text-xs font-medium">
            <Gavel size={11} />
            Auction
          </span>
        )}
        {hasPhotos && (
          <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
            <span className="flex items-center gap-1 bg-polar-night/70 text-snow-white px-1.5 py-0.5 rounded text-xs font-medium">
              <Camera size={12} />
              {photoCount}
            </span>
          </div>
        )}
      </div>

      <div className="px-3 py-3 flex flex-col flex-1 gap-2">
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
                <span>{formatExpansionCount(expansionCount)}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
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
  );
}

export { ListingPreviewCard };
export type { ListingPreviewCardProps };
