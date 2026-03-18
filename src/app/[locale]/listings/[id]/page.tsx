import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Badge, Button } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { formatDate } from '@/lib/date-utils';
import { getWeightLabel } from '@/lib/bgg/utils';
import { PhotoGallery } from './PhotoGallery';

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
  };
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
  params: { id },
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
      '*, games(thumbnail, image, player_count, description, weight, categories, mechanics), user_profiles(full_name, country, created_at)'
    )
    .eq('id', id)
    .single<ListingDetailRow>();

  if (!listing) {
    notFound();
  }

  const isOwner = user?.id === listing.seller_id;

  // If listing is not active and viewer is not the seller, show unavailable message
  if (listing.status !== 'active' && !isOwner) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-semantic-text-muted mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
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
      <nav className="mb-4 text-sm text-semantic-text-muted flex items-center min-w-0">
        <Link href="/browse" className="shrink-0 sm:hover:text-semantic-text-secondary transition-colors">
          Browse
        </Link>
        <span className="mx-2 shrink-0">/</span>
        <span className="text-semantic-text-secondary truncate">{listing.game_name}</span>
      </nav>

      {/* Owner status banner for non-active listings */}
      {isOwner && listing.status !== 'active' && (
        <div className="mb-6 p-4 rounded-lg bg-semantic-bg-subtle border border-semantic-border-subtle">
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
        </div>
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
            <p className="text-3xl font-bold text-semantic-text-heading">
              {formatCentsToCurrency(listing.price_cents)}
            </p>
            {isOwner ? (
              <div className="flex gap-3">
                <Button variant="secondary" disabled>
                  Edit listing
                </Button>
                <Button variant="danger" disabled>
                  Remove listing
                </Button>
              </div>
            ) : (
              <Link href={`/checkout/${listing.id}`}>
                <Button>Buy now</Button>
              </Link>
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
            <div className="border border-semantic-border-subtle rounded-lg p-4 space-y-2">
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
            </div>
          )}

          {/* Seller info */}
          <div className="border border-semantic-border-subtle rounded-lg p-4">
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Seller
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-snow-storm-light flex items-center justify-center text-semantic-text-muted font-medium">
                {(listing.user_profiles?.full_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-semantic-text-heading">
                  {listing.user_profiles?.full_name ?? 'Anonymous'}
                </p>
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
                </div>
              </div>
            </div>
          </div>

          {/* Game details from BGG */}
          {(listing.games?.player_count || listing.games?.weight || listing.games?.description) && (
            <div className="border border-semantic-border-subtle rounded-lg p-4 space-y-3">
              <h2 className="text-base font-semibold text-semantic-text-heading">
                Game details
              </h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {listing.games.player_count && (
                  <div className="flex items-center gap-2 text-sm text-semantic-text-secondary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                      />
                    </svg>
                    <span>{listing.games.player_count} players</span>
                  </div>
                )}
                {listing.games.weight != null && listing.games.weight > 0 && (
                  <div className="flex items-center gap-2 text-sm text-semantic-text-secondary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
                      />
                    </svg>
                    <span>{getWeightLabel(listing.games.weight)} ({listing.games.weight.toFixed(1)} / 5)</span>
                  </div>
                )}
              </div>
              {listing.games.categories && listing.games.categories.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {listing.games.categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-block px-2 py-0.5 text-xs rounded-full bg-semantic-bg-subtle text-semantic-text-secondary"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {listing.games.mechanics && listing.games.mechanics.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Mechanics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {listing.games.mechanics.map((mech) => (
                      <span
                        key={mech}
                        className="inline-block px-2 py-0.5 text-xs rounded-full bg-semantic-bg-subtle text-semantic-text-secondary"
                      >
                        {mech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {listing.games.description && (
                <p className="text-sm text-semantic-text-secondary line-clamp-6">
                  {listing.games.description}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
