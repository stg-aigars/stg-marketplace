import type { Metadata } from 'next';
import Link from 'next/link';
import { MagnifyingGlass, Cube, Plus } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, Pagination, Button, NavTabs } from '@/components/ui';
import { WantedListingCard } from '@/components/wanted/WantedListingCard';
import { WantedBrowseFilters } from '@/components/wanted/WantedBrowseFilters';
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
  language: string | null;
  publisher: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
  country: string;
  notes: string | null;
  bgg_game_id: number;
  games: { image: string | null };
}

export default async function WantedBrowsePage(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const filters = parseWantedFiltersFromParams(searchParams);
  const offset = (filters.page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from('wanted_listings')
    .select(
      'id, game_name, game_year, language, publisher, edition_year, version_thumbnail, country, notes, bgg_game_id, games:bgg_game_id(image)',
      { count: 'exact' }
    )
    .eq('status', 'active');

  if (filters.search) {
    query = query.ilike('game_name', `%${filters.search}%`);
  }
  if (filters.countries.length > 0) {
    query = query.in('country', filters.countries);
  }

  query = query.order('created_at', { ascending: false });
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
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          Wanted games
        </h1>
        <Button size="sm" asChild>
          <Link href="/wanted/new">
            <Plus size={16} weight="bold" className="mr-1.5" />
            Post a want
          </Link>
        </Button>
      </div>

      <NavTabs
        tabs={[
          { key: 'for-sale', label: 'For sale', href: '/browse' },
          { key: 'wanted', label: 'Wanted', href: '/wanted' },
        ]}
        className="mb-4"
      />

      <WantedBrowseFilters key={wantedFiltersToSearchParams(filters)} currentFilters={filters} />

      {filteredListings.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={MagnifyingGlass}
            title="Nothing matches those filters"
            description="Try tweaking them, or clear to see every wanted game."
            action={{ label: 'Clear filters', href: '/wanted', variant: 'secondary' }}
          />
        ) : (
          <EmptyState
            icon={Cube}
            title="The want board's empty"
            description="Nobody's posted a wanted game yet — you could be the first."
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
                editionYear={listing.edition_year}
                gameThumbnail={listing.games?.image ?? null}
                versionThumbnail={listing.version_thumbnail}
                language={listing.language}
                publisher={listing.publisher}
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
