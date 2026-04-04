import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { MyListingsTabs } from './MyListingsTabs';
import type { ListingCondition, ListingType } from '@/lib/listings/types';

export const metadata: Metadata = {
  title: 'My Listings',
};

export interface MyListingRow {
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
  expansion_count: number;
  comment_count: number;
}

export default async function MyListingsPage() {
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from('listings')
    .select('id, game_name, game_year, condition, price_cents, photos, country, status, listing_type, bid_count, auction_end_at, version_thumbnail, games(image, is_expansion)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .returns<MyListingRow[]>();

  const allListings = listings ?? [];

  // Fetch expansion counts and comment counts
  const listingIds = allListings.map((l) => l.id);
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

  const withCounts = allListings.map((l) => ({
    ...l,
    expansion_count: expansionCounts[l.id] ?? 0,
    comment_count: commentCounts[l.id] ?? 0,
  }));
  const active = withCounts.filter((l) => l.status === 'active');
  const inactive = withCounts.filter((l) => l.status !== 'active');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        My Listings
      </h1>

      <MyListingsTabs active={active} inactive={inactive} />
    </div>
  );
}
