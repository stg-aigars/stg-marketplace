import type { Metadata } from 'next';
import Link from 'next/link';
import { MagnifyingGlass, Cube, Plus } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, Pagination, Button } from '@/components/ui';
import { WantedListingCard } from '@/components/wanted/WantedListingCard';
import { WantedBrowseFilters } from '@/components/wanted/WantedBrowseFilters';
import type { ListingCondition } from '@/lib/listings/types';
import {
  parseWantedFiltersFromParams,
  wantedFiltersToSearchParams,
  hasActiveWantedFilters,
} from '@/lib/wanted/filters';

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: 'Wanted games',
  description: 'Games people are looking for in Latvia, Lithuania, and Estonia.',
  openGraph: {
    title: 'Wanted games | Second Turn Games',
    description: 'Games people are looking for in Latvia, Lithuania, and Estonia.',
  },
};

interface WantedRow {
  id: string;
  game_name: string;
  game_year: number | null;
  min_condition: ListingCondition;
  max_price_cents: number | null;
  country: string;
  notes: string | null;
  bgg_game_id: number;
  games: { thumbnail: string | null };
}

export default async function WantedBrowsePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseWantedFiltersFromParams(searchParams);
  const offset = (filters.page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from('wanted_listings')
    .select(
      'id, game_name, game_year, min_condition, max_price_cents, country, notes, bgg_game_id, games:bgg_game_id(thumbnail)',
      { count: 'exact' }
    )
    .eq('status', 'active');

  if (filters.search) {
    query = query.ilike('game_name', `%${filters.search}%`);
  }
  if (filters.minConditions.length > 0) {
    query = query.in('min_condition', filters.minConditions);
  }
  if (filters.budgetMinCents !== null) {
    query = query.gte('max_price_cents', filters.budgetMinCents);
  }
  if (filters.budgetMaxCents !== null) {
    query = query.lte('max_price_cents', filters.budgetMaxCents);
  }
  if (filters.countries.length > 0) {
    query = query.in('country', filters.countries);
  }

  if (filters.sort === 'budget_asc') {
    query = query.order('max_price_cents', { ascending: true, nullsFirst: false });
  } else if (filters.sort === 'budget_desc') {
    query = query.order('max_price_cents', { ascending: false, nullsFirst: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: listings, count } = await query.returns<WantedRow[]>();

  const filteredListings = listings ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const filtersActive = hasActiveWantedFilters(filters);

  const paginationUrl = (page: number) =>
    `/wanted${wantedFiltersToSearchParams({ ...filters, page })}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Wanted games
        </h1>
        <Link href="/wanted/new">
          <Button size="sm">
            <Plus size={16} weight="bold" className="mr-1.5" />
            Post a want
          </Button>
        </Link>
      </div>

      <WantedBrowseFilters key={wantedFiltersToSearchParams(filters)} currentFilters={filters} />

      {filteredListings.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={MagnifyingGlass}
            title="No wanted listings match your filters"
            description="Try adjusting your filters or clearing them to see all wanted games."
            action={{ label: 'Clear filters', href: '/wanted', variant: 'secondary' }}
          />
        ) : (
          <EmptyState
            icon={Cube}
            title="No games wanted yet"
            description="Be the first to post a game you are looking for."
            action={{ label: 'Post a want', href: '/wanted/new', variant: 'primary' }}
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredListings.map((listing) => (
              <WantedListingCard
                key={listing.id}
                id={listing.id}
                gameTitle={listing.game_name}
                gameYear={listing.game_year}
                gameThumbnail={listing.games?.thumbnail ?? null}
                minCondition={listing.min_condition}
                maxPriceCents={listing.max_price_cents}
                buyerCountry={listing.country}
                notes={listing.notes}
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
