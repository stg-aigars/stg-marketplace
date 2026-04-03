import Link from 'next/link';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { isBggImage, toBggFullSize } from '@/lib/bgg/utils';
import { Card } from '@/components/ui';
import { GameTitle, Price } from './atoms';
import { getConditionLabel } from '@/lib/condition-config';
import type { ListingCondition } from '@/lib/listings/types';

interface ListingCardMiniProps {
  id: string;
  gameTitle: string;
  gameThumbnail: string | null;
  firstPhoto: string | null;
  condition: ListingCondition;
  priceCents: number;
  expansionCount?: number;
}

function ListingCardMini({
  id,
  gameTitle,
  gameThumbnail,
  firstPhoto,
  condition,
  priceCents,
  expansionCount = 0,
}: ListingCardMiniProps) {
  const imageUrl = toBggFullSize(gameThumbnail) ?? firstPhoto ?? null;
  const conditionLabel = getConditionLabel(condition);

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
              className="object-contain"
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
          {expansionCount > 0 && (
            <p className="text-[10px] text-semantic-text-muted leading-tight">
              +{expansionCount} {expansionCount === 1 ? 'expansion' : 'expansions'}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <Price cents={priceCents} size="sm" />
            <span className="text-xs text-semantic-text-muted">{conditionLabel}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export { ListingCardMini };
export type { ListingCardMiniProps };
