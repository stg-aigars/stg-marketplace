import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSellerRating, getSellerReviews } from '@/lib/reviews/service';
import { getSellerCompletedSales, calculateTrustTier } from '@/lib/services/sellers';
import { TrustBadge } from '@/components/sellers/TrustBadge';
import { formatMonthYear } from '@/lib/date-utils';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { Avatar, Card, CardBody, Pagination, ShareButtons } from '@/components/ui';
import { ListingSection } from '@/components/listings/ListingSection';
import { getListingCardCounts } from '@/lib/listings/queries';
import { SellerRating } from '@/components/reviews';
import { ReviewItem } from '@/components/reviews';
import { SellerProfileAnalytics } from '@/components/analytics/SellerProfileAnalytics';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildSellerProfileJsonLd } from '@/lib/seo/seller-profile-json-ld';
import { env } from '@/lib/env';
import type { ListingCondition } from '@/lib/listings/types';
import { PAGE_HEADING_CLASS, SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

interface SellerProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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
  status: string;
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
    .from('public_profiles')
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

const PAGE_SIZE = 12;

export default async function SellerProfilePage(
  props: {
    params: Promise<{ id: string; locale: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const params = await props.params;

  const {
    id
  } = params;

  const rawPage = (await props.searchParams).page;
  const parsedPage = typeof rawPage === 'string' ? parseInt(rawPage, 10) : NaN;
  const requestedPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const from = (requestedPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Fetch seller profile (public_profiles view — safe for anonymous access)
  const { data: profile } = await supabase
    .from('public_profiles')
    .select('id, full_name, avatar_url, country, created_at')
    .eq('id', id)
    .single<SellerProfile>();

  if (!profile) {
    notFound();
  }

  // Count is queried separately from the grid so it stays accurate if the grid query becomes paginated.
  const [rating, reviews, completedSales, { data: listings }, { count: listingsCount }] = await Promise.all([
    getSellerRating(id),
    getSellerReviews(id, 10),
    getSellerCompletedSales(id),
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, photos, country, status, version_thumbnail, games(image, is_expansion)')
      .eq('seller_id', id)
      .in('status', ['active', 'reserved'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
      .returns<SellerListing[]>(),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', id)
      .in('status', ['active', 'reserved']),
  ]);

  const activeListings = listings ?? [];
  // Floor against a silent count-query failure: never display fewer than the cards visibly on screen.
  // Page-aware: on page N the visible cards represent items [from+1 .. from+activeListings.length],
  // so the floor is `from + activeListings.length`. When the page is out of range the slice is empty,
  // and the floor falls back to listingsCount alone so the redirect targets the correct last page.
  const totalListingCount = Math.max(
    activeListings.length > 0 ? from + activeListings.length : 0,
    listingsCount ?? 0,
  );
  const totalPages = Math.max(1, Math.ceil(totalListingCount / PAGE_SIZE));

  if (requestedPage > totalPages) {
    redirect(totalPages > 1 ? `/sellers/${id}?page=${totalPages}` : `/sellers/${id}`);
  }

  const sellerName = profile.full_name ?? 'Seller';

  const { expansionCounts, commentCounts } = await getListingCardCounts(
    supabase,
    activeListings.map((l) => l.id)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <JsonLd data={buildSellerProfileJsonLd({
        sellerId: id,
        name: sellerName,
        avatarUrl: profile.avatar_url,
        country: profile.country,
      }, env.app.url)} />
      {requestedPage === 1 && <SellerProfileAnalytics sellerId={id} listingCount={totalListingCount} />}
      {/* Seller header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar name={sellerName} src={profile.avatar_url} size="lg" />
        <div>
          <h1 className={PAGE_HEADING_CLASS}>
            {sellerName}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-semantic-text-secondary">
            {profile.country && (
              <span className="flex items-center gap-1">
                <span className={getCountryFlag(profile.country)} />
                {getCountryName(profile.country)}
              </span>
            )}
            <span>Member since {formatMonthYear(new Date(profile.created_at))}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <SellerRating positivePct={rating.positivePct} ratingCount={rating.ratingCount} reviewsHref="#reviews" />
            <TrustBadge tier={calculateTrustTier(completedSales, rating.positivePct, rating.ratingCount)} />
          </div>
          <ShareButtons
            url={`${env.app.url}/sellers/${id}`}
            title={sellerName}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 sm:gap-10 py-4 mb-8 border-y border-semantic-border-subtle text-sm text-semantic-text-muted">
        <div>
          <span className="block text-lg font-extrabold text-semantic-text-heading">{completedSales}</span>
          {completedSales === 1 ? 'Sale' : 'Sales'}
        </div>
        <div className="w-px h-8 bg-semantic-border-subtle" />
        <div>
          <span className="block text-lg font-extrabold text-semantic-text-heading">
            {rating.ratingCount > 0 ? `${rating.positivePct}%` : '\u2014'}
          </span>
          Positive
        </div>
        <div className="w-px h-8 bg-semantic-border-subtle" />
        <div>
          <span className="block text-lg font-extrabold text-semantic-text-heading">{totalListingCount}</span>
          Listed
        </div>
      </div>

      {/* Reviews section */}
      <section id="reviews" className="mb-8 scroll-mt-20">
        <h2 className={cn(SECTION_HEADING_CLASS, 'mb-4')}>
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
      <ListingSection
        heading="Active listings"
        listings={activeListings}
        expansionCounts={expansionCounts}
        commentCounts={commentCounts}
        emptyState={
          <Card>
            <CardBody>
              <p className="text-sm text-semantic-text-muted">
                No active listings at the moment
              </p>
            </CardBody>
          </Card>
        }
      />

      <Pagination
        currentPage={requestedPage}
        totalPages={totalPages}
        totalItems={totalListingCount}
        pageSize={PAGE_SIZE}
        buildUrl={(p) => p === 1 ? `/sellers/${id}` : `/sellers/${id}?page=${p}`}
      />
    </div>
  );
}
