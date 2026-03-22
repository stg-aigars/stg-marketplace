import type { Metadata } from 'next';
import { MagnifyingGlass, Cube } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, Pagination } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { BrowseFilters } from '@/components/listings/BrowseFilters';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import type { ListingCondition } from '@/lib/listings/types';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  hasActiveFilters,
} from '@/lib/listings/filters';
import { getUserFavoriteIds } from '@/lib/favorites/actions';

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
  games: { thumbnail: string | null };
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

  // When player count filter is active, pre-fetch matching game IDs server-side
  // so the main query returns correct counts and pagination works properly.
  let playerCountGameIds: number[] | null = null;
  if (filters.playerCount !== null) {
    const pc = filters.playerCount;
    const { data: matchingGames } = await supabase
      .from('games')
      .select('id')
      .lte('min_players', pc)
      .gte('max_players', pc);
    playerCountGameIds = matchingGames?.map((g) => g.id) ?? [];
  }

  // Build filtered query
  let query = supabase
    .from('listings')
    .select(
      'id, game_name, game_year, condition, price_cents, photos, country, bgg_game_id, games(thumbnail)',
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
  if (playerCountGameIds !== null) {
    if (playerCountGameIds.length === 0) {
      // No games match this player count — short-circuit to empty results
      query = query.in('bgg_game_id', [-1]);
    } else {
      query = query.in('bgg_game_id', playerCountGameIds);
    }
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

  const [{ data: listings, count }, favoriteIds, { data: { user } }] = await Promise.all([
    query.returns<ListingRow[]>(),
    getUserFavoriteIds(),
    supabase.auth.getUser(),
  ]);
  const isAuthenticated = !!user;

  const filteredListings = listings ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
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

      <BrowseFilters key={filtersToSearchParams(filters)} currentFilters={filters} />

      {filteredListings.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={MagnifyingGlass}
            title="No games match your filters"
            description="Try adjusting your filters or clearing them to see all listings."
            action={{ label: 'Clear filters', href: '/browse', variant: 'secondary' }}
          />
        ) : (
          <EmptyState
            icon={Cube}
            title="No games listed yet"
            description="Be the first to share a pre-loved game with the community."
            action={{ label: 'List a game', href: '/sell', variant: 'primary' }}
          />
        )
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
                isFavorited={favoriteIds.has(listing.id)}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>

          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            buildUrl={paginationUrl}
          />
        </>
      )}
    </div>
  );
}
