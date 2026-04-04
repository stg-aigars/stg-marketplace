import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSellerRating, getSellerReviews } from '@/lib/reviews/service';
import { getSellerCompletedSales, calculateTrustTier } from '@/lib/services/sellers';
import { TrustBadge } from '@/components/sellers/TrustBadge';
import { formatDate } from '@/lib/date-utils';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { getSellerShelf } from '@/lib/shelves/actions';
import { Avatar, Card, CardBody, ShareButtons } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { SellerRating } from '@/components/reviews';
import { ReviewItem } from '@/components/reviews';
import { SellerShelfSection } from './SellerShelfSection';
import type { ListingCondition } from '@/lib/listings/types';

interface SellerProfile {
  id: string;
  full_name: string | null;
  country: string;
  created_at: string;
}

interface SellerListing {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  photos: string[];
  country: string;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean } | null;
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
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', id)
    .single();

  const name = profile?.full_name ?? 'Seller';
  const description = `${name} on Second Turn Games — pre-loved board games in the Baltic region.`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} | Second Turn Games`,
      description,
      type: 'profile',
    },
  };
}

export default async function SellerProfilePage(
  props: {
    params: Promise<{ id: string; locale: string }>;
  }
) {
  const params = await props.params;

  const {
    id
  } = params;

  const supabase = await createClient();

  // Fetch seller profile (public_profiles view — safe for anonymous access)
  const { data: profile } = await supabase
    .from('public_profiles')
    .select('id, full_name, country, created_at')
    .eq('id', id)
    .single<SellerProfile>();

  if (!profile) {
    notFound();
  }

  // Get current user (null for anonymous visitors)
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch rating, reviews, active listings, and shelf in parallel
  const [rating, reviews, completedSales, { data: listings }, shelfItems] = await Promise.all([
    getSellerRating(id),
    getSellerReviews(id, 10),
    getSellerCompletedSales(id),
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, photos, country, version_thumbnail, games(image, is_expansion)')
      .eq('seller_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(12)
      .returns<SellerListing[]>(),
    getSellerShelf(id),
  ]);

  const activeListings = listings ?? [];
  const sellerName = profile.full_name ?? 'Seller';

  // Fetch expansion counts and comment counts
  const listingIds = activeListings.map((l) => l.id);
  let expansionCounts: Record<string, number> = {};
  let commentCounts: Record<string, number> = {};
  if (listingIds.length > 0) {
    const [{ data: expansions }, { data: comments }] = await Promise.all([
      supabase
        .from('listing_expansions')
        .select('listing_id')
        .in('listing_id', listingIds),
      supabase
        .from('listing_comments')
        .select('listing_id')
        .in('listing_id', listingIds),
    ]);

    if (expansions) {
      expansionCounts = expansions.reduce((acc, e) => {
        acc[e.listing_id] = (acc[e.listing_id] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
    if (comments) {
      commentCounts = comments.reduce((acc, c) => {
        acc[c.listing_id] = (acc[c.listing_id] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Seller header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar name={sellerName} size="md" className="w-14 h-14 text-lg bg-gradient-to-br from-semantic-brand to-semantic-brand-active text-white" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
            {sellerName}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-semantic-text-secondary">
            {profile.country && (
              <span className="flex items-center gap-1">
                <span className={getCountryFlag(profile.country)} />
                {getCountryName(profile.country)}
              </span>
            )}
            <span>Member since {formatDate(new Date(profile.created_at))}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <SellerRating positivePct={rating.positivePct} ratingCount={rating.ratingCount} />
            <TrustBadge tier={calculateTrustTier(completedSales, rating.positivePct, rating.ratingCount)} />
          </div>
          <ShareButtons
            url={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/sellers/${id}`}
            title={sellerName}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 sm:gap-10 py-4 mb-8 border-y border-semantic-border-subtle text-sm text-semantic-text-muted">
        <div>
          <span className="block text-lg font-bold font-display text-semantic-text-heading">{completedSales}</span>
          {completedSales === 1 ? 'Sale' : 'Sales'}
        </div>
        <div className="w-px h-8 bg-semantic-border-subtle" />
        <div>
          <span className="block text-lg font-bold font-display text-semantic-text-heading">
            {rating.ratingCount > 0 ? `${rating.positivePct}%` : '\u2014'}
          </span>
          Positive
        </div>
        <div className="w-px h-8 bg-semantic-border-subtle" />
        <div>
          <span className="block text-lg font-bold font-display text-semantic-text-heading">{shelfItems.length}</span>
          On shelf
        </div>
        <div className="w-px h-8 bg-semantic-border-subtle" />
        <div>
          <span className="block text-lg font-bold font-display text-semantic-text-heading">{activeListings.length}</span>
          Listed
        </div>
      </div>

      {/* Game shelf section */}
      <SellerShelfSection
        items={shelfItems}
        sellerId={id}
        currentUserId={user?.id ?? null}
      />

      {/* Reviews section */}
      <section className="mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading mb-4">
          Reviews
        </h2>
        {reviews.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-semantic-text-muted">No reviews yet</p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <div className="divide-y divide-semantic-border-subtle">
                {reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </section>

      {/* Active listings section */}
      <section>
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading mb-4">
          Active listings
        </h2>
        {activeListings.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-semantic-text-muted">
                No active listings at the moment
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeListings.map((listing) => (
              <ListingCard
                key={listing.id}
                id={listing.id}
                gameTitle={listing.game_name}
                gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                photoCount={listing.photos?.length ?? 0}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
                expansionCount={expansionCounts[listing.id] ?? 0}
                commentCount={commentCounts[listing.id] ?? 0}
                isExpansion={listing.games?.is_expansion ?? false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
