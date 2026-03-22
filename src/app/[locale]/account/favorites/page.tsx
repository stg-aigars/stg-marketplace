import type { Metadata } from 'next';
import Link from 'next/link';
import { Heart } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Button } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
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
    games: { thumbnail: string | null };
  } | null;
}

export default async function FavoritesPage() {
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const { data: favorites } = await supabase
    .from('favorites')
    .select(
      'listing_id, listings(id, game_name, game_year, condition, price_cents, photos, country, status, games(thumbnail))'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<FavoriteRow[]>();

  const items = favorites ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        My Favorites
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={64} className="mx-auto text-semantic-text-muted mb-4" />
          <p className="text-semantic-text-secondary text-lg">
            No favorites yet
          </p>
          <p className="text-semantic-text-muted mt-1">
            Tap the heart on any listing to save it here.
          </p>
          <Link href="/browse" className="inline-block mt-4">
            <Button>Browse games</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((fav) => {
            const listing = fav.listings;
            if (!listing) {
              // Listing was deleted
              return (
                <div
                  key={fav.listing_id}
                  className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-subtle p-4 flex items-center justify-center h-40 sm:h-44 lg:h-48 opacity-60"
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
                gameYear={listing.game_year}
                gameThumbnail={listing.games?.thumbnail ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                condition={listing.condition}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
                isFavorited={true}
                isAuthenticated={true}
                unavailable={isUnavailable}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
