import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { ListingSection } from '@/components/listings/ListingSection';
import { getListingCardCounts } from '@/lib/listings/queries';
import type { ListingSectionItem } from '@/components/listings/ListingSection';

const LISTING_SELECT =
  'id, game_name, price_cents, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)' as const;

interface RelatedListingsProps {
  listingId: string;
  bggGameId: number;
  sellerId: string;
  gameName: string;
  sellerName: string | null;
  isOwner: boolean;
  isAuthenticated: boolean;
  /** Server Component only — Set doesn't survive JSON serialization */
  favoriteIds: Set<string>;
}

export async function RelatedListings({ listingId, bggGameId, sellerId, gameName, sellerName, isOwner, isAuthenticated, favoriteIds }: RelatedListingsProps) {
  const supabase = await createClient();

  const [{ data: copies }, { data: sellerListings }] =
    await Promise.all([
      supabase
        .from('listings')
        .select(LISTING_SELECT)
        .in('status', ['active', 'reserved'])
        .eq('bgg_game_id', bggGameId)
        .neq('id', listingId)
        .neq('seller_id', sellerId)
        .order('price_cents', { ascending: true })
        .limit(4)
        .returns<ListingSectionItem[]>(),
      supabase
        .from('listings')
        .select(LISTING_SELECT)
        .in('status', ['active', 'reserved'])
        .eq('seller_id', sellerId)
        .neq('id', listingId)
        .order('created_at', { ascending: false })
        .limit(4)
        .returns<ListingSectionItem[]>(),
    ]);

  const copiesList = copies ?? [];
  const sellerList = sellerListings ?? [];

  if (copiesList.length === 0 && sellerList.length === 0 && isOwner) return null;

  const allIds = [...copiesList, ...sellerList].map((l) => l.id);
  const { expansionCounts, commentCounts } = await getListingCardCounts(supabase, allIds);

  const hasSections = copiesList.length > 0 || sellerList.length > 0;

  return (
    <div className="mt-10 space-y-10">
      {copiesList.length > 0 && (
        <ListingSection
          heading={`More copies of ${gameName}`}
          listings={copiesList}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          expansionCounts={expansionCounts}
          commentCounts={commentCounts}
        />
      )}
      {sellerList.length > 0 && (
        <ListingSection
          heading={sellerName ? `More from ${sellerName}` : 'More from this seller'}
          href={`/sellers/${sellerId}`}
          listings={sellerList}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          expansionCounts={expansionCounts}
          commentCounts={commentCounts}
        />
      )}
      {!isOwner && (
        <div className={`flex items-center justify-center ${hasSections ? 'pt-2' : ''} pb-2`}>
          <Link
            href="/sell"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-semantic-brand hover:underline transition-colors duration-250 ease-out-custom"
          >
            Have this game? List it now
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      )}
    </div>
  );
}
