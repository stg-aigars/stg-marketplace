import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ImageSquare, Tag, Translate, Buildings, CalendarBlank } from '@phosphor-icons/react/ssr';
import { Card, CardBody, ShareButtons, Breadcrumb, Avatar } from '@/components/ui';
import { GameDetailsCard } from '@/components/game/GameDetailsCard';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { toBggFullSize, isBggImage, formatPlayerCount, formatPlayingTime } from '@/lib/bgg/utils';
import { formatDate } from '@/lib/date-utils';
import { getWantedListingById } from '@/lib/wanted/actions';
import { RelatedWants } from './RelatedWants';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const listing = await getWantedListingById(params.id);
  if (!listing) return { title: 'Not found' };

  const description = listing.language
    ? `Looking for ${listing.game_name} (${listing.language} edition)`
    : `Looking for ${listing.game_name}`;

  return {
    title: `Wanted: ${listing.game_name}`,
    description,
    openGraph: {
      title: `Wanted: ${listing.game_name} | Second Turn Games`,
      description,
      ...(listing.image ? { images: [{ url: listing.image }] } : {}),
    },
  };
}

export default async function WantedDetailPage(props: Props) {
  const params = await props.params;
  const listing = await getWantedListingById(params.id);

  if (!listing) notFound();

  const hasEdition = listing.version_source !== null;
  const gameImage =
    toBggFullSize(listing.version_thumbnail) ??
    toBggFullSize(listing.image) ??
    toBggFullSize(listing.thumbnail) ??
    null;

  const playerCountDisplay = formatPlayerCount(listing.min_players, listing.max_players, listing.player_count);
  const playingTime = formatPlayingTime(listing.playing_time);

  const hasGameDetails =
    playerCountDisplay ||
    playingTime ||
    (listing.weight != null && listing.weight > 0) ||
    (listing.min_age != null && listing.min_age > 0) ||
    (listing.categories?.length ?? 0) > 0 ||
    (listing.mechanics?.length ?? 0) > 0 ||
    listing.description;

  const gamesForCard = {
    name: listing.game_display_name ?? listing.game_name,
    yearpublished: listing.game_year_published,
    thumbnail: listing.thumbnail,
    min_age: listing.min_age,
    description: listing.description,
    weight: listing.weight,
    categories: listing.categories,
    mechanics: listing.mechanics,
  };

  const buyerCountryName = getCountryName(listing.country);
  const buyerFlagClass = getCountryFlag(listing.country);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Breadcrumb
        items={[
          { label: 'Wanted', href: '/wanted' },
          { label: listing.game_name },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: Game image hero + Game details (desktop only) */}
        <div className="space-y-6">
          <Card>
            <div className="relative aspect-square bg-semantic-bg-surface rounded-lg overflow-hidden flex items-center justify-center">
              {gameImage ? (
                <Image
                  src={gameImage}
                  alt={listing.game_name}
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  unoptimized={isBggImage(gameImage)}
                  priority
                />
              ) : (
                <ImageSquare size={96} className="text-semantic-text-muted" />
              )}
            </div>
          </Card>

          {hasGameDetails && (
            <div className="hidden lg:block">
              <GameDetailsCard
                games={gamesForCard}
                bggGameId={listing.bgg_game_id}
                listingGameName={listing.game_name}
                playerCountDisplay={playerCountDisplay}
                playingTime={playingTime}
              />
            </div>
          )}
        </div>

        {/* Right column: About this want */}
        <div className="space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
            {listing.game_name}
          </h1>

          {/* Edition details — compact icon row */}
          {hasEdition && (listing.version_name || listing.language || listing.publisher || listing.edition_year) ? (
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
          ) : (
            <p className="text-sm text-semantic-text-muted">Any edition</p>
          )}

          {/* Buyer info */}
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
                Buyer
              </h2>
              <div className="flex items-center gap-3">
                <Avatar name={listing.buyer_name || '?'} src={listing.buyer_avatar_url} />
                <div>
                  <p className="font-medium text-semantic-text-heading">
                    {listing.buyer_name || 'Anonymous'}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-semantic-text-muted">
                    {buyerFlagClass && (
                      <span className={`${buyerFlagClass}`} title={buyerCountryName} />
                    )}
                    <span>{buyerCountryName}</span>
                    {listing.buyer_created_at && (
                      <>
                        <span className="mx-1">&middot;</span>
                        <span>Member since {formatDate(listing.buyer_created_at)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Notes from buyer */}
          {listing.notes && (
            <Card>
              <CardBody>
                <h2 className="text-base font-semibold text-semantic-text-heading mb-2">
                  Notes from buyer
                </h2>
                <p className="text-semantic-text-secondary whitespace-pre-line">
                  {listing.notes}
                </p>
              </CardBody>
            </Card>
          )}

          <ShareButtons
            url={`${process.env.NEXT_PUBLIC_APP_URL || 'https://secondturn.games'}/wanted/${listing.id}`}
            title={`Wanted: ${listing.game_name}`}
          />

          {/* Game details — mobile only (desktop copy is in the left column) */}
          {hasGameDetails && (
            <div className="lg:hidden">
              <GameDetailsCard
                games={gamesForCard}
                bggGameId={listing.bgg_game_id}
                listingGameName={listing.game_name}
                playerCountDisplay={playerCountDisplay}
                playingTime={playingTime}
              />
            </div>
          )}
        </div>
      </div>

      <RelatedWants
        listingId={listing.id}
        bggGameId={listing.bgg_game_id}
        buyerId={listing.buyer_id}
        gameName={listing.game_name}
        buyerName={listing.buyer_name || 'this buyer'}
      />
    </div>
  );
}
