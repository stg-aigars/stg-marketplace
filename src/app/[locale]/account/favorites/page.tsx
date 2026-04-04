import type { Metadata } from 'next';
import { Heart } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/helpers';
import { EmptyState } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { getListingCardCounts } from '@/lib/listings/queries';
import type { ListingCondition } from '@/lib/listings/types';

export const metadata: Metadata = {
  title: 'My Favorites',
  description: 'Your saved board game listings.',
};

interface FavoriteRow {
  listing_id: string;
  listings: {
    id: string;
    game_name: string;
    game_year: number | null;
    condition: ListingCondition;
    price_cents: number;
    photos: string[];
    country: string;
    status: string;
    version_thumbnail: string | null;
    games: { image: string | null; is_expansion: boolean };
  } | null;
}

export default async function FavoritesPage() {
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const { data: favorites } = await supabase
    .from('favorites')
    .select(
      'listing_id, listings(id, game_name, game_year, condition, price_cents, photos, country, status, version_thumbnail, games(image, is_expansion))'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<FavoriteRow[]>();

  const items = favorites ?? [];

  const { expansionCounts, commentCounts } = await getListingCardCounts(
    supabase,
    items.map((f) => f.listing_id)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        My Favorites
      </h1>

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favorites yet"
          description="Tap the heart on any listing to save it here."
          action={{ label: 'Browse games', href: '/browse', variant: 'primary' }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((fav) => {
            const listing = fav.listings;
            if (!listing) {
              // Listing was deleted
              return (
                <div
                  key={fav.listing_id}
                  className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-subtle p-4 flex items-center justify-center aspect-square opacity-60"
                >
                  <p className="text-sm text-semantic-text-muted text-center">
                    No longer available
                  </p>
                </div>
              );
            }

            const isUnavailable = listing.status !== 'active';

            return (
              <ListingCard
                key={listing.id}
                id={listing.id}
                gameTitle={listing.game_name}
                gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                photoCount={listing.photos?.length ?? 0}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
                isFavorited={true}
                isAuthenticated={true}
                unavailable={isUnavailable}
                expansionCount={expansionCounts[listing.id] ?? 0}
                commentCount={commentCounts[listing.id] ?? 0}
                isExpansion={listing.games?.is_expansion ?? false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
