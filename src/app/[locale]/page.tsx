import Link from 'next/link';
import { GlobeHemisphereWest, Package, ShieldCheck } from '@phosphor-icons/react/ssr';
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
      <section className="relative text-center lg:text-left overflow-hidden bg-[#363e4b] lg:bg-[url('/images/hero-bg-2.webp')] lg:bg-cover lg:bg-center">
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#363e4b]/80 from-0% via-[#363e4b]/60 via-25% to-transparent to-40%" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 lg:py-16">
          <div className="max-w-2xl mx-auto lg:mx-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white">
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
            <div className="hidden lg:flex mt-8 flex-col items-start gap-y-2 text-sm text-white/70">
              <span className="flex items-center gap-2"><GlobeHemisphereWest size={16} className="text-white/50" />{t('home.statBaltics')}</span>
              <span className="flex items-center gap-2"><Package size={16} className="text-white/50" />{t('home.statShipping')}</span>
              <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-white/50" />{t('home.statPayments')}</span>
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
