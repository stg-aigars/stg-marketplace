import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getUserWithFavorites } from '@/lib/favorites/actions';
import { getListingCardCounts } from '@/lib/listings/queries';
import { PRICE_DROP_WINDOW_DAYS } from '@/lib/listings/price-drop';
import { ListingSection } from '@/components/listings/ListingSection';
import { HomeHero } from '@/components/marketing/HomeHero';
import { TrustBand } from '@/components/marketing/TrustBand';
import { Features } from '@/components/marketing/Features';
import { WantedRail } from '@/components/marketing/WantedRail';
import { SellerValueProp } from '@/components/marketing/SellerValueProp';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { HomeCta } from '@/components/marketing/HomeCta';
import { IS_PRELAUNCH } from '@/lib/constants';
import type { ListingCondition, ListingType } from '@/lib/listings/types';

const HOMEPAGE_TITLE = 'Second Turn Games — Pre-loved board games for the Baltic region';
const HOMEPAGE_DESCRIPTION =
  'The Baltic marketplace for pre-loved board games. Buy and sell across Latvia, Lithuania, and Estonia — one shared marketplace, three countries.';

export const metadata: Metadata = {
  title: HOMEPAGE_TITLE,
  description: HOMEPAGE_DESCRIPTION,
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
  },
};

interface RecentListingRow {
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
  listing_type: ListingType;
  bid_count: number;
  auction_end_at: string | null;
  version_thumbnail: string | null;
  games: { image: string | null; is_expansion: boolean };
}

export default async function HomePage() {
  const t = await getTranslations('home');

  const supabase = await createClient();
  const now = new Date();
  // Same price-drop predicate as the browse "Price drops" filter (post-#421):
  // has_price_decrease + the 14d freshness window. Covers manual fixed-price
  // reductions AND dropped declining listings; excludes un-dropped declining.
  const priceDropCutoff = new Date(now.getTime() - PRICE_DROP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [{ data: recentListings }, { data: endingSoonAuctions }, { data: priceDropListings }, { user, favoriteIds }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .in('listing_type', ['fixed_price', 'declining'])
      .in('status', ['active', 'reserved'])
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<RecentListingRow[]>(),
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .eq('listing_type', 'auction')
      .eq('status', 'active')
      .gt('auction_end_at', now.toISOString())
      .order('auction_end_at', { ascending: true })
      .limit(4)
      .returns<RecentListingRow[]>(),
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, previous_price_cents, price_changed_at, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .eq('status', 'active')
      .eq('has_price_decrease', true)
      .gt('price_changed_at', priceDropCutoff.toISOString())
      .lte('price_changed_at', now.toISOString())
      .order('price_changed_at', { ascending: false })
      .limit(8)
      .returns<RecentListingRow[]>(),
    getUserWithFavorites(),
  ]);
  const isAuthenticated = !!user;

  const recentListingsList = recentListings ?? [];
  const endingSoonAuctionsList = endingSoonAuctions ?? [];
  const priceDropListingsList = priceDropListings ?? [];

  const { expansionCounts, commentCounts, upgradeCounts } = await getListingCardCounts(
    supabase,
    [...recentListingsList, ...endingSoonAuctionsList, ...priceDropListingsList].map((l) => l.id)
  );

  const showEndingSoonRail = endingSoonAuctionsList.length >= 1;
  const showAvailableNowRail = recentListingsList.length >= 6;
  const showPriceDropsRail = priceDropListingsList.length >= 1;
  const showCompactSellerProp = !showAvailableNowRail && !IS_PRELAUNCH;
  const showFullSellerProp = showAvailableNowRail && !IS_PRELAUNCH;

  return (
    <>
      <HomeHero />
      <TrustBand />

      {showEndingSoonRail && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ListingSection
            eyebrow={t('auctions.eyebrow')}
            heading={t('auctions.heading')}
            href="/browse?auctions=1"
            linkText={t('auctions.browseAll')}
            listings={endingSoonAuctionsList}
            favoriteIds={favoriteIds}
            isAuthenticated={isAuthenticated}
            expansionCounts={expansionCounts}
            commentCounts={commentCounts}
            upgradeCounts={upgradeCounts}
            className="py-8 sm:py-10 lg:py-12"
          />
        </div>
      )}

      {showPriceDropsRail && (
        <section className="bg-semantic-brand-bg border-y border-semantic-border-subtle">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <ListingSection
              eyebrow={t('priceDrops.eyebrow')}
              heading={t('priceDrops.heading')}
              href="/browse?priceDrops=1&sort=recent_drops"
              linkText={t('priceDrops.browseAll')}
              listings={priceDropListingsList}
              favoriteIds={favoriteIds}
              isAuthenticated={isAuthenticated}
              expansionCounts={expansionCounts}
              commentCounts={commentCounts}
              upgradeCounts={upgradeCounts}
              className="py-8 sm:py-10 lg:py-12"
            />
          </div>
        </section>
      )}

      {showAvailableNowRail && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ListingSection
            eyebrow={t('recentlyListed.eyebrow')}
            heading={t('recentlyListed.heading')}
            href="/browse"
            linkText={t('recentlyListed.browseAll')}
            listings={recentListingsList}
            favoriteIds={favoriteIds}
            isAuthenticated={isAuthenticated}
            expansionCounts={expansionCounts}
            commentCounts={commentCounts}
            upgradeCounts={upgradeCounts}
            className="py-8 sm:py-10 lg:py-12"
          />
        </div>
      )}
      {showCompactSellerProp && <SellerValueProp variant="compact" />}

      <Features />
      <WantedRail />
      {showFullSellerProp && <SellerValueProp />}
      <FaqAccordion />
      <HomeCta />
    </>
  );
}
