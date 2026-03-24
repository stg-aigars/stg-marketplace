import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Prohibit, Users, Scales } from '@phosphor-icons/react/ssr';
import { Alert, Avatar, Badge, Breadcrumb, Button, Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition, type ListingStatus } from '@/lib/listings/types';
import { formatDate } from '@/lib/date-utils';
import { getWeightLabel } from '@/lib/bgg/utils';
import { PhotoGallery } from './PhotoGallery';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { SellerRating } from '@/components/reviews';
import { getSellerRating } from '@/lib/reviews/service';
import { getSellerCompletedSales, calculateTrustTier } from '@/lib/services/sellers';
import { TrustBadge } from '@/components/sellers/TrustBadge';
import { ReservationCountdown } from '@/components/listings/ReservationCountdown';
import { OwnerActions } from './OwnerActions';

interface ListingDetailRow {
  id: string;
  seller_id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  description: string | null;
  status: string;
  photos: string[];
  country: string;
  version_source: string;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  reserved_at: string | null;
  reserved_by: string | null;
  created_at: string;
  games: {
    thumbnail: string | null;
    image: string | null;
    player_count: string | null;
    description: string | null;
    weight: number | null;
    categories: string[] | null;
    mechanics: string[] | null;
  };
  user_profiles: {
    full_name: string | null;
    country: string;
    created_at: string;
  } | null;
}

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('listings')
    .select('game_name, price_cents, condition, games(image, thumbnail)')
    .eq('id', id)
    .single<{
      game_name: string;
      price_cents: number;
      condition: string;
      games: { image: string | null; thumbnail: string | null } | null;
    }>();

  const title = data?.game_name ?? 'Listing';
  const description = data
    ? `${data.game_name} — ${data.condition} condition, ${formatCentsToCurrency(data.price_cents)}`
    : 'Pre-loved board game listing on Second Turn Games';
  const image = data?.games?.image ?? data?.games?.thumbnail ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Second Turn Games`,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function ListingDetailPage({
  params: { id, locale },
}: {
  params: { id: string; locale: string };
}) {
  const supabase = await createClient();

  // Get current user (optional — don't redirect if not authenticated)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listing } = await supabase
    .from('listings')
    .select(
      '*, games(thumbnail, image, player_count, description, weight, categories, mechanics)'
    )
    .eq('id', id)
    .single<ListingDetailRow>();

  if (!listing) {
    notFound();
  }

  // Fetch seller profile separately (public_profiles view — safe for anonymous access)
  const { data: sellerProfile } = await supabase
    .from('public_profiles')
    .select('full_name, country, created_at')
    .eq('id', listing.seller_id)
    .single<{ full_name: string | null; country: string; created_at: string }>();

  // Attach to listing shape for backward compatibility with template
  listing.user_profiles = sellerProfile;

  const isOwner = user?.id === listing.seller_id;

  // Check if user has favorited this listing
  let isFavorited = false;
  if (user && !isOwner) {
    const { data: fav } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .maybeSingle();
    isFavorited = !!fav;
  }

  // Fetch seller rating and completed sales in parallel
  const [sellerRating, sellerCompletedSales] = await Promise.all([
    getSellerRating(listing.seller_id),
    getSellerCompletedSales(listing.seller_id),
  ]);

  const isReserver = listing.status === 'reserved' && listing.reserved_by === user?.id;

  // If listing is not active/reserved and viewer is not the seller, show unavailable message
  if (listing.status !== 'active' && listing.status !== 'reserved' && !isOwner) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-16">
          <Prohibit size={64} className="mx-auto text-semantic-text-muted mb-4" />
          <h1 className="text-2xl font-bold text-semantic-text-heading mb-2">
            This listing is no longer available
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            It may have been sold or removed by the seller.
          </p>
          <Link href="/browse">
            <Button variant="secondary">Browse other games</Button>
          </Link>
        </div>
      </div>
    );
  }

  const badgeKey = conditionToBadgeKey[listing.condition];
  const conditionInfo = conditionConfig[badgeKey];
  const sellerFlagClass = getCountryFlag(listing.user_profiles?.country);
  const sellerCountryName = getCountryName(listing.user_profiles?.country);
  const gameImage = listing.games?.image ?? listing.games?.thumbnail ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Browse', href: '/browse' },
        { label: listing.game_name },
      ]} />

      {/* Owner status banner for non-active listings */}
      {isOwner && listing.status !== 'active' && (
        <Alert variant="info" className="mb-6">
          <p className="text-sm text-semantic-text-secondary">
            {listing.status === 'reserved'
              ? 'This listing is reserved — a buyer has purchased it and the order is being processed.'
              : listing.status === 'sold'
              ? 'This listing has been sold.'
              : 'This listing has been cancelled.'}
          </p>
          {(listing.status === 'reserved' || listing.status === 'sold') && (
            <Link
              href="/account/orders"
              className="text-sm text-semantic-primary font-medium mt-2 inline-block"
            >
              View your orders
            </Link>
          )}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Photos */}
        <div>
          <PhotoGallery
            photos={listing.photos ?? []}
            gameImage={gameImage}
            gameTitle={listing.game_name}
          />
        </div>

        {/* Right: Details */}
        <div className="space-y-6">
          {/* Title & condition */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
              {listing.game_name}
              {listing.game_year && (
                <span className="text-semantic-text-muted font-normal text-xl ml-2">
                  ({listing.game_year})
                </span>
              )}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <Badge condition={badgeKey}>{conditionInfo.label}</Badge>
              <span className="text-sm text-semantic-text-muted">
                {conditionInfo.description}
              </span>
            </div>
          </div>

          {/* Price & action */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-semantic-text-heading">
                {formatCentsToCurrency(listing.price_cents)}
              </p>
              {!isOwner && (
                <FavoriteButton
                  listingId={listing.id}
                  initialFavorited={isFavorited}
                  isAuthenticated={!!user}
                />
              )}
            </div>
            {isOwner ? (
              <OwnerActions listingId={listing.id} status={listing.status as ListingStatus} locale={locale} />
            ) : listing.status === 'reserved' && !isReserver ? (
              /* Another buyer has reserved this listing */
              <ReservationCountdown reservedAt={listing.reserved_at!} />
            ) : listing.status === 'reserved' && isReserver ? (
              /* This buyer reserved it — prompt them to complete payment */
              <div className="space-y-3">
                <Card>
                  <CardBody>
                    <p className="text-sm text-semantic-text-secondary">
                      You have reserved this game. Complete your payment to secure it.
                    </p>
                  </CardBody>
                </Card>
                <Link href={`/checkout/${listing.id}`}>
                  <Button>Complete payment</Button>
                </Link>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link href={`/checkout/${listing.id}`}>
                  <Button>Buy now</Button>
                </Link>
                {user ? (
                  <Link href={`/messages?listing=${listing.id}`}>
                    <Button variant="secondary">Message seller</Button>
                  </Link>
                ) : (
                  <Link href="/auth/signin">
                    <Button variant="secondary">Message seller</Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Listing description */}
          {listing.description && (
            <div>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-2">
                Description
              </h2>
              <p className="text-semantic-text-secondary whitespace-pre-line">
                {listing.description}
              </p>
            </div>
          )}

          {/* Edition info */}
          {(listing.publisher || listing.language || listing.edition_year) && (
            <Card>
              <CardBody className="space-y-2">
                <h2 className="text-base font-semibold text-semantic-text-heading">
                  Edition details
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {listing.publisher && (
                    <>
                      <dt className="text-semantic-text-muted">Publisher</dt>
                      <dd className="text-semantic-text-secondary">{listing.publisher}</dd>
                    </>
                  )}
                  {listing.language && (
                    <>
                      <dt className="text-semantic-text-muted">Language</dt>
                      <dd className="text-semantic-text-secondary">{listing.language}</dd>
                    </>
                  )}
                  {listing.edition_year && (
                    <>
                      <dt className="text-semantic-text-muted">Year</dt>
                      <dd className="text-semantic-text-secondary">{listing.edition_year}</dd>
                    </>
                  )}
                </dl>
              </CardBody>
            </Card>
          )}

          {/* Seller info */}
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
                Seller
              </h2>
              <div className="flex items-center gap-3">
                <Avatar name={listing.user_profiles?.full_name ?? '?'} />
                <div>
                  <Link
                    href={`/sellers/${listing.seller_id}`}
                    className="font-medium text-semantic-text-heading sm:hover:text-semantic-primary transition-colors"
                  >
                    {listing.user_profiles?.full_name ?? 'Anonymous'}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-semantic-text-muted">
                    {sellerFlagClass && (
                      <span className={`${sellerFlagClass}`} title={sellerCountryName} />
                    )}
                    <span>{sellerCountryName}</span>
                    <span className="mx-1">&middot;</span>
                    <span>
                      Member since{' '}
                      {listing.user_profiles?.created_at
                        ? formatDate(listing.user_profiles.created_at)
                        : 'unknown'}
                    </span>
                    {sellerCompletedSales > 0 && (
                      <>
                        <span className="mx-1">&middot;</span>
                        <span>{sellerCompletedSales} {sellerCompletedSales === 1 ? 'sale' : 'sales'} completed</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <SellerRating
                      positivePct={sellerRating.positivePct}
                      ratingCount={sellerRating.ratingCount}
                      size="sm"
                    />
                    <TrustBadge tier={calculateTrustTier(sellerCompletedSales, sellerRating.positivePct, sellerRating.ratingCount)} />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Game details from BGG */}
          {(listing.games?.player_count || listing.games?.weight || listing.games?.description) && (
            <Card>
              <CardBody className="space-y-3">
                <h2 className="text-base font-semibold text-semantic-text-heading">
                  Game details
                </h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {listing.games.player_count && (
                    <div className="flex items-center gap-2 text-sm text-semantic-text-secondary">
                      <Users size={16} />
                      <span>{listing.games.player_count} players</span>
                    </div>
                  )}
                  {listing.games.weight != null && listing.games.weight > 0 && (
                    <div className="flex items-center gap-2 text-sm text-semantic-text-secondary">
                      <Scales size={16} />
                      <span>{getWeightLabel(listing.games.weight)} ({listing.games.weight.toFixed(1)} / 5)</span>
                    </div>
                  )}
                </div>
                {listing.games.categories && listing.games.categories.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {listing.games.categories.map((cat) => (
                        <Badge key={cat} variant="default">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {listing.games.mechanics && listing.games.mechanics.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Mechanics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {listing.games.mechanics.map((mech) => (
                        <Badge key={mech} variant="default">{mech}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {listing.games.description && (
                  <p className="text-sm text-semantic-text-secondary line-clamp-6">
                    {listing.games.description}
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
