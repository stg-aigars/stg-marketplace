import Link from 'next/link';
import Image from 'next/image';
import { Camera, ImageSquare } from '@phosphor-icons/react/ssr';
import { Card, Badge } from '@/components/ui';
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
}: ListingCardProps) {
  const imageUrl = firstPhoto || gameThumbnail;
  const badgeKey = conditionToBadgeKey[condition];
  const conditionLabel = conditionConfig[badgeKey].label;
  const flagClass = getCountryFlag(sellerCountry);
  const countryName = getCountryName(sellerCountry);

  return (
    <Link href={`/listings/${id}`} className={`group block ${unavailable ? 'opacity-60' : ''}`}>
      <Card hoverable={!unavailable} className="overflow-hidden">
        {/* Image */}
        <div className="h-40 sm:h-44 lg:h-48 bg-snow-storm-light flex items-center justify-center overflow-hidden relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={gameTitle}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={imageUrl.includes('cf.geekdo-images.com')}
            />
          ) : (
            <ImageSquare size={48} className="text-semantic-text-muted" />
          )}
          {unavailable && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="text-sm font-medium text-semantic-text-secondary bg-white/90 px-3 py-1 rounded-full">
                No longer available
              </span>
            </div>
          )}
          {photoCount !== undefined && photoCount > 1 && (
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
            <h3 className="font-medium text-semantic-text-heading text-sm leading-tight line-clamp-2">
              {gameTitle}
            </h3>
            {gameYear && (
              <p className="text-xs text-semantic-text-muted mt-0.5">
                {gameYear}
              </p>
            )}
          </div>

          <Badge condition={badgeKey}>{conditionLabel}</Badge>

          <div className="flex items-center justify-between">
            <span className="font-bold text-semantic-text-heading">
              {formatCentsToCurrency(priceCents)}
            </span>
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
