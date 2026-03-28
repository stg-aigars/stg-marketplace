import Link from 'next/link';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { Card, Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';

interface ListingCardMiniProps {
  id: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
}

function ListingCardMini({
  id,
  gameTitle,
  gameThumbnail,
  firstPhoto,
  condition,
  priceCents,
}: ListingCardMiniProps) {
  const imageUrl = firstPhoto || gameThumbnail;
  const badgeKey = conditionToBadgeKey[condition];
  const conditionLabel = conditionConfig[badgeKey].label;

  return (
    <Link href={`/listings/${id}`} className="group block">
      <Card hoverable className="overflow-hidden">
        {/* Square image */}
        <div className="aspect-square bg-semantic-bg-secondary flex items-center justify-center overflow-hidden relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={gameTitle}
              fill
              className="object-cover"
              sizes="50vw"
              unoptimized={imageUrl.includes('cf.geekdo-images.com')}
            />
          ) : (
            <ImageSquare size={32} className="text-semantic-text-muted" />
          )}
        </div>

        {/* Compact details */}
        <div className="p-2 space-y-1">
          <h3 className="font-semibold font-display tracking-tight text-semantic-text-heading text-[11px] leading-tight line-clamp-2">
            {gameTitle}
          </h3>
          <Badge condition={badgeKey} className="text-[10px] px-1.5 py-0">{conditionLabel}</Badge>
          <p className="font-bold font-sans tracking-tight text-semantic-text-heading text-[13px]">
            {formatCentsToCurrency(priceCents)}
          </p>
        </div>
      </Card>
    </Link>
  );
}

export { ListingCardMini };
export type { ListingCardMiniProps };
