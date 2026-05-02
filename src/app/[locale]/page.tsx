import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getUserWithFavorites } from '@/lib/favorites/actions';
import { getListingCardCounts } from '@/lib/listings/queries';
import { ListingSection } from '@/components/listings/ListingSection';
import { HomeHero } from '@/components/marketing/HomeHero';
import { TrustBand } from '@/components/marketing/TrustBand';
import { CountryRail } from '@/components/marketing/CountryRail';
import { Features } from '@/components/marketing/Features';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { HomeCta } from '@/components/marketing/HomeCta';
import type { ListingCondition, ListingType } from '@/lib/listings/types';

export const metadata: Metadata = {
  title: 'Second Turn Games — Pre-loved board games for the Baltic region',
  description:
    'Buy and sell pre-loved board games across Latvia, Lithuania, and Estonia. Every game deserves a second turn.',
  openGraph: {
    title: 'Second Turn Games — Pre-loved board games for the Baltic region',
    description:
      'Buy and sell pre-loved board games across Latvia, Lithuania, and Estonia. Every game deserves a second turn.',
  },
};

interface RecentListingRow {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
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
  const [{ data: recentListings }, { user, favoriteIds }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, game_name, game_year, condition, price_cents, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
      .in('status', ['active', 'reserved'])
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
      <HomeHero />
      <TrustBand />
      <CountryRail />

      {recentListings && recentListings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ListingSection
            eyebrow={t('recentlyListed.eyebrow')}
            heading={t('recentlyListed.heading')}
            href="/browse"
            linkText={t('recentlyListed.browseAll')}
            listings={recentListings}
            favoriteIds={favoriteIds}
            isAuthenticated={isAuthenticated}
            expansionCounts={expansionCounts}
            commentCounts={commentCounts}
            className="py-8 sm:py-10 lg:py-12"
          />
        </div>
      )}

      <Features />
      <FaqAccordion />
      <HomeCta />
    </>
  );
}
