import Link from 'next/link';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { isBggImage, toBggFullSize } from '@/lib/bgg/utils';
import { Card, Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';

interface WantedListingCardProps {
  id: string;
  gameTitle: string;
  gameYear: number | null;
  gameThumbnail: string | null;
  minCondition: ListingCondition;
  maxPriceCents: number | null;
  buyerCountry: string;
  notes: string | null;
}

export function WantedListingCard({
  id,
  gameTitle,
  gameYear,
  gameThumbnail,
  minCondition,
  maxPriceCents,
  buyerCountry,
  notes,
}: WantedListingCardProps) {
  return (
    <Link href={`/wanted/${id}`}>
      <Card hoverable className="h-full flex flex-col">
        {/* Image area */}
        <div className="relative aspect-square bg-semantic-bg-surface flex items-center justify-center overflow-hidden rounded-t-lg">
          {gameThumbnail ? (
            <Image
              src={toBggFullSize(gameThumbnail) ?? gameThumbnail}
              alt={gameTitle}
              fill
              className="object-contain p-2"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={isBggImage(gameThumbnail)}
            />
          ) : (
            <ImageSquare size={48} className="text-semantic-text-muted" />
          )}
        </div>

        {/* Content */}
        <div className="px-3 py-2.5 flex flex-col flex-1">
          <p className="text-sm font-medium text-semantic-text-heading line-clamp-2 leading-tight">
            {gameTitle}
          </p>
          {gameYear && (
            <p className="text-xs text-semantic-text-muted mt-0.5">
              ({gameYear})
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-1">
            <Badge condition={conditionToBadgeKey[minCondition]} />
            <span className="text-[10px] text-semantic-text-muted self-center">or better</span>
          </div>

          <div className="mt-auto pt-2 flex items-center justify-between">
            {maxPriceCents ? (
              <p className="text-sm font-semibold text-semantic-text-heading">
                Up to {formatCentsToCurrency(maxPriceCents)}
              </p>
            ) : (
              <p className="text-xs text-semantic-text-muted">Any price</p>
            )}
            <span
              className={`${getCountryFlag(buyerCountry)} text-xs`}
              title={getCountryName(buyerCountry)}
            />
          </div>

          {notes && (
            <p className="text-xs text-semantic-text-muted mt-1.5 line-clamp-2">
              {notes}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
