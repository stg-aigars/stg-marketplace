import { createClient } from '@/lib/supabase/server';
import { WantedListingCard } from '@/components/wanted/WantedListingCard';

interface RelatedWantsProps {
  listingId: string;
  bggGameId: number;
  buyerId: string;
  gameName: string;
  buyerName: string;
}

interface WantedRelatedRow {
  id: string;
  game_name: string;
  game_year: number | null;
  edition_year: number | null;
  language: string | null;
  publisher: string | null;
  version_thumbnail: string | null;
  country: string;
  notes: string | null;
  games: { image: string | null } | null;
}

const RELATED_SELECT = 'id, game_name, game_year, edition_year, language, publisher, version_thumbnail, country, notes, games:bgg_game_id(image)';
const LIMIT = 4;

export async function RelatedWants({ listingId, bggGameId, buyerId, gameName, buyerName }: RelatedWantsProps) {
  const supabase = await createClient();

  const [otherWantsResult, buyerWantsResult] = await Promise.all([
    supabase
      .from('wanted_listings')
      .select(RELATED_SELECT)
      .eq('bgg_game_id', bggGameId)
      .eq('status', 'active')
      .neq('id', listingId)
      .neq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(LIMIT)
      .returns<WantedRelatedRow[]>(),
    supabase
      .from('wanted_listings')
      .select(RELATED_SELECT)
      .eq('buyer_id', buyerId)
      .eq('status', 'active')
      .neq('id', listingId)
      .order('created_at', { ascending: false })
      .limit(LIMIT)
      .returns<WantedRelatedRow[]>(),
  ]);

  const otherWants = otherWantsResult.data ?? [];
  const buyerWants = buyerWantsResult.data ?? [];

  if (otherWants.length === 0 && buyerWants.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 space-y-8">
      {otherWants.length > 0 && (
        <WantsSection title={`Other people looking for ${gameName}`} wants={otherWants} />
      )}
      {buyerWants.length > 0 && (
        <WantsSection title={`More wants from ${buyerName}`} wants={buyerWants} />
      )}
    </div>
  );
}

function WantsSection({ title, wants }: { title: string; wants: WantedRelatedRow[] }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading mb-4">
        {title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {wants.map((want) => (
          <WantedListingCard
            key={want.id}
            id={want.id}
            gameTitle={want.game_name}
            gameYear={want.game_year}
            editionYear={want.edition_year}
            gameThumbnail={want.games?.image ?? null}
            versionThumbnail={want.version_thumbnail}
            language={want.language}
            publisher={want.publisher}
            buyerCountry={want.country}
            notes={want.notes}
          />
        ))}
      </div>
    </section>
  );
}
