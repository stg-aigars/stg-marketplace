import Link from 'next/link';
import { GameThumb, GameTitle, Price } from '@/components/listings/atoms';

interface ListingChipInlineProps {
  listing: {
    id: string;
    game_name: string;
    price_cents: number;
    primary_photo_url: string | null;
  } | null;
}

export function ListingChipInline({ listing }: ListingChipInlineProps) {
  if (!listing) {
    return (
      <div className="rounded-md border border-dashed border-semantic-border-default px-3 py-2 text-xs text-semantic-text-muted">
        [removed listing]
      </div>
    );
  }
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex items-center gap-2 rounded-md border border-semantic-border-default bg-semantic-bg-elevated px-2 py-1.5 sm:hover:border-semantic-brand transition-colors duration-250 ease-out-custom"
    >
      <GameThumb src={listing.primary_photo_url} alt={listing.game_name} size="sm" />
      <div className="flex-1 min-w-0">
        <GameTitle name={listing.game_name} size="xs" />
      </div>
      <Price cents={listing.price_cents} size="sm" />
    </Link>
  );
}
