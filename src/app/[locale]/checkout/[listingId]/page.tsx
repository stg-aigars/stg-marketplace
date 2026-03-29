import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Alert, Badge, Breadcrumb, Card, CardBody, Stepper } from '@/components/ui';
import { calculateBuyerPricing, calculateCheckoutPricing, formatCentsToCurrency } from '@/lib/services/pricing';
import { getWalletBalance } from '@/lib/services/wallet';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { getShippingPriceCents, type TerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
import { getTerminals } from '@/lib/services/unisend/client';
import { createClient } from '@/lib/supabase/server';
import { reserveListingForCheckout } from '@/lib/listings/actions';
import { ReservationCountdown } from '@/components/listings/ReservationCountdown';
import { GameThumb, GameTitle } from '@/components/listings/atoms';
import { CheckoutForm } from './CheckoutForm';

interface CheckoutListingRow {
  id: string;
  seller_id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  status: string;
  reserved_by: string | null;
  reserved_at: string | null;
  photos: string[];
  country: string;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  games: {
    thumbnail: string | null;
    image: string | null;
  };
  user_profiles: {
    full_name: string | null;
    country: string;
  };
}

export const metadata: Metadata = {
  title: 'Checkout',
};

export default async function CheckoutPage({
  params: { listingId },
  searchParams,
}: {
  params: { listingId: string; locale: string };
  searchParams: { error?: string };
}) {
  const { user, profile } = await requireServerAuth();

  const client = await createClient();

  const { data: listing } = await client
    .from('listings')
    .select(
      '*, games(thumbnail, image), user_profiles!listings_seller_id_fkey(full_name, country)'
    )
    .eq('id', listingId)
    .single<CheckoutListingRow>();

  if (!listing) {
    notFound();
  }

  // Listing must be active or reserved by this buyer
  const canCheckout = listing.status === 'active' ||
    (listing.status === 'reserved' && listing.reserved_by === user.id);

  if (!canCheckout) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
            This listing is no longer available
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            It may have been sold or removed by the seller.
          </p>
          <Link href="/browse" className="text-semantic-brand font-medium">
            Browse other games
          </Link>
        </div>
      </div>
    );
  }

  // Reserve the listing on checkout page load (not at payment time).
  // reserved_at is set once and NOT refreshed on revisit (hard 30-min TTL).
  let reservedAt: string | null = null;
  if (listing.status === 'active') {
    const result = await reserveListingForCheckout(listingId);
    if ('error' in result) {
      const isReservedByOther = result.error.includes('reserved by another');
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
              {isReservedByOther
                ? 'This game is currently reserved'
                : 'This listing is no longer available'}
            </h1>
            <p className="text-semantic-text-secondary mb-6">
              {isReservedByOther
                ? 'Another buyer is completing their purchase. Check back shortly.'
                : 'It may have been sold or removed by the seller.'}
            </p>
            <Link href={`/listings/${listingId}`} className="text-semantic-brand font-medium">
              Back to listing
            </Link>
          </div>
        </div>
      );
    }
    reservedAt = result.reservedAt;
  } else {
    // Already reserved by this buyer (revisit) — use existing reserved_at
    reservedAt = listing.reserved_by === user.id ? listing.reserved_at : null;
  }

  // Cannot buy own listing
  if (listing.seller_id === user.id) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
            This is your listing
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            You cannot purchase your own listing.
          </p>
          <Link href={`/listings/${listing.id}`} className="text-semantic-brand font-medium">
            Back to listing
          </Link>
        </div>
      </div>
    );
  }

  // Calculate shipping
  const sellerCountry = listing.country as TerminalCountry;
  const buyerCountry = (profile?.country ?? 'LV') as TerminalCountry;
  const shippingCents = getShippingPriceCents(sellerCountry, buyerCountry);

  if (shippingCents === null) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
            Shipping not available
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            Shipping is not available between these countries yet.
          </p>
          <Link href={`/listings/${listing.id}`} className="text-semantic-brand font-medium">
            Back to listing
          </Link>
        </div>
      </div>
    );
  }

  const pricing = calculateBuyerPricing(listing.price_cents, shippingCents);

  // Fetch wallet balance and terminals in parallel (independent operations)
  let terminalsFetchFailed = false;
  let terminals: TerminalOption[] = [];
  const [walletBalanceCents, terminalsResult] = await Promise.all([
    getWalletBalance(user.id),
    getTerminals(buyerCountry).catch((error) => {
      console.error('[Checkout] Failed to fetch terminals:', error);
      terminalsFetchFailed = true;
      return [] as Awaited<ReturnType<typeof getTerminals>>;
    }),
  ]);

  if (!terminalsFetchFailed) {
    terminals = terminalsResult
      .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
      .map((t) => ({ id: t.id, name: t.name, city: t.city, address: t.address, countryCode: t.countryCode }));
  }

  const walletPricing = walletBalanceCents > 0
    ? calculateCheckoutPricing(listing.price_cents, shippingCents, walletBalanceCents)
    : null;

  const badgeKey = conditionToBadgeKey[listing.condition];
  const conditionInfo = conditionConfig[badgeKey];
  const gameImage = listing.games?.image ?? listing.games?.thumbnail ?? null;
  const sellerFlagClass = getCountryFlag(listing.user_profiles?.country);
  const sellerCountryName = getCountryName(listing.user_profiles?.country);

  // Error messages from payment callback
  const errorMessages: Record<string, string> = {
    payment_failed: 'Payment could not be processed. Please try again.',
    user_cancelled: 'Payment was cancelled. You can try again when ready.',
    card_declined: 'Your card was declined. Please try a different payment method.',
    auth_failed: 'Card authentication failed. Please try again.',
    technical_error: 'A technical error occurred. Please try again in a few minutes.',
    fraud_declined: 'Payment could not be processed. Please try a different payment method.',
    verification_failed: 'Payment verification failed. Please try again.',
    listing_unavailable: 'This listing was purchased while you were paying. Your payment will be refunded automatically.',
    order_creation_failed: 'Something went wrong creating your order. Your payment will be refunded automatically. If you do not see the refund within a few business days, please contact support.',
  };

  const errorMessage = searchParams.error ? errorMessages[searchParams.error] ?? 'Something went wrong. Please try again.' : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Browse', href: '/browse' },
        { label: listing.game_name, href: `/listings/${listing.id}` },
        { label: 'Checkout' },
      ]} />

      <Stepper
        steps={[
          { id: 'browse', label: 'Browse' },
          { id: 'listing', label: 'Listing' },
          { id: 'checkout', label: 'Checkout' },
          { id: 'confirmation', label: 'Confirmation' },
        ]}
        currentStep="checkout"
        className="mb-6"
      />

      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Checkout
      </h1>

      {errorMessage && (
        <Alert variant="error" className="mb-6">{errorMessage}</Alert>
      )}

      {reservedAt && (
        <div className="mb-4">
          <ReservationCountdown reservedAt={reservedAt} isOwner compact />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Order summary */}
        <div className="lg:col-span-3">
          <Card>
            <CardBody className="sm:p-6">
              <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
                Order summary
              </h2>

              <div className="flex gap-4">
                <GameThumb
                  src={gameImage}
                  alt={listing.game_name}
                  size="lg"
                />

                {/* Game details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1">
                    <GameTitle
                      name={listing.game_name}
                      size="lg"
                      serif
                    />
                    {listing.game_year && (
                      <span className="text-sm text-semantic-text-muted">
                        ({listing.game_year})
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <Badge condition={badgeKey}>{conditionInfo.label}</Badge>
                  </div>

                  {/* Edition info */}
                  {(listing.publisher || listing.language) && (
                    <p className="mt-2 text-sm text-semantic-text-muted">
                      {[listing.publisher, listing.language, listing.edition_year]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Seller info */}
              <div className="mt-4 pt-4 border-t border-semantic-border-subtle">
                <p className="text-sm text-semantic-text-muted">Seller</p>
                <div className="flex items-center gap-2 mt-1">
                  {sellerFlagClass && (
                    <span className={sellerFlagClass} title={sellerCountryName} />
                  )}
                  <span className="text-sm text-semantic-text-secondary">
                    {listing.user_profiles?.full_name ?? 'Anonymous'}
                  </span>
                  <span className="text-sm text-semantic-text-muted">
                    · {sellerCountryName}
                  </span>
                </div>
              </div>

              {/* Shipping route */}
              <div className="mt-4 pt-4 border-t border-semantic-border-subtle">
                <p className="text-sm text-semantic-text-muted">Shipping</p>
                <p className="text-sm text-semantic-text-secondary mt-1">
                  Parcel locker: {getCountryName(sellerCountry)} → {getCountryName(buyerCountry)}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Payment card */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-6">
            <CardBody className="sm:p-6">
              <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
                Payment
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-semantic-text-secondary">Item price</span>
                  <span className="text-semantic-text-primary">
                    {formatCentsToCurrency(pricing.itemsTotalCents)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-semantic-text-secondary">Shipping</span>
                  <span className="text-semantic-text-primary">
                    {formatCentsToCurrency(pricing.shippingCostCents)}
                  </span>
                </div>
                <div className="border-t border-semantic-border-subtle pt-3">
                  <div className="flex justify-between font-semibold">
                    <span className="text-semantic-text-heading">Total</span>
                    <span className="text-semantic-text-heading">
                      {formatCentsToCurrency(pricing.totalChargeCents)}
                    </span>
                  </div>
                </div>
              </div>

              {walletBalanceCents > 0 && walletPricing && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-semantic-text-secondary">Wallet balance</span>
                    <span className="text-semantic-success">
                      -{formatCentsToCurrency(walletPricing.walletDebitCents)}
                    </span>
                  </div>
                  <div className="border-t border-semantic-border-subtle pt-3">
                    <div className="flex justify-between font-semibold">
                      <span className="text-semantic-text-heading">
                        {walletPricing.everypayChargeCents > 0 ? 'Card payment' : 'Wallet payment'}
                      </span>
                      <span className="text-semantic-text-heading">
                        {formatCentsToCurrency(walletPricing.everypayChargeCents)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="mt-6">
                <CheckoutForm
                  listingId={listing.id}
                  buyerCountry={buyerCountry}
                  buyerPhone={profile?.phone ?? ''}
                  terminals={terminals}
                  terminalsFetchFailed={terminalsFetchFailed}
                  walletBalanceCents={walletBalanceCents}
                  walletCoversTotal={walletPricing?.everypayChargeCents === 0}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
