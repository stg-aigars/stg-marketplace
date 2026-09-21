import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSellerRating, getSellerReviews } from '@/lib/reviews/service';
import { getSellerCompletedSales } from '@/lib/services/sellers';
import { SellerBadgesRow } from '@/components/sellers/SellerBadgesRow';
import { formatMonthYear } from '@/lib/date-utils';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { Avatar, Card, CardBody, NavTabs, Pagination, ShareButtons } from '@/components/ui';
import { MessageSellerCTA } from '@/components/messaging/MessageSellerCTA';
import { ListingSection } from '@/components/listings/ListingSection';
import { getListingCardCounts } from '@/lib/listings/queries';
import { ReviewItem } from '@/components/reviews';
import { SellerProfileAnalytics } from '@/components/analytics/SellerProfileAnalytics';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildSellerProfileJsonLd } from '@/lib/seo/seller-profile-json-ld';
import { env } from '@/lib/env';
import type { ListingCondition } from '@/lib/listings/types';
import { PAGE_HEADING_CLASS, SECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import { parseSellerProfileSearchParams } from './_lib/parse-search-params';

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
  previous_price_cents: number | null;
  price_changed_at: string | null;
  photos: string[];
  country: string;
  status: string;
  listing_type: 'fixed_price' | 'auction';
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

  const { activeTab, requestedPage } = parseSellerProfileSearchParams(await props.searchParams);
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

  // Only one of {reviews, listings} is ever needed, based on activeTab — folded into a
  // single discriminated-union Promise.all slot so the array shape stays flat instead of
  // carrying two mostly-unused fallback slots. Building listingsQuery costs nothing until
  // awaited (Supabase query builders are lazy thenables), so it's safe to construct
  // unconditionally and only .then() it in the listings branch.
  const listingsQuery = supabase
    .from('listings')
    .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, version_thumbnail, games(image, is_expansion)')
    .eq('seller_id', id)
    .in('status', ['active', 'reserved'])
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)
    .returns<SellerListing[]>();

  // Viewer batched with the rest of the page-data round-trips so getUser doesn't
  // add a sequential round-trip before everything else starts. rating/completedSales/
  // the head-count query stay unconditional — the persistent header and both tab
  // badges need them regardless of which tab is active.
  const [rating, completedSales, { count: listingsCount }, viewerRes, tabData] = await Promise.all([
    getSellerRating(id),
    getSellerCompletedSales(id),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', id)
      .in('status', ['active', 'reserved']),
    supabase.auth.getUser(),
    activeTab === 'reviews'
      ? getSellerReviews(id, 10).then((reviews) => ({ kind: 'reviews' as const, reviews }))
      : activeTab === 'listings'
        ? listingsQuery.then(({ data }) => ({ kind: 'listings' as const, listings: data ?? [] }))
        : Promise.resolve({ kind: 'profile' as const }),
  ]);
  const viewer = viewerRes.data.user;
  const reviews = tabData.kind === 'reviews' ? tabData.reviews : [];

  const activeListings = tabData.kind === 'listings' ? tabData.listings : [];
  // Floor against a silent count-query failure: never display fewer than the cards visibly on screen.
  // Page-aware: on page N the visible cards represent items [from+1 .. from+activeListings.length],
  // so the floor is `from + activeListings.length`. When the page is out of range the slice is empty,
  // and the floor falls back to listingsCount alone so the redirect targets the correct last page.
  const totalListingCount = Math.max(
    activeListings.length > 0 ? from + activeListings.length : 0,
    listingsCount ?? 0,
  );
  const totalPages = Math.max(1, Math.ceil(totalListingCount / PAGE_SIZE));

  if (activeTab === 'listings' && requestedPage > totalPages) {
    redirect(totalPages > 1 ? `/sellers/${id}?tab=listings&page=${totalPages}` : `/sellers/${id}?tab=listings`);
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
      {(activeTab !== 'listings' || requestedPage === 1) && (
        <SellerProfileAnalytics sellerId={id} listingCount={totalListingCount} />
      )}
      {/* Seller header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar name={sellerName} src={profile.avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <h1 className={cn(PAGE_HEADING_CLASS, 'flex items-center gap-3')}>
            <span className="truncate">{sellerName}</span>
            {profile.country && (
              <span
                className={`${getCountryFlag(profile.country)} shrink-0`}
                title={getCountryName(profile.country)}
                aria-label={getCountryName(profile.country)}
              />
            )}
          </h1>
          {profile.created_at && (
            <p className="mt-1 text-sm text-semantic-text-muted">
              Member since {formatMonthYear(profile.created_at)}
            </p>
          )}
          {/* Rating is intentionally not rendered in the header anymore — the
              Stats bar below has a dedicated Positive % column that carries
              the same signal without competing with the badges. */}
          <SellerBadgesRow
            positivePct={rating.positivePct}
            ratingCount={rating.ratingCount}
            completedSales={completedSales}
            sellerCreatedAt={profile.created_at}
          />
          <ShareButtons
            url={`${env.app.url}/sellers/${id}`}
            title={sellerName}
          />
          <div className="mt-3">
            <MessageSellerCTA
              viewerId={viewer?.id ?? null}
              targetId={id}
              entryPoint="seller_profile"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <NavTabs
        tabs={[
          { key: 'profile', label: 'Profile', href: `/sellers/${id}` },
          { key: 'reviews', label: 'Reviews', href: `/sellers/${id}?tab=reviews`, count: rating.ratingCount },
          { key: 'listings', label: 'Listings', href: `/sellers/${id}?tab=listings`, count: totalListingCount },
        ]}
        activeTab={activeTab}
        variant="underline"
        className="mb-6"
      />

      {activeTab === 'profile' && (
        <div className="flex items-center gap-6 sm:gap-10 py-4 text-sm text-semantic-text-muted">
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
          <a href={`/sellers/${id}?tab=listings`} className="group block">
            <span className="block text-lg font-extrabold text-semantic-text-heading group-hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
              {totalListingCount}
            </span>
            <span className="group-hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
              Listed
            </span>
          </a>
        </div>
      )}

      {activeTab === 'reviews' && (
        <section>
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
      )}

      {activeTab === 'listings' && (
        <>
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
            buildUrl={(p) => (p === 1 ? `/sellers/${id}?tab=listings` : `/sellers/${id}?tab=listings&page=${p}`)}
          />
        </>
      )}
    </div>
  );
}
