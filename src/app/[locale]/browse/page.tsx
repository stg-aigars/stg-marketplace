import type { Metadata } from 'next';
import { MagnifyingGlass, Cube } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, Pagination } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { BrowseFilters } from '@/components/listings/BrowseFilters';
import { BrowseContextWriter } from './BrowseContextWriter';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import type { ListingCondition, ListingType } from '@/lib/listings/types';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  hasActiveFilters,
  WEIGHT_LEVEL_RANGES,
} from '@/lib/listings/filters';
import { getUserWithFavorites } from '@/lib/favorites/actions';
import { getListingCardCounts } from '@/lib/listings/queries';

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
  status: string;
  listing_type: ListingType;
  bid_count: number;
  auction_end_at: string | null;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean };
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

  // When game-level filters are active (player count, weight),
  // pre-fetch matching game IDs in a single query so the main listings query returns
  // correct counts and pagination works properly.
  const hasGameFilters =
    filters.playerCounts.length > 0 ||
    filters.weightLevels.length > 0;

  let gameFilterIds: number[] | null = null;
  const hasExpansionFilter = filters.expansionsOnly;
  if (hasGameFilters || hasExpansionFilter) {
    let gamesQuery = supabase.from('games').select('id');
    if (hasExpansionFilter) {
      gamesQuery = gamesQuery.eq('is_expansion', true);
    }

    if (filters.playerCounts.length > 0) {
      const playerClauses = filters.playerCounts.map((n) =>
        n === 6
          ? 'max_players.gte.6'
          : `and(min_players.lte.${n},max_players.gte.${n})`
      );
      gamesQuery = gamesQuery.or(playerClauses.join(','));
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
      'id, game_name, game_year, condition, price_cents, photos, country, bgg_game_id, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)',
      { count: 'exact' }
    )
    .in('status', ['active', 'reserved']);

  // Apply listing-level filters
  if (filters.search) {
    query = query.ilike('game_name', `%${filters.search}%`);
  }
  if (filters.languages.length > 0) {
    const langClauses = filters.languages.map((lang) => `language.ilike.%${lang}%`);
    query = query.or(langClauses.join(','));
  }
  if (filters.countries.length > 0) {
    query = query.in('country', filters.countries);
  }
  if (filters.showAuctions) {
    query = query.eq('listing_type', 'auction');
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

  const [{ data: listings, count }, { user, favoriteIds }, { data: langRows }] = await Promise.all([
    query.returns<ListingRow[]>(),
    getUserWithFavorites(),
    supabase.from('listings').select('language').in('status', ['active', 'reserved']).not('language', 'is', null),
  ]);
  // Extract individual languages from comma-separated values (e.g., "English, German" → ["English", "German"])
  const langSet = new Set<string>();
  for (const row of langRows ?? []) {
    for (const lang of (row.language as string).split(',')) {
      const trimmed = lang.trim();
      if (trimmed) langSet.add(trimmed);
    }
  }
  const availableLanguages = [...langSet].sort();
  const isAuthenticated = !!user;

  const { expansionCounts, commentCounts } = await getListingCardCounts(
    supabase,
    (listings ?? []).map((l) => l.id)
  );

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

      <BrowseFilters key={filtersToSearchParams(filters)} currentFilters={filters} availableLanguages={availableLanguages} />

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
                gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                photoCount={listing.photos?.length ?? 0}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
                isFavorited={favoriteIds.has(listing.id)}
                isAuthenticated={isAuthenticated}
                expansionCount={expansionCounts[listing.id] ?? 0}
                commentCount={commentCounts[listing.id] ?? 0}
                status={listing.status}
                isExpansion={listing.games?.is_expansion ?? false}
                isAuction={listing.listing_type === 'auction'}
                bidCount={listing.bid_count}
                auctionEndAt={listing.auction_end_at}
              />
            ))}
          </div>

          <BrowseContextWriter
            listingIds={filteredListings.map((l) => l.id)}
            searchParams={filtersToSearchParams(filters)}
          />

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
