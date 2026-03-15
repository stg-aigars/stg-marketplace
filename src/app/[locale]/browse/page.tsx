import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ListingCard } from '@/components/listings/ListingCard';
import type { ListingCondition } from '@/lib/listings/types';

export const metadata: Metadata = {
  title: 'Browse',
};

interface ListingRow {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  photos: string[];
  country: string;
  games: { thumbnail: string | null };
}

export default async function BrowsePage() {
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from('listings')
    .select('id, game_name, game_year, condition, price_cents, photos, country, games(thumbnail)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .returns<ListingRow[]>();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Browse pre-loved games
      </h1>

      {!listings || listings.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-semantic-text-muted mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="text-semantic-text-secondary text-lg">
            No listings yet
          </p>
          <p className="text-semantic-text-muted mt-1">
            Be the first to list a game.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((listing) => (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
