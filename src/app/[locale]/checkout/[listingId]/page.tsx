import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Alert, Badge, Card, CardBody } from '@/components/ui';
import { calculateBuyerPricing, formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { getShippingPriceCents, type TerminalCountry } from '@/lib/services/unisend/types';
import { getTerminals } from '@/lib/services/unisend/client';
import { createClient } from '@/lib/supabase/server';
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
      '*, games(thumbnail, image), user_profiles(full_name, country)'
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
          <h1 className="text-2xl font-bold text-semantic-text-heading mb-2">
            This listing is no longer available
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            It may have been sold or removed by the seller.
          </p>
          <Link href="/browse" className="text-semantic-primary font-medium">
            Browse other games
          </Link>
        </div>
      </div>
    );
  }

  // Cannot buy own listing
  if (listing.seller_id === user.id) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-semantic-text-heading mb-2">
            This is your listing
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            You cannot purchase your own listing.
          </p>
          <Link href={`/listings/${listing.id}`} className="text-semantic-primary font-medium">
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
          <h1 className="text-2xl font-bold text-semantic-text-heading mb-2">
            Shipping not available
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            Shipping is not available between these countries yet.
          </p>
          <Link href={`/listings/${listing.id}`} className="text-semantic-primary font-medium">
            Back to listing
          </Link>
        </div>
      </div>
    );
  }

  const pricing = calculateBuyerPricing(listing.price_cents, shippingCents);

  // Fetch terminals for buyer's country
  let terminalsFetchFailed = false;
  let terminals: { id: string; name: string; city: string; address: string; countryCode: string }[] = [];
  try {
    const rawTerminals = await getTerminals(buyerCountry);
    terminals = rawTerminals
      .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
      .map((t) => ({ id: t.id, name: t.name, city: t.city, address: t.address, countryCode: t.countryCode }));
  } catch (error) {
    console.error('[Checkout] Failed to fetch terminals:', error);
    terminalsFetchFailed = true;
  }

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
      <nav className="mb-4 text-sm text-semantic-text-muted flex items-center min-w-0">
        <Link href="/browse" className="shrink-0 sm:hover:text-semantic-text-secondary transition-colors">
          Browse
        </Link>
        <span className="mx-2 shrink-0">/</span>
        <Link href={`/listings/${listing.id}`} className="truncate sm:hover:text-semantic-text-secondary transition-colors">
          {listing.game_name}
        </Link>
        <span className="mx-2 shrink-0">/</span>
        <span className="shrink-0 text-semantic-text-secondary">Checkout</span>
      </nav>

      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Checkout
      </h1>

      {errorMessage && (
        <Alert variant="error" className="mb-6">{errorMessage}</Alert>
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
                {/* Game image */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-semantic-bg-subtle">
                  {gameImage ? (
                    <img
                      src={gameImage}
                      alt={listing.game_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-semantic-text-muted text-xs">
                      No image
                    </div>
                  )}
                </div>

                {/* Game details */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-semantic-text-heading truncate">
                    {listing.game_name}
                    {listing.game_year && (
                      <span className="text-semantic-text-muted font-normal ml-1">
                        ({listing.game_year})
                      </span>
                    )}
                  </h3>
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

              <div className="mt-6">
                <CheckoutForm
                  listingId={listing.id}
                  buyerCountry={buyerCountry}
                  buyerPhone={profile?.phone ?? ''}
                  terminals={terminals}
                  terminalsFetchFailed={terminalsFetchFailed}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
