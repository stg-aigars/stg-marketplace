import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui';
import { Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';

interface ListingCardProps {
  id: string;
  gameTitle: string;
  gameYear: number | null;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
  sellerCountry: string;
}

function ListingCard({
  id,
  gameTitle,
  gameYear,
  gameThumbnail,
  firstPhoto,
  condition,
  priceCents,
  sellerCountry,
}: ListingCardProps) {
  const imageUrl = firstPhoto || gameThumbnail;
  const badgeKey = conditionToBadgeKey[condition];
  const conditionLabel = conditionConfig[badgeKey].label;
  const flagClass = getCountryFlag(sellerCountry);
  const countryName = getCountryName(sellerCountry);

  return (
    <Link href={`/listings/${id}`} className="block">
      <Card hoverable className="overflow-hidden">
        {/* Image */}
        <div className="h-40 sm:h-44 lg:h-48 bg-snow-storm-light flex items-center justify-center overflow-hidden relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={gameTitle}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={imageUrl.includes('cf.geekdo-images.com')}
            />
          ) : (
            <svg
              className="w-12 h-12 text-semantic-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
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
