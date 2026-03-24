import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import type { ListingCondition, VersionSource } from '@/lib/listings/types';
import { EditListingForm } from './EditListingForm';

export const metadata: Metadata = {
  title: 'Edit listing',
};

interface EditListingRow {
  id: string;
  seller_id: string;
  bgg_game_id: number;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  description: string | null;
  status: string;
  photos: string[];
  version_source: VersionSource;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  games: {
    name: string | null;
    thumbnail: string | null;
    image: string | null;
    year_published: number | null;
    min_players: number | null;
    max_players: number | null;
  };
}

export default async function EditListingPage({
  params: { id, locale },
}: {
  params: { id: string; locale: string };
}) {
  const { user } = await requireServerAuth();

  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('listings')
    .select(
      'id, seller_id, bgg_game_id, game_name, game_year, condition, price_cents, description, status, photos, version_source, bgg_version_id, version_name, publisher, language, edition_year, games(name, thumbnail, image, year_published, min_players, max_players)'
    )
    .eq('id', id)
    .single<EditListingRow>();

  if (!listing || listing.seller_id !== user.id) {
    notFound();
  }

  if (listing.status !== 'active') {
    redirect(`/${locale}/account/listings`);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <EditListingForm listing={listing} locale={locale} />
    </main>
  );
}
