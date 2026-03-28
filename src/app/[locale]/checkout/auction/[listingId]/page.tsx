import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { Card, CardBody, Alert } from '@/components/ui';
import { formatCentsToCurrency, calculateBuyerPricing } from '@/lib/services/pricing';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey } from '@/lib/listings/types';
import { getShippingPriceCents, type TerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
import { getTerminals } from '@/lib/services/unisend/client';
import { AuctionCheckoutForm } from './AuctionCheckoutForm';

export const metadata: Metadata = { title: 'Pay for auction' };

interface Props {
  params: Promise<{ locale: string; listingId: string }>;
}

export default async function AuctionCheckoutPage({ params }: Props) {
  const { locale, listingId } = await params;
  const { user, profile } = await requireServerAuth();
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('listings')
    .select(`
      id, seller_id, game_name, game_year, condition, price_cents, country,
      status, highest_bidder_id, current_bid_cents, payment_deadline_at,
      listing_type, photos,
      games:bgg_game_id (thumbnail, image)
    `)
    .eq('id', listingId)
    .single();

  if (!listing) notFound();

  if (listing.listing_type !== 'auction' || listing.status !== 'auction_ended') {
    redirect(`/${locale}/listings/${listingId}`);
  }

  if (listing.highest_bidder_id !== user.id) {
    redirect(`/${locale}/listings/${listingId}`);
  }

  const games = listing.games as unknown as { thumbnail: string | null; image: string | null } | null;
  const imageUrl = listing.photos?.[0] ?? games?.image ?? games?.thumbnail;
  const conditionLabel = conditionConfig[conditionToBadgeKey[listing.condition as keyof typeof conditionToBadgeKey]].label;
  const winningBid = listing.current_bid_cents ?? listing.price_cents;

  const buyerCountry = (profile?.country ?? 'LV') as TerminalCountry;
  const sellerCountry = listing.country as TerminalCountry;
  const shippingCents = getShippingPriceCents(sellerCountry, buyerCountry) ?? 0;
  const pricing = calculateBuyerPricing(winningBid, shippingCents);

  // Fetch terminals
  let terminals: TerminalOption[] = [];
  let terminalsFetchFailed = false;
  try {
    terminals = await getTerminals(buyerCountry);
  } catch {
    terminalsFetchFailed = true;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-4">
        Pay for your winning auction
      </h1>

      {listing.payment_deadline_at && (
        <Alert variant="warning" className="mb-6">
          Complete payment before the deadline to secure this game.
        </Alert>
      )}

      <Card className="mb-6">
        <CardBody>
          <div className="flex gap-4">
            <div className="relative w-20 h-20 shrink-0 bg-semantic-bg-surface rounded overflow-hidden flex items-center justify-center">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={listing.game_name}
                  fill
                  className="object-contain p-1"
                  sizes="80px"
                />
              ) : (
                <ImageSquare size={32} className="text-semantic-text-muted" />
              )}
            </div>
            <div>
              <p className="font-semibold text-semantic-text-heading">{listing.game_name}</p>
              {listing.game_year && (
                <p className="text-xs text-semantic-text-muted">({listing.game_year})</p>
              )}
              <p className="text-sm text-semantic-text-muted mt-1">{conditionLabel} condition</p>
              <p className="text-lg font-bold text-semantic-text-heading mt-1">
                Winning bid: {formatCentsToCurrency(winningBid)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <AuctionCheckoutForm
        listingId={listing.id}
        winningBidCents={winningBid}
        shippingCents={shippingCents}
        totalCents={pricing.totalChargeCents}
        buyerCountry={buyerCountry}
        terminals={terminals}
        terminalsFetchFailed={terminalsFetchFailed}
      />
    </div>
  );
}
