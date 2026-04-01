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
  WEIGHT_LEVEL_RANGES,
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
  listing_type: string;
  bid_count: number;
  auction_end_at: string | null;
  version_thumbnail: string | null;
  games: { image: string | null };
}

export default async function BrowsePage(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const filters = parseFiltersFromParams(searchParams);
  const showWelcome = searchParams.welcome === 'true';
  const offset = (filters.page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // When game-level filters are active (player count, categories, mechanics, weight),
  // pre-fetch matching game IDs in a single query so the main listings query returns
  // correct counts and pagination works properly.
  const hasGameFilters =
    filters.playerCount !== null ||
    filters.categories.length > 0 ||
    filters.mechanics.length > 0 ||
    filters.weightLevels.length > 0;

  let gameFilterIds: number[] | null = null;
  if (hasGameFilters) {
    let gamesQuery = supabase.from('games').select('id').eq('is_expansion', false);

    if (filters.playerCount !== null) {
      gamesQuery = gamesQuery
        .lte('min_players', filters.playerCount)
        .gte('max_players', filters.playerCount);
    }
    if (filters.categories.length > 0) {
      gamesQuery = gamesQuery.overlaps('categories', filters.categories);
    }
    if (filters.mechanics.length > 0) {
      gamesQuery = gamesQuery.overlaps('mechanics', filters.mechanics);
    }
    if (filters.weightLevels.length > 0) {
      // Build OR condition for weight ranges
      const weightClauses = filters.weightLevels.map((level) => {
        const range = WEIGHT_LEVEL_RANGES[level];
        return `and(weight.gte.${range.min},weight.lt.${range.max})`;
      });
      gamesQuery = gamesQuery.or(weightClauses.join(','));
    }

    const { data: matchingGames } = await gamesQuery;
    gameFilterIds = matchingGames?.map((g) => g.id) ?? [];
  }

  // Build filtered query
  let query = supabase
    .from('listings')
    .select(
      'id, game_name, game_year, condition, price_cents, photos, country, bgg_game_id, listing_type, bid_count, auction_end_at, version_thumbnail, games(image)',
      { count: 'exact' }
    )
    .eq('status', 'active');

  // Apply listing-level filters
  if (filters.search) {
    query = query.ilike('game_name', `%${filters.search}%`);
  }
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

  // Apply game-level filter (pre-fetched IDs)
  if (gameFilterIds !== null) {
    if (gameFilterIds.length === 0) {
      query = query.in('bgg_game_id', [-1]); // Short-circuit to empty results
    } else {
      query = query.in('bgg_game_id', gameFilterIds);
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

      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-4">
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
                gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                photoCount={listing.photos?.length ?? 0}
                condition={listing.condition}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
                isFavorited={favoriteIds.has(listing.id)}
                isAuthenticated={isAuthenticated}
                isAuction={listing.listing_type === 'auction'}
                bidCount={listing.bid_count}
                auctionEndAt={listing.auction_end_at}
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
