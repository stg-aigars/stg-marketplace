import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Prohibit, Users, Scales, Timer, Baby, Package, Translate, Buildings, CalendarBlank, Tag } from '@phosphor-icons/react/ssr';
import { Alert, Avatar, Badge, Breadcrumb, Button, Card, CardBody, ShareButtons, ShowMoreText, ShowMoreList } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition, type ListingStatus, type ListingType } from '@/lib/listings/types';
import { formatDate } from '@/lib/date-utils';
import { decodeHTMLEntities, getWeightLabel, toBggFullSize } from '@/lib/bgg/utils';
import { getShippingPriceCents, getMinShippingPriceCents, isTerminalCountry } from '@/lib/services/unisend/types';
import { PhotoGallery } from './PhotoGallery';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { SellerRating } from '@/components/reviews';
import { BidPanel } from '@/components/auctions/BidPanel';
import { getBidHistory, getAuctionState } from '@/lib/auctions/actions';
import { getSellerRating } from '@/lib/reviews/service';
import { getSellerCompletedSales, calculateTrustTier } from '@/lib/services/sellers';
import { TrustBadge } from '@/components/sellers/TrustBadge';
import { ReservationCountdown } from '@/components/listings/ReservationCountdown';
import { AddToCartButton } from '@/components/listings/AddToCartButton';
import { GameThumb, GameIdentityRow } from '@/components/listings/atoms';
import { OwnerActions } from './OwnerActions';
import { getComments } from '@/lib/comments/actions';
import { CommentList } from '@/components/comments/CommentList';
import { CommentForm } from '@/components/comments/CommentForm';
import { PurchaseSection } from './PurchaseSection';

interface ListingDetailRow {
  id: string;
  bgg_game_id: number;
  seller_id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  description: string | null;
  status: ListingStatus;
  photos: string[];
  country: string;
  version_source: string;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  reserved_at: string | null;
  reserved_by: string | null;
  version_thumbnail: string | null;
  listing_type: ListingType;
  auction_end_at: string | null;
  starting_price_cents: number | null;
  current_bid_cents: number | null;
  bid_count: number;
  highest_bidder_id: string | null;
  created_at: string;
  games: {
    name: string;
    yearpublished: number | null;
    thumbnail: string | null;
    image: string | null;
    player_count: string | null;
    min_players: number | null;
    max_players: number | null;
    min_age: number | null;
    playing_time: string | null;
    description: string | null;
    weight: number | null;
    categories: string[] | null;
    mechanics: string[] | null;
    is_expansion: boolean;
  };
  user_profiles: {
    full_name: string | null;
    country: string;
    created_at: string;
  } | null;
}

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    id
  } = params;

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

export default async function ListingDetailPage(
  props: {
    params: Promise<{ id: string; locale: string }>;
  }
) {
  const params = await props.params;

  const {
    id,
    locale
  } = params;

  const supabase = await createClient();

  // Get current user (optional — don't redirect if not authenticated)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listing } = await supabase
    .from('listings')
    .select(
      '*, games(name, yearpublished, thumbnail, image, player_count, min_players, max_players, min_age, playing_time, description, weight, categories, mechanics, is_expansion)'
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

  // Fetch seller rating, completed sales, listing expansions, buyer profile, and comments in parallel
  const [sellerRating, sellerCompletedSales, { data: listingExpansions }, buyerProfileResult, comments] = await Promise.all([
    getSellerRating(listing.seller_id),
    getSellerCompletedSales(listing.seller_id),
    supabase
      .from('listing_expansions')
      .select('bgg_game_id, game_name, version_name, publisher, language, edition_year, games(thumbnail)')
      .eq('listing_id', id)
      .order('created_at'),
    // Single query for buyer's country + staff flag (avoids two round-trips to user_profiles)
    user
      ? supabase.from('user_profiles').select('country, is_staff').eq('id', user.id).single<{ country: string; is_staff: boolean }>()
      : Promise.resolve({ data: null }),
    getComments(id, listing.seller_id),
  ]);

  const isStaff = buyerProfileResult?.data?.is_staff ?? false;

  const isAuction = listing.listing_type === 'auction';

  // Fetch auction data if applicable
  const [auctionState, bidHistory] = isAuction
    ? await Promise.all([getAuctionState(id), getBidHistory(id)])
    : [null, []];

  const isReserver = listing.status === 'reserved' && listing.reserved_by === user?.id;
  const showMobileBuyBar = !isOwner && !isAuction && (listing.status === 'active' || isReserver);

  // If listing is not active/reserved and viewer is not the seller, show unavailable message
  if (listing.status !== 'active' && listing.status !== 'reserved' && listing.status !== 'auction_ended' && !isOwner) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-16">
          <Prohibit size={64} className="mx-auto text-semantic-text-muted mb-4" />
          <h1 className="text-2xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
            This listing is no longer available
          </h1>
          <p className="text-semantic-text-secondary mb-6">
            It may have been sold or removed by the seller.
          </p>
          <Button variant="secondary" asChild>
            <Link href="/browse">Browse other games</Link>
          </Button>
        </div>
      </div>
    );
  }

  const badgeKey = conditionToBadgeKey[listing.condition];
  const conditionInfo = conditionConfig[badgeKey];
  const sellerFlagClass = getCountryFlag(listing.user_profiles?.country);
  const sellerCountryName = getCountryName(listing.user_profiles?.country);
  const gameImage = toBggFullSize(listing.version_thumbnail) ?? toBggFullSize(listing.games?.image) ?? toBggFullSize(listing.games?.thumbnail) ?? null;

  // Shipping price calculation
  const sellerCountry = listing.country;
  const buyerCountry = !isOwner ? (buyerProfileResult?.data?.country ?? null) : null;
  let shippingCents: number | null = null;
  let shippingFromCents: number | null = null;

  if (buyerCountry && isTerminalCountry(sellerCountry) && isTerminalCountry(buyerCountry)) {
    // Signed-in user with known country — show exact rate
    shippingCents = getShippingPriceCents(sellerCountry, buyerCountry);
  } else if (isTerminalCountry(sellerCountry)) {
    // Signed-out or non-Baltic buyer — show cheapest rate from seller's country
    shippingFromCents = getMinShippingPriceCents(sellerCountry);
  }

  // Player count display
  const games = listing.games;
  const playerCountDisplay = games?.min_players
    ? games.max_players && games.max_players !== games.min_players
      ? `${games.min_players}–${games.max_players}`
      : `${games.min_players}`
    : games?.player_count ?? null;

  // Playing time display
  const playingTime = games?.playing_time && games.playing_time !== '0' ? games.playing_time : null;

  // Expansion count for header
  const expansionCount = listingExpansions?.length ?? 0;

  const hasGameDetails = playerCountDisplay || playingTime || (games?.weight != null && games.weight > 0) || (games?.min_age != null && games.min_age > 0) || games?.categories?.length || games?.mechanics?.length || games?.description;

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
              className="text-sm text-semantic-brand font-medium mt-2 inline-block"
            >
              View your orders
            </Link>
          )}
        </Alert>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: Photos + Game details (desktop only) */}
        <div className="space-y-6">
          <PhotoGallery
            photos={listing.photos ?? []}
            gameImage={gameImage}
            gameTitle={listing.game_name}
          />
          {/* Game details — desktop only (mobile copy is at the bottom of right column) */}
          {hasGameDetails && (
            <div className="hidden lg:block">
              <GameDetailsCard
                games={games}
                bggGameId={listing.bgg_game_id}
                listingGameName={listing.game_name}
                playerCountDisplay={playerCountDisplay}
                playingTime={playingTime}
              />
            </div>
          )}
        </div>

        {/* Right column: About this copy */}
        <div className="space-y-6">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
            {listing.game_name}
          </h1>

          {games?.is_expansion && (
            <Alert variant="info">
              This is an expansion — it requires a base game to play.
            </Alert>
          )}

          {/* Edition details — compact icon row */}
          {(listing.version_name || listing.language || listing.publisher || listing.edition_year) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-semantic-text-muted">
              {listing.version_name && (
                <div className="flex items-center gap-1.5">
                  <Tag size={15} className="flex-shrink-0" />
                  <span>{listing.version_name}</span>
                </div>
              )}
              {listing.language && (
                <div className="flex items-center gap-1.5">
                  <Translate size={15} className="flex-shrink-0" />
                  <span>{listing.language}</span>
                </div>
              )}
              {listing.publisher && (
                <div className="flex items-center gap-1.5">
                  <Buildings size={15} className="flex-shrink-0" />
                  <span>{listing.publisher}</span>
                </div>
              )}
              {listing.edition_year && (
                <div className="flex items-center gap-1.5">
                  <CalendarBlank size={15} className="flex-shrink-0" />
                  <span>{listing.edition_year}</span>
                </div>
              )}
            </div>
          )}

          {/* Price & action */}
          <PurchaseSection
            listingId={listing.id}
            priceCents={listing.price_cents}
            isReservedByMe={isReserver}
            showMobileBuyBar={showMobileBuyBar}
          >
          <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              {isAuction ? (
                <Badge variant="auction">Auction</Badge>
              ) : (
                <p className="text-3xl font-bold font-sans tracking-tight text-semantic-text-heading">
                  {formatCentsToCurrency(listing.price_cents)}
                </p>
              )}
            </div>

            {/* Shipping estimate */}
            {!isOwner && (
              <div className="flex items-center gap-2 text-sm text-semantic-text-muted">
                <Package size={16} className="flex-shrink-0" />
                {shippingCents != null ? (
                  <span>Shipping {formatCentsToCurrency(shippingCents)} · Ships from {sellerCountryName}</span>
                ) : shippingFromCents != null ? (
                  <span>Shipping from {formatCentsToCurrency(shippingFromCents)} · Ships from {sellerCountryName}</span>
                ) : (
                  <span>Ships from {sellerCountryName}</span>
                )}
              </div>
            )}

            {isAuction && auctionState ? (
              <>
                <BidPanel
                  listingId={listing.id}
                  initialState={auctionState}
                  bids={bidHistory}
                  currentUserId={user?.id ?? null}
                  sellerId={listing.seller_id}
                />
                {isOwner && (
                  <OwnerActions listingId={listing.id} status={listing.status} listingType={listing.listing_type} bidCount={listing.bid_count} locale={locale} />
                )}
              </>
            ) : isOwner ? (
              <OwnerActions listingId={listing.id} status={listing.status} listingType={listing.listing_type} bidCount={listing.bid_count} locale={locale} />
            ) : listing.status === 'reserved' && !isReserver ? (
              /* Another buyer has reserved this listing */
              (<ReservationCountdown reservedAt={listing.reserved_at!} />)
            ) : listing.status === 'reserved' && isReserver ? (
              /* This buyer reserved it — prompt them to complete payment */
              (<div className="space-y-3">
                <Card>
                  <CardBody>
                    <p className="text-sm text-semantic-text-secondary">
                      You have reserved this game. Complete your payment to secure it.
                    </p>
                  </CardBody>
                </Card>
                <Button asChild>
                  <Link href={`/checkout/${listing.id}`}>Complete payment</Link>
                </Button>
              </div>)
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={`/checkout/${listing.id}`}>Buy now</Link>
                </Button>
                <AddToCartButton
                  listing={{
                    id: listing.id,
                    gameTitle: listing.game_name,
                    gameThumbnail: listing.games?.thumbnail ?? null,
                    priceCents: listing.price_cents,
                    sellerCountry: listing.country,
                    sellerId: listing.seller_id,
                    condition: listing.condition,
                    expansionCount: expansionCount,
                  }}
                />
              </div>
            )}
          </CardBody>
          </Card>
          </PurchaseSection>

          {/* Included expansions */}
          {listingExpansions && expansionCount > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-semantic-text-heading">
                {expansionCount === 1
                  ? 'Included expansion'
                  : `Included expansions (${expansionCount})`}
              </h2>
              <div className="space-y-2">
                <ShowMoreList maxItems={2} label="expansions">
                  {listingExpansions.map((exp: { bgg_game_id: number; game_name: string; version_name: string | null; publisher: string | null; language: string | null; edition_year: number | null; games: { thumbnail: string | null } | { thumbnail: string | null }[] | null }) => {
                    const thumbnail = Array.isArray(exp.games) ? exp.games[0]?.thumbnail : exp.games?.thumbnail;
                    return (
                      <Card key={exp.bgg_game_id}>
                        <CardBody>
                          <GameIdentityRow
                            thumbnail={thumbnail ?? null}
                            name={exp.game_name}
                            href={`https://boardgamegeek.com/boardgame/${exp.bgg_game_id}`}
                            target="_blank"
                            versionName={exp.version_name}
                            language={exp.language}
                            publisher={exp.publisher}
                            year={exp.edition_year}
                          />
                        </CardBody>
                      </Card>
                    );
                  })}
                </ShowMoreList>
              </div>
            </div>
          )}

          {/* Condition & notes */}
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-2">
                Condition & notes
              </h2>
              <div className="flex items-center gap-3">
                <Badge condition={badgeKey}>{conditionInfo.label}</Badge>
                <span className="text-sm text-semantic-text-muted">
                  {conditionInfo.description}
                </span>
              </div>
              {listing.description && (
                <p className="text-semantic-text-secondary whitespace-pre-line mt-3">
                  {listing.description}
                </p>
              )}
            </CardBody>
          </Card>

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
                    className="font-medium text-semantic-text-heading sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom"
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

          {/* Share + Favorite (utility actions) */}
          <div className="flex items-center gap-3">
            <ShareButtons
              url={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/listings/${listing.id}`}
              title={listing.game_name}
            />
            {!isOwner && (
              <FavoriteButton
                listingId={listing.id}
                initialFavorited={isFavorited}
                isAuthenticated={!!user}
              />
            )}
          </div>

          {/* Comments — hide entirely for anonymous users when empty */}
          {(comments.length > 0 || user) && (
            <section id="comments">
              <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
                Comments{comments.length > 0 ? ` (${comments.length})` : ''}
              </h2>
              <Card>
                <CardBody>
                  <CommentList comments={comments} isStaff={isStaff} locale={locale} />
                </CardBody>
                {user && (
                  <div className="border-t border-semantic-border-subtle px-4 py-3 sm:px-5">
                    <CommentForm listingId={id} />
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* Game details — mobile only (desktop copy is in the left column) */}
          {hasGameDetails && (
            <div className="lg:hidden">
              <GameDetailsCard
                games={games}
                bggGameId={listing.bgg_game_id}
                listingGameName={listing.game_name}
                playerCountDisplay={playerCountDisplay}
                playingTime={playingTime}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GameDetailsCard({ games, bggGameId, listingGameName, playerCountDisplay, playingTime }: {
  games: ListingDetailRow['games'];
  bggGameId: number;
  listingGameName: string;
  playerCountDisplay: string | null;
  playingTime: string | null;
}) {
  const displayName = games?.name ?? listingGameName;

  return (
    <Card>
      {/* BGG attribution */}
      <div className="border-b border-semantic-border-subtle px-4 py-3">
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block opacity-60 hover:opacity-100 transition-opacity duration-250 ease-out-custom"
        >
          <Image
            src="/images/powered-by-bgg.svg"
            alt="Powered by BoardGameGeek"
            width={120}
            height={28}
            className="h-7 w-auto"
            unoptimized
          />
        </a>
      </div>
      <CardBody className="space-y-3">
        {/* Game identity — same layout as expansion cards */}
        <div className="flex items-center gap-4">
          <GameThumb src={games?.thumbnail} alt={displayName} size="xl" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-semantic-text-primary truncate">
              <a
                href={`https://boardgamegeek.com/boardgame/${bggGameId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-semantic-brand transition-colors duration-250 ease-out-custom"
              >
                {displayName}
              </a>
              {games?.yearpublished && (
                <span className="text-semantic-text-muted">
                  {' · '}{games.yearpublished}
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-semantic-text-muted mt-0.5">
              {playerCountDisplay && (
                <span className="flex items-center gap-1">
                  <Users size={13} className="shrink-0" />
                  {playerCountDisplay}
                </span>
              )}
              {games?.min_age != null && games.min_age > 0 && (
                <span className="flex items-center gap-1">
                  <Baby size={13} className="shrink-0" />
                  {games.min_age}+
                </span>
              )}
              {playingTime && (
                <span className="flex items-center gap-1">
                  <Timer size={13} className="shrink-0" />
                  {playingTime} min
                </span>
              )}
              {games?.weight != null && games.weight > 0 && (
                <span className="flex items-center gap-1">
                  <Scales size={13} className="shrink-0" />
                  {getWeightLabel(games.weight)} ({games.weight.toFixed(1)}/5)
                </span>
              )}
            </div>
          </div>
        </div>
        {games?.categories && games.categories.length > 0 && (
          <div>
            <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {games.categories.map((cat) => (
                <Badge key={cat} variant="default">{cat}</Badge>
              ))}
            </div>
          </div>
        )}
        {games?.mechanics && games.mechanics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Mechanics</p>
            <div className="flex flex-wrap gap-1.5">
              {games.mechanics.map((mech) => (
                <Badge key={mech} variant="default">{mech}</Badge>
              ))}
            </div>
          </div>
        )}
        {games?.description && (
          <ShowMoreText lines={4} className="text-sm text-semantic-text-secondary">
            {decodeHTMLEntities(games.description)}
          </ShowMoreText>
        )}
      </CardBody>
    </Card>
  );
}
