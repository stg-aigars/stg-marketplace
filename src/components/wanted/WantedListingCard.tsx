import Link from 'next/link';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { isBggImage, toBggFullSize } from '@/lib/bgg/utils';
import { Card } from '@/components/ui';
import { GameTitle, GameMeta } from '@/components/listings/atoms';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';

interface WantedListingCardProps {
  id: string;
  gameTitle: string;
  gameYear: number | null;
  gameThumbnail: string | null;
  language: string | null;
  publisher: string | null;
  buyerCountry: string;
  notes: string | null;
}

export function WantedListingCard({
  id,
  gameTitle,
  gameYear,
  gameThumbnail,
  language,
  publisher,
  buyerCountry,
  notes,
}: WantedListingCardProps) {
  const hasEdition = language || publisher;

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
          <GameTitle name={gameTitle} clamp={2} />
          <GameMeta year={gameYear} className="mt-0.5" />

          {hasEdition && (
            <p className="text-xs text-semantic-text-muted mt-1 truncate">
              {[language, publisher].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="mt-auto pt-2 flex items-center justify-between">
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
