import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import type { ListingCondition } from '@/lib/listings/types';

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: 'Browse',
  description: 'Browse pre-loved board games for sale in Latvia, Lithuania, and Estonia.',
  openGraph: {
    title: 'Browse | Second Turn Games',
    description: 'Browse pre-loved board games for sale in Latvia, Lithuania, and Estonia.',
  },
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

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { page?: string; welcome?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const showWelcome = searchParams.welcome === 'true';
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: listings, count } = await supabase
    .from('listings')
    .select('id, game_name, game_year, condition, price_cents, photos, country, games(thumbnail)', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
    .returns<ListingRow[]>();

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showingFrom = totalCount === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, totalCount);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {showWelcome && <WelcomeBanner />}

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
            No games listed yet
          </p>
          <p className="text-semantic-text-muted mt-1">
            Be the first to share a pre-loved game with the community.
          </p>
          <Link href="/sell" className="inline-block mt-4">
            <Button>List a game</Button>
          </Link>
        </div>
      ) : (
        <>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <p className="text-sm text-semantic-text-secondary">
                Showing {showingFrom}–{showingTo} of {totalCount} listings
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={`/browse?page=${page - 1}`}
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-sm rounded-lg font-medium bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-subtle shadow-sm hover:shadow-md transition-shadow"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-sm rounded-lg font-medium bg-semantic-bg-elevated text-semantic-text-muted border border-semantic-border-subtle opacity-50 cursor-not-allowed">
                    Previous
                  </span>
                )}
                {page < totalPages ? (
                  <Link
                    href={`/browse?page=${page + 1}`}
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-sm rounded-lg font-medium bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-subtle shadow-sm hover:shadow-md transition-shadow"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-sm rounded-lg font-medium bg-semantic-bg-elevated text-semantic-text-muted border border-semantic-border-subtle opacity-50 cursor-not-allowed">
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
