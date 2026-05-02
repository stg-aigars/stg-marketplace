import Link from 'next/link';
import { MagnifyingGlass } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { Button, EmptyState, SectionLink } from '@/components/ui';
import { WantedListingCard } from '@/components/wanted/WantedListingCard';

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
  games: { image: string | null };
}

export async function WantedRail() {
  const supabase = await createClient();

  const { data: wantedListings } = await supabase
    .from('wanted_listings')
    .select(
      'id, game_name, game_year, language, publisher, edition_year, version_thumbnail, country, notes, games:bgg_game_id(image)',
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(6)
    .returns<WantedRow[]>();

  const listings = wantedListings ?? [];

  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Wanted in the Baltics this week
          </h2>
          {listings.length > 0 && (
            <SectionLink href="/wanted">See all wanted listings</SectionLink>
          )}
        </div>

        {listings.length === 0 ? (
          <>
            <EmptyState
              icon={MagnifyingGlass}
              title="No active wanted listings yet."
              description="Post the first one — sellers across the Baltics will see what you're hunting for."
            />
            <div className="flex justify-center">
              <Button asChild variant="brand">
                <Link href="/wanted/new">Post a wanted listing</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
              {listings.map((w) => (
                <div
                  key={w.id}
                  className="flex-none w-[280px] sm:w-[300px] snap-start"
                >
                  <WantedListingCard
                    id={w.id}
                    gameTitle={w.game_name}
                    gameYear={w.game_year}
                    editionYear={w.edition_year}
                    gameThumbnail={w.games?.image ?? null}
                    versionThumbnail={w.version_thumbnail}
                    language={w.language}
                    publisher={w.publisher}
                    buyerCountry={w.country}
                    notes={w.notes}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button asChild variant="ghost" size="sm">
                <Link href="/wanted/new">Post a wanted listing</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
