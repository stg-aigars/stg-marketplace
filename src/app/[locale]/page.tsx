import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getUserFavoriteIds } from '@/lib/favorites/actions';
import { getListingCardCounts } from '@/lib/listings/queries';
import { Button } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import type { ListingCondition } from '@/lib/listings/types';

interface RecentListingRow {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  photos: string[];
  country: string;
  listing_type: string;
  bid_count: number;
  auction_end_at: string | null;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean };
}

export default async function HomePage() {
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: recentListings }, favoriteIds, { data: { user } }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, photos, country, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<RecentListingRow[]>(),
    getUserFavoriteIds(),
    supabase.auth.getUser(),
  ]);
  const isAuthenticated = !!user;

  const { expansionCounts, commentCounts } = await getListingCardCounts(
    supabase,
    (recentListings ?? []).map((l) => l.id)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Hero */}
      <section className="py-8 sm:py-10 lg:py-12 text-center bg-gradient-to-br from-semantic-bg-primary via-semantic-bg-primary to-semantic-brand/[0.04] rounded-xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-semantic-text-heading">
          {t('home.hero')}
        </h1>
        <p className="mt-3 text-base sm:text-lg text-semantic-text-secondary max-w-2xl mx-auto">
          {t('home.heroSub')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link href="/browse">{t('home.browseCta')}</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/sell">{t('home.sellCta')}</Link>
          </Button>
        </div>
        <div className="mt-8 flex items-center justify-center gap-6 sm:gap-10 text-sm text-semantic-text-muted">
          <div>
            <span className="block text-lg font-bold font-display text-semantic-text-heading">3</span>
            Countries
          </div>
          <div className="w-px h-8 bg-semantic-border-subtle" />
          <div>
            <span className="block text-lg font-bold font-display text-semantic-text-heading">170k+</span>
            Games in catalog
          </div>
          <div className="w-px h-8 bg-semantic-border-subtle" />
          <div>
            <span className="block text-lg font-bold font-display text-semantic-text-heading">Parcel lockers</span>
            Cross-border shipping
          </div>
        </div>
      </section>

      {/* Recently listed */}
      {recentListings && recentListings.length > 0 && (
        <section className="py-8 sm:py-10 lg:py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
              Recently listed
            </h2>
            <Link
              href="/browse"
              className="text-sm font-medium text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom"
            >
              Browse all
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentListings.map((listing) => (
              <ListingCard
                key={listing.id}
                id={listing.id}
                gameTitle={listing.game_name}
                gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                photoCount={listing.photos?.length ?? 0}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
                isFavorited={favoriteIds.has(listing.id)}
                isAuthenticated={isAuthenticated}
                expansionCount={expansionCounts[listing.id] ?? 0}
                commentCount={commentCounts[listing.id] ?? 0}
                isExpansion={listing.games?.is_expansion ?? false}
                isAuction={listing.listing_type === 'auction'}
                bidCount={listing.bid_count}
                auctionEndAt={listing.auction_end_at}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
