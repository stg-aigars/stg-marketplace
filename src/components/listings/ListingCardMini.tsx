import Link from 'next/link';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { isBggImage } from '@/lib/bgg/utils';
import { Card, Badge } from '@/components/ui';
import { GameTitle, Price } from './atoms';
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
              unoptimized={isBggImage(imageUrl)}
            />
          ) : (
            <ImageSquare size={32} className="text-semantic-text-muted" />
          )}
        </div>

        {/* Compact details */}
        <div className="p-2 space-y-1">
          <GameTitle name={gameTitle} size="xs" serif clamp={2} />
          <Badge condition={badgeKey} className="text-[10px] px-1.5 py-0">{conditionLabel}</Badge>
          <Price cents={priceCents} size="sm" />
        </div>
      </Card>
    </Link>
  );
}

export { ListingCardMini };
export type { ListingCardMiniProps };
