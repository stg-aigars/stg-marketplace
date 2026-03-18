import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { BrowseFilters } from '@/components/listings/BrowseFilters';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import type { ListingCondition } from '@/lib/listings/types';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  hasActiveFilters,
} from '@/lib/listings/filters';

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
  bgg_game_id: number;
  games: { thumbnail: string | null; min_players: number | null; max_players: number | null };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFiltersFromParams(searchParams);
  const showWelcome = searchParams.welcome === 'true';
  const offset = (filters.page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Build filtered query
  let query = supabase
    .from('listings')
    .select(
      'id, game_name, game_year, condition, price_cents, photos, country, bgg_game_id, games(thumbnail, min_players, max_players)',
      { count: 'exact' }
    )
    .eq('status', 'active');

  // Apply filters
  if (filters.conditions.length > 0) {
    query = query.in('condition', filters.conditions);
  }
  if (filters.priceMinCents !== null) {
    query = query.gte('price_cents', filters.priceMinCents);
  }
  if (filters.priceMaxCents !== null) {
    query = query.lte('price_cents', filters.priceMaxCents);
  }
  if (filters.countries.length > 0) {
    query = query.in('country', filters.countries);
  }

  // Sort
  if (filters.sort === 'price_asc') {
    query = query.order('price_cents', { ascending: true });
  } else if (filters.sort === 'price_desc') {
    query = query.order('price_cents', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Paginate
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: listings, count } = await query.returns<ListingRow[]>();

  // Filter by player count client-side (Supabase doesn't support filtering on joined columns directly)
  // We fetch all and filter, but since we're paginating this is already bounded
  let filteredListings = listings ?? [];
  if (filters.playerCount !== null) {
    const pc = filters.playerCount;
    filteredListings = filteredListings.filter((l) => {
      const min = l.games?.min_players;
      const max = l.games?.max_players;
      if (min === null || max === null) return false;
      return min <= pc && max >= pc;
    });
  }

  const totalCount = filters.playerCount !== null
    ? filteredListings.length // Approximate when player filtering is active
    : (count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showingFrom = totalCount === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, totalCount);
  const filtersActive = hasActiveFilters(filters);

  // Build pagination URL helper
  const paginationUrl = (page: number) =>
    `/browse${filtersToSearchParams({ ...filters, page })}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {showWelcome && <WelcomeBanner />}

      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-4">
        Browse pre-loved games
      </h1>

      <BrowseFilters currentFilters={filters} />

      {filteredListings.length === 0 ? (
        <div className="text-center py-16">
          {filtersActive ? (
            <>
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
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <p className="text-semantic-text-secondary text-lg">
                No games match your filters
              </p>
              <p className="text-semantic-text-muted mt-1">
                Try adjusting your filters or clearing them to see all listings.
              </p>
              <Link href="/browse" className="inline-block mt-4">
                <Button variant="secondary">Clear filters</Button>
              </Link>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredListings.map((listing) => (
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
                {filters.page > 1 ? (
                  <Link
                    href={paginationUrl(filters.page - 1)}
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-sm rounded-lg font-medium bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-subtle shadow-sm hover:shadow-md transition-shadow"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-sm rounded-lg font-medium bg-semantic-bg-elevated text-semantic-text-muted border border-semantic-border-subtle opacity-50 cursor-not-allowed">
                    Previous
                  </span>
                )}
                {filters.page < totalPages ? (
                  <Link
                    href={paginationUrl(filters.page + 1)}
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
