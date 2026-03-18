import type { Metadata } from 'next';
import Link from 'next/link';
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
          <svg
            className="w-16 h-16 mx-auto text-semantic-text-muted mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
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
