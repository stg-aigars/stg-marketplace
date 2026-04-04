import { createClient } from '@/lib/supabase/server';
import { ListingCard } from '@/components/listings/ListingCard';
import { getUserFavoriteIds } from '@/lib/favorites/actions';
import { getListingCardCounts } from '@/lib/listings/queries';

const LISTING_SELECT =
  'id, game_name, game_year, condition, price_cents, photos, country, bgg_game_id, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)' as const;

interface RelatedListingRow {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: string;
  price_cents: number;
  photos: string[];
  country: string;
  bgg_game_id: number;
  listing_type: string;
  bid_count: number;
  auction_end_at: string | null;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean } | null;
}

interface RelatedListingsProps {
  listingId: string;
  bggGameId: number;
  sellerId: string;
}

export async function RelatedListings({ listingId, bggGameId, sellerId }: RelatedListingsProps) {
  const supabase = await createClient();

  const [{ data: copies }, { data: sellerListings }, favoriteIds, { data: { user } }] =
    await Promise.all([
      supabase
        .from('listings')
        .select(LISTING_SELECT)
        .eq('status', 'active')
        .eq('bgg_game_id', bggGameId)
        .neq('id', listingId)
        .neq('seller_id', sellerId)
        .order('price_cents', { ascending: true })
        .limit(6)
        .returns<RelatedListingRow[]>(),
      supabase
        .from('listings')
        .select(LISTING_SELECT)
        .eq('status', 'active')
        .eq('seller_id', sellerId)
        .neq('id', listingId)
        .order('created_at', { ascending: false })
        .limit(6)
        .returns<RelatedListingRow[]>(),
      getUserFavoriteIds(),
      supabase.auth.getUser(),
    ]);

  const copiesList = copies ?? [];
  const sellerList = sellerListings ?? [];

  if (copiesList.length === 0 && sellerList.length === 0) return null;

  const allIds = [...new Set([...copiesList, ...sellerList].map((l) => l.id))];
  const { expansionCounts, commentCounts } = await getListingCardCounts(supabase, allIds);
  const isAuthenticated = !!user;

  return (
    <div className="mt-10 space-y-10">
      {copiesList.length > 0 && (
        <ListingSection
          heading="More copies of this game"
          listings={copiesList}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          expansionCounts={expansionCounts}
          commentCounts={commentCounts}
        />
      )}
      {sellerList.length > 0 && (
        <ListingSection
          heading="More from this seller"
          href={`/sellers/${sellerId}`}
          listings={sellerList}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          expansionCounts={expansionCounts}
          commentCounts={commentCounts}
        />
      )}
    </div>
  );
}

function ListingSection({
  heading,
  href,
  listings,
  favoriteIds,
  isAuthenticated,
  expansionCounts,
  commentCounts,
}: {
  heading: string;
  href?: string;
  listings: RelatedListingRow[];
  favoriteIds: Set<string>;
  isAuthenticated: boolean;
  expansionCounts: Record<string, number>;
  commentCounts: Record<string, number>;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
          {heading}
        </h2>
        {href && (
          <a
            href={href}
            className="text-sm font-medium text-semantic-brand hover:underline"
          >
            View all
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            id={listing.id}
            gameTitle={listing.game_name}
            gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
            firstPhoto={listing.photos?.[0] ?? null}
            photoCount={listing.photos?.length ?? 0}
            priceCents={listing.price_cents}
            sellerCountry={listing.country}
            isFavorited={favoriteIds.has(listing.id)}
            isAuthenticated={isAuthenticated}
            expansionCount={expansionCounts[listing.id] ?? 0}
            commentCount={commentCounts[listing.id] ?? 0}
            isExpansion={listing.games?.is_expansion ?? false}
            isAuction={listing.listing_type === 'auction'}
            bidCount={listing.bid_count}
            auctionEndAt={listing.auction_end_at}
          />
        ))}
      </div>
    </section>
  );
}
