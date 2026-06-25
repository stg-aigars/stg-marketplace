import type { Metadata } from 'next';
import { MagnifyingGlass, Cube } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, Pagination, NavTabs } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { BrowseFilters } from '@/components/listings/BrowseFilters';
import { BrowseContextWriter } from './BrowseContextWriter';
import { BrowseSearchAnalytics } from '@/components/analytics/BrowseSearchAnalytics';
import type { ListingCondition, ListingType } from '@/lib/listings/types';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  hasActiveFilters,
  WEIGHT_LEVEL_RANGES,
} from '@/lib/listings/filters';
import { getUserWithFavorites } from '@/lib/favorites/actions';
import { getListingCardCounts } from '@/lib/listings/queries';
import { isPriceDropActive, PRICE_DROP_WINDOW_DAYS } from '@/lib/listings/price-drop';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 24;

export async function generateMetadata(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : '';
  const title = q ? `Search: ${q}` : 'Browse';
  const description = q
    ? `Results for "${q}" — pre-loved board games in Latvia, Lithuania, and Estonia.`
    : 'Board games for sale in Latvia, Lithuania, and Estonia.';

  return {
    title,
    description,
    openGraph: { title: `${title} | Second Turn Games`, description },
  };
}

interface ListingRow {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  previous_price_cents: number | null;
  price_changed_at: string | null;
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
  const offset = (filters.page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Player-count and weight predicates ride the games!inner join — a separate
  // from('games') pre-fetch silently hits PostgREST's 1000-row default cap.
  let query = supabase
    .from('listings')
    .select(
      'id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, bgg_game_id, status, listing_type, bid_count, auction_end_at, version_thumbnail, games!inner(image, is_expansion)',
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
  if (filters.priceDrops) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - PRICE_DROP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    // Declining listings are excluded from has_price_decrease by the migration-122
    // trigger's fixed_price-only guard (they're already badged "Price drops" on the
    // card), so OR them in directly rather than relying on that generated column.
    query = query.or(
      `and(has_price_decrease.eq.true,price_changed_at.gt.${cutoff.toISOString()},price_changed_at.lte.${now.toISOString()}),listing_type.eq.declining`
    );
  }
  if (filters.playerCounts.length > 0) {
    const playerClauses = filters.playerCounts.map((n) =>
      n === 6
        ? 'max_players.gte.6'
        : `and(min_players.lte.${n},max_players.gte.${n})`
    );
    query = query.or(playerClauses.join(','), { referencedTable: 'games' });
  }
  if (filters.weightLevels.length > 0) {
    const weightClauses = filters.weightLevels.map((level) => {
      const range = WEIGHT_LEVEL_RANGES[level];
      return `and(weight.gte.${range.min},weight.lt.${range.max})`;
    });
    query = query.or(weightClauses.join(','), { referencedTable: 'games' });
  }
  if (filters.expansionsOnly) {
    // OR across two relations PostgREST can't fuse into one query: listing has
    // expansion rows OR the listing's own game is an expansion. Both sub-queries
    // are bounded by active listings count (not the related-table volumes) and
    // carry an explicit cap so the bound is visible.
    const EXPANSION_FILTER_CAP = 5000;
    const [{ data: withExpansions }, { data: isExpansion }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, listing_expansions!inner(listing_id)')
        .in('status', ['active', 'reserved'])
        .limit(EXPANSION_FILTER_CAP),
      supabase
        .from('listings')
        .select('id, games!inner(is_expansion)')
        .eq('games.is_expansion', true)
        .in('status', ['active', 'reserved'])
        .limit(EXPANSION_FILTER_CAP),
    ]);
    const expIds = new Set<string>([
      ...(withExpansions ?? []).map((r) => r.id),
      ...(isExpansion ?? []).map((r) => r.id),
    ]);
    if (expIds.size === 0) {
      query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
    } else {
      query = query.in('id', [...expIds]);
    }
  }

  // Sort
  if (filters.sort === 'price_asc') {
    query = query.order('price_cents', { ascending: true });
  } else if (filters.sort === 'price_desc') {
    query = query.order('price_cents', { ascending: false });
  } else if (filters.sort === 'recent_drops') {
    query = query.order('price_changed_at', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Paginate
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const [{ data: listings, count }, { user, favoriteIds }, { data: langRows }] = await Promise.all([
    query.returns<ListingRow[]>(),
    getUserWithFavorites(),
    supabase.from('listings').select('language').in('status', ['active', 'reserved']).not('language', 'is', null).limit(500),
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

  const { expansionCounts, commentCounts, upgradeCounts } = await getListingCardCounts(
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
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-4')}>
        Browse games
      </h1>

      <NavTabs
        tabs={[
          { key: 'for-sale', label: 'For sale', href: '/browse' },
          { key: 'wanted', label: 'Wanted', href: '/wanted' },
        ]}
        className="mb-4"
      />

      <BrowseFilters key={filtersToSearchParams(filters)} currentFilters={filters} availableLanguages={availableLanguages} />

      {filters.search && <BrowseSearchAnalytics query={filters.search} resultCount={totalCount} />}

      {filteredListings.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={MagnifyingGlass}
            title="Nothing matches those filters"
            description={
              filters.priceDrops && filters.showAuctions
                ? "Price drops don't apply to auctions."
                : 'Try tweaking them, or clear to see everything.'
            }
            action={{ label: 'Clear filters', href: '/browse', variant: 'secondary' }}
          />
        ) : (
          <EmptyState
            icon={Cube}
            title="The shelf's empty"
            description="No games here yet — you could be the first."
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
                previousPriceCents={isPriceDropActive(listing) ? listing.previous_price_cents! : undefined}
                sellerCountry={listing.country}
                isFavorited={favoriteIds.has(listing.id)}
                isAuthenticated={isAuthenticated}
                expansionCount={expansionCounts[listing.id] ?? 0}
                commentCount={commentCounts[listing.id] ?? 0}
                upgradeCount={upgradeCounts[listing.id] ?? 0}
                status={listing.status}
                isExpansion={listing.games?.is_expansion ?? false}
                isAuction={listing.listing_type === 'auction'}
                bidCount={listing.bid_count}
                auctionEndAt={listing.auction_end_at}
                isDeclining={listing.listing_type === 'declining'}
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
