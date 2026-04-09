import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { ListingCreationFlow } from '../../_components/ListingCreationFlow';
import { buildEnrichedGame } from '../../_components/GameSearchStep';
import { Alert } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { LISTING_DEADLINE_DAYS } from '@/lib/shelves/types';

export const metadata: Metadata = { title: 'Create listing from offer' };

interface Props {
  params: Promise<{ locale: string; offerId: string }>;
}

export default async function FromOfferPage({ params }: Props) {
  const { locale, offerId } = await params;
  const { user, profile } = await requireServerAuth();

  if (profile?.dac7_status === 'blocked') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <Alert variant="error">
          <p>Your ability to create new listings has been paused because required tax reporting information has not been provided.</p>
          <Link href="/account/settings/tax" className="text-sm font-medium underline mt-1 inline-block">Provide tax information to restore access</Link>
        </Alert>
      </div>
    );
  }

  const supabase = await createClient();

  // Fetch the offer with shelf item + game data
  const { data: offer, error } = await supabase
    .from('offers')
    .select(`
      id, amount_cents, counter_amount_cents, status, buyer_id, seller_id,
      shelf_items:shelf_item_id (
        id, bgg_game_id, game_name, game_year,
        games:bgg_game_id (thumbnail, image, player_count, alternate_names)
      )
    `)
    .eq('id', offerId)
    .single();

  if (error || !offer) notFound();

  // Only the seller can create a listing from their accepted offer
  if (offer.seller_id !== user.id) notFound();
  if (offer.status !== 'accepted') {
    redirect(`/${locale}/account/offers`);
  }

  const shelfItem = offer.shelf_items as unknown as {
    id: string;
    bgg_game_id: number;
    game_name: string;
    game_year: number | null;
    games: { thumbnail: string | null; image: string | null; player_count: string | null; alternate_names: string[] | null } | null;
  };

  if (!shelfItem) notFound();

  // The agreed price: counter_amount_cents if countered, otherwise original amount
  const agreedPrice = offer.counter_amount_cents ?? offer.amount_cents;

  const initialGame = buildEnrichedGame(shelfItem.bgg_game_id, shelfItem.game_name, shelfItem.game_year, shelfItem.games);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
        Create listing from offer
      </h1>

      <Alert variant="info" className="mb-6">
        You accepted an offer of{' '}
        <strong>{formatCentsToCurrency(agreedPrice)}</strong> for{' '}
        <strong>{shelfItem.game_name}</strong>. The game and price are locked.
        Add photos, select condition and edition, then publish.
        You have {LISTING_DEADLINE_DAYS} days to complete this listing.
      </Alert>

      <ListingCreationFlow
        initialData={{
          bgg_game_id: shelfItem.bgg_game_id,
          game_name: shelfItem.game_name,
          game_year: shelfItem.game_year,
          game_thumbnail: shelfItem.games?.thumbnail ?? null,
          game_image: shelfItem.games?.image ?? null,
          game_player_count: shelfItem.games?.player_count ?? null,
          price_cents: agreedPrice,
        }}
        initialGame={initialGame}
        lockedFields={['game', 'price']}
        offerId={offerId}
      />
    </div>
  );
}
