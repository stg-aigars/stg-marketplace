import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { SectionLink } from '@/components/ui';
import { WantedListingCard } from '@/components/wanted/WantedListingCard';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';

const WANTED_RAIL_MIN_LISTINGS = 3;
const WANTED_RAIL_MAX_LISTINGS = 4;

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
  const t = await getTranslations('home.wanted');
  const supabase = await createClient();

  const { data: wantedListings, error } = await supabase
    .from('wanted_listings')
    .select(
      'id, game_name, game_year, language, publisher, edition_year, version_thumbnail, country, notes, games:bgg_game_id(image)',
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(WANTED_RAIL_MAX_LISTINGS)
    .returns<WantedRow[]>();

  if (error) console.error('[WantedRail] query failed', error);

  const listings = wantedListings ?? [];

  if (listings.length < WANTED_RAIL_MIN_LISTINGS) return null;

  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-4 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-2">
              {t('eyebrow')}
            </p>
            <h2 className={SECTION_HEADING_CLASS}>{t('heading')}</h2>
          </div>
          <SectionLink href="/wanted">{t('browseAll')}</SectionLink>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((w) => (
            <WantedListingCard
              key={w.id}
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
          ))}
        </div>
      </div>
    </section>
  );
}
