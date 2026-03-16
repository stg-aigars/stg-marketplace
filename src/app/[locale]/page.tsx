import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
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
  games: { thumbnail: string | null };
}

export default async function HomePage() {
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, game_name, game_year, condition, price_cents, photos, country, games(thumbnail)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(6)
    .returns<RecentListingRow[]>();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Hero */}
      <section className="py-8 sm:py-10 lg:py-12 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
          {t('home.hero')}
        </h1>
        <p className="mt-3 text-base sm:text-lg text-semantic-text-secondary max-w-2xl mx-auto">
          {t('home.heroSub')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/browse"
            className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg bg-semantic-primary text-semantic-text-inverse font-medium text-base active:scale-[0.98] transition-transform sm:hover:bg-semantic-primary-hover"
          >
            {t('home.browseCta')}
          </Link>
          <Link
            href="/sell"
            className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-default font-medium text-base active:scale-[0.98] transition-transform sm:hover:shadow-md"
          >
            {t('home.sellCta')}
          </Link>
        </div>
      </section>

      {/* Recently listed */}
      {recentListings && recentListings.length > 0 && (
        <section className="py-8 sm:py-10 lg:py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
              Recently listed
            </h2>
            <Link
              href="/browse"
              className="text-sm font-medium text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors"
            >
              Browse all
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {recentListings.map((listing) => (
              <ListingCard
                key={listing.id}
                id={listing.id}
                gameTitle={listing.game_name}
                gameYear={listing.game_year}
                gameThumbnail={listing.games?.thumbnail ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                condition={listing.condition}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
