import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import type { ListingCondition, ListingStatus, ListingType, VersionSource } from '@/lib/listings/types';
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
  status: ListingStatus;
  listing_type: ListingType;
  bid_count: number;
  photos: string[];
  version_source: VersionSource;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
  games: {
    name: string | null;
    thumbnail: string | null;
    image: string | null;
    player_count: string | null;
    alternate_names: string[] | null;
  };
}

export default async function EditListingPage(
  props: {
    params: Promise<{ id: string; locale: string }>;
  }
) {
  const params = await props.params;

  const {
    id,
    locale
  } = params;

  const { user } = await requireServerAuth();

  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('listings')
    .select(
      'id, seller_id, bgg_game_id, game_name, game_year, condition, price_cents, description, status, listing_type, bid_count, photos, version_source, bgg_version_id, version_name, publisher, language, edition_year, version_thumbnail, games(name, thumbnail, image, player_count, alternate_names)'
    )
    .eq('id', id)
    .single<EditListingRow>();

  if (!listing || listing.seller_id !== user.id) {
    notFound();
  }

  if (listing.status !== 'active') {
    redirect(`/${locale}/account/listings`);
  }

  if (listing.listing_type === 'auction' && listing.bid_count > 0) {
    redirect(`/${locale}/listings/${id}`);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <EditListingForm listing={listing} alternateNames={listing.games?.alternate_names ?? []} locale={locale} />
    </main>
  );
}
