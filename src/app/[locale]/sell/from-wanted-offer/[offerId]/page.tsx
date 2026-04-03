import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { ListingCreationFlow } from '../../_components/ListingCreationFlow';
import { buildEnrichedGame } from '../../_components/GameSearchStep';
import { Alert } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { LISTING_DEADLINE_DAYS } from '@/lib/shelves/types';

export const metadata: Metadata = { title: 'Create listing from wanted offer' };

interface Props {
  params: Promise<{ locale: string; offerId: string }>;
}

export default async function FromWantedOfferPage({ params }: Props) {
  const { locale, offerId } = await params;
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  // Fetch the wanted offer with wanted listing + game data
  const { data: offer, error } = await supabase
    .from('wanted_offers')
    .select(`
      id, price_cents, counter_price_cents, condition, status, buyer_id, seller_id,
      wanted_listings:wanted_listing_id (
        bgg_game_id, game_name, game_year,
        games:bgg_game_id (thumbnail, image, player_count, alternate_names)
      )
    `)
    .eq('id', offerId)
    .single();

  if (error || !offer) notFound();

  // Only the seller can create a listing from their accepted wanted offer
  if (offer.seller_id !== user.id) notFound();
  if (offer.status !== 'accepted') {
    redirect(`/${locale}/account/offers`);
  }

  const wantedListing = offer.wanted_listings as unknown as {
    bgg_game_id: number;
    game_name: string;
    game_year: number | null;
    games: { thumbnail: string | null; image: string | null; player_count: string | null; alternate_names: string[] | null } | null;
  };

  if (!wantedListing) notFound();

  // The agreed price: counter_price_cents if countered, otherwise original price
  const agreedPrice = offer.counter_price_cents ?? offer.price_cents;

  const initialGame = buildEnrichedGame(wantedListing.bgg_game_id, wantedListing.game_name, wantedListing.game_year, wantedListing.games);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
        Create listing from wanted offer
      </h1>

      <Alert variant="info" className="mb-6">
        You have an agreed offer of{' '}
        <strong>{formatCentsToCurrency(agreedPrice)}</strong> for{' '}
        <strong>{wantedListing.game_name}</strong>. The game and price are locked.
        Add photos, select condition and edition, then publish.
        You have {LISTING_DEADLINE_DAYS} days to complete this listing.
      </Alert>

      <ListingCreationFlow
        initialData={{
          bgg_game_id: wantedListing.bgg_game_id,
          game_name: wantedListing.game_name,
          game_year: wantedListing.game_year,
          game_thumbnail: wantedListing.games?.thumbnail ?? null,
          game_image: wantedListing.games?.image ?? null,
          game_player_count: wantedListing.games?.player_count ?? null,
          price_cents: agreedPrice,
          condition: offer.condition,
        }}
        initialGame={initialGame}
        lockedFields={['game', 'price']}
        wantedOfferId={offerId}
      />
    </div>
  );
}
