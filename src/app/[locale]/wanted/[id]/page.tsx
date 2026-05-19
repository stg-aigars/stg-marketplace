import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageSquare, Tag, Translate, Buildings, CalendarBlank, MagnifyingGlass, CaretRight, Flag } from '@phosphor-icons/react/ssr';
import { Card, CardBody, ShareButtons, Breadcrumb, Avatar, Alert, Button } from '@/components/ui';
import { GameDetailsCard } from '@/components/game/GameDetailsCard';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { toBggFullSize, isBggImage, formatPlayerCount, formatPlayingTime } from '@/lib/bgg/utils';
import { formatDate, formatMonthYear, formatRelativeTime } from '@/lib/date-utils';
import { createClient } from '@/lib/supabase/server';
import { getWantedListingById } from '@/lib/wanted/actions';
import { RelatedWants } from './RelatedWants';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const listing = await getWantedListingById(params.id);
  if (!listing) return { title: 'Not found' };

  const edition = listing.language ? ` (${listing.language} edition)` : '';
  const description = `Someone is looking for ${listing.game_name}${edition}. If you have a copy, you can list it for sale on Second Turn Games.`;

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

  const [listing, supabase] = await Promise.all([
    getWantedListingById(params.id),
    createClient(),
  ]);

  if (!listing) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === listing.buyer_id;

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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://secondturn.games';
  const hasEditionDetails =
    hasEdition && (listing.version_name || listing.language || listing.publisher || listing.edition_year);

  // Title card markup, captured once and rendered into two layout slots:
  // - On mobile, above the game image (`lg:hidden` wrapper)
  // - On desktop, as the first item in the right column (`hidden lg:block` wrapper)
  // Mirrors the dual-slot pattern in the listing detail page.
  const titleCard = (
    <Card>
      <CardBody className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          {listing.game_name}
        </h1>

        <hr className="border-semantic-border-subtle" />

        {hasEditionDetails ? (
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

        <p className="text-sm text-semantic-text-muted" title={formatDate(listing.created_at)}>
          Posted {formatRelativeTime(listing.created_at)}
        </p>
      </CardBody>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Breadcrumb
        items={[
          { label: 'Wanted', href: '/wanted' },
          { label: listing.game_name },
        ]}
      />

      {/* Mobile-only: title above image (above-the-fold hierarchy) */}
      <div className="lg:hidden mb-6">{titleCard}</div>

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
          {/* Desktop-only: title card sits first in the right column */}
          <div className="hidden lg:block">{titleCard}</div>

          {!isOwner && (
            <Alert variant="info" icon={<MagnifyingGlass size={20} />} title="Someone is looking for this game">
              <p>If you have a copy, you can list it for sale.</p>
              <div className="mt-3">
                <Button asChild variant="primary" size="sm">
                  {user ? (
                    <Link href="/sell">List this game for sale</Link>
                  ) : (
                    <Link href="/auth/signin?returnUrl=/sell">Sign in to list it</Link>
                  )}
                </Button>
              </div>
            </Alert>
          )}

          {/* Notes from buyer */}
          {listing.notes && (
            <Card>
              <CardBody>
                <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-2')}>
                  Notes from buyer
                </h2>
                <p className="text-semantic-text-secondary whitespace-pre-line">
                  {listing.notes}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Buyer info — mirrors seller-card pattern on listing detail */}
          <Card>
            <CardBody>
              <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-3')}>
                Buyer
              </h2>

              <Link
                href={`/sellers/${listing.buyer_id}`}
                className="group flex items-center gap-4"
              >
                <Avatar
                  name={listing.buyer_name || '?'}
                  src={listing.buyer_avatar_url}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-2 font-medium text-semantic-text-heading group-hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
                    <span className="truncate">
                      {listing.buyer_name || 'Anonymous'}
                    </span>
                    {buyerFlagClass && (
                      <span
                        className={`${buyerFlagClass} shrink-0`}
                        title={buyerCountryName}
                        aria-label={buyerCountryName}
                      />
                    )}
                  </p>
                  {listing.buyer_created_at && (
                    <p className="text-sm text-semantic-text-muted">
                      Member since {formatMonthYear(listing.buyer_created_at)}
                    </p>
                  )}
                </div>
                <CaretRight
                  size={20}
                  className="shrink-0 text-semantic-text-muted group-hover:text-semantic-brand transition-colors duration-250 ease-out-custom"
                />
              </Link>
            </CardBody>
          </Card>

          {/* Share + Report (utility actions) — mirrors listing detail */}
          <div className="flex items-center gap-3">
            <ShareButtons
              url={`${baseUrl}/wanted/${listing.id}`}
              title={`Wanted: ${listing.game_name}`}
            />
            {/* DSA Art. 16 — entry to the notice-and-action queue, deep-linked with this wanted listing */}
            <Button variant="ghost" size="sm" asChild className="ml-auto">
              <Link
                href={`/report-illegal-content?contentReference=${encodeURIComponent(`${baseUrl}/wanted/${listing.id}`)}`}
              >
                <Flag size={16} className="mr-1.5" />
                Report
              </Link>
            </Button>
          </div>

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
