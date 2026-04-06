import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getUserWithFavorites } from '@/lib/favorites/actions';
import { getListingCardCounts } from '@/lib/listings/queries';
import { Button } from '@/components/ui';
import { ListingSection } from '@/components/listings/ListingSection';
import type { ListingCondition, ListingType } from '@/lib/listings/types';

interface RecentListingRow {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  photos: string[];
  country: string;
  listing_type: ListingType;
  bid_count: number;
  auction_end_at: string | null;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean };
}

export default async function HomePage() {
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: recentListings }, { user, favoriteIds }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, photos, country, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<RecentListingRow[]>(),
    getUserWithFavorites(),
  ]);
  const isAuthenticated = !!user;

  const { expansionCounts, commentCounts } = await getListingCardCounts(
    supabase,
    (recentListings ?? []).map((l) => l.id)
  );

  return (
    <>
      {/* Hero */}
      <section className="relative text-center lg:text-left overflow-hidden bg-gradient-to-br from-semantic-brand-hover via-semantic-brand-active to-frost-ocean">
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-white/[0.06] blur-3xl will-change-transform" />
        <div className="absolute -bottom-1/3 -left-1/4 w-[400px] h-[400px] rounded-full bg-semantic-brand-active/40 blur-3xl will-change-transform" />
        {/* Decorative dice */}
        <div className="hidden lg:block absolute right-[12%] top-1/2 -translate-y-1/2" aria-hidden="true">
          <svg className="absolute -top-16 -left-6 rotate-[75deg] drop-shadow-lg" width="100" height="100" viewBox="0 0 100 100" fill="none">
            <rect x="5" y="5" width="90" height="90" rx="16" className="fill-semantic-primary" />
            <circle cx="33" cy="33" r="8" fill="white" />
            <circle cx="67" cy="67" r="8" fill="white" />
          </svg>
          <svg className="absolute top-12 left-20 rotate-[100deg] drop-shadow-lg" width="80" height="80" viewBox="0 0 100 100" fill="none">
            <rect x="5" y="5" width="90" height="90" rx="16" className="fill-semantic-primary" />
            <circle cx="33" cy="33" r="8" fill="white" />
            <circle cx="67" cy="67" r="8" fill="white" />
          </svg>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 lg:py-16">
          <div className="max-w-2xl mx-auto lg:mx-0">
            <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-white">
              {t('home.hero')}
            </h1>
            <p className="mt-3 text-base sm:text-lg text-white/80">
              {t('home.heroSub')}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button size="lg" asChild>
                <Link href="/browse">{t('home.browseCta')}</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="bg-white border-white/20 shadow-md text-semantic-text-heading">
                <Link href="/sell">{t('home.sellCta')}</Link>
              </Button>
            </div>
            <div className="hidden lg:flex mt-8 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70">
              <span>{t('home.statBaltics')}</span>
              <span className="w-px h-4 bg-white/30" aria-hidden="true" />
              <span>{t('home.statShipping')}</span>
              <span className="w-px h-4 bg-white/30" aria-hidden="true" />
              <span>{t('home.statPayments')}</span>
            </div>
          </div>
        </div>
      </section>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Recently listed */}
      {recentListings && recentListings.length > 0 && (
        <ListingSection
          heading="Recently listed"
          href="/browse"
          linkText="Browse all"
          linkClassName="text-sm font-medium text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom"
          listings={recentListings}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          expansionCounts={expansionCounts}
          commentCounts={commentCounts}
          className="py-8 sm:py-10 lg:py-12"
        />
      )}
    </div>
    </>
  );
}
