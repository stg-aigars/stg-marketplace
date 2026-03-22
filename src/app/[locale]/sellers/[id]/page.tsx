import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSellerRating, getSellerReviews } from '@/lib/reviews/service';
import { getSellerCompletedSales } from '@/lib/services/sellers';
import { formatDate } from '@/lib/date-utils';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { Avatar, Card, CardBody } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { SellerRating } from '@/components/reviews';
import { ReviewItem } from '@/components/reviews';
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
  games: { thumbnail: string | null } | null;
}

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', id)
    .single();

  return {
    title: profile?.full_name ?? 'Seller profile',
  };
}

export default async function SellerProfilePage({
  params: { id },
}: {
  params: { id: string; locale: string };
}) {
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

  // Fetch rating, reviews, and active listings in parallel
  const [rating, reviews, completedSales, { data: listings }] = await Promise.all([
    getSellerRating(id),
    getSellerReviews(id, 10),
    getSellerCompletedSales(id),
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, photos, country, games(thumbnail)')
      .eq('seller_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(12)
      .returns<SellerListing[]>(),
  ]);

  const activeListings = listings ?? [];
  const sellerName = profile.full_name ?? 'Seller';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Seller header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={sellerName} size="md" className="w-14 h-14 text-lg" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
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
            {completedSales > 0 && (
              <span>{completedSales} {completedSales === 1 ? 'sale' : 'sales'} completed</span>
            )}
          </div>
          <div className="mt-1">
            <SellerRating positivePct={rating.positivePct} ratingCount={rating.ratingCount} />
          </div>
        </div>
      </div>

      {/* Reviews section */}
      <section className="mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading mb-4">
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
        <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading mb-4">
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
                gameYear={listing.game_year}
                gameThumbnail={listing.games?.thumbnail ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                photoCount={listing.photos?.length ?? 0}
                condition={listing.condition}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
