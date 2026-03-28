import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { MyListingsTabs } from './MyListingsTabs';
import type { ListingCondition } from '@/lib/listings/types';

export const metadata: Metadata = {
  title: 'My Listings',
};

interface MyListingRow {
  id: string;
  game_name: string;
  game_year: number | null;
  condition: ListingCondition;
  price_cents: number;
  photos: string[];
  country: string;
  status: string;
  games: { thumbnail: string | null };
}

export default async function MyListingsPage() {
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from('listings')
    .select('id, game_name, game_year, condition, price_cents, photos, country, status, games(thumbnail)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .returns<MyListingRow[]>();

  const allListings = listings ?? [];
  const active = allListings.filter((l) => l.status === 'active');
  const inactive = allListings.filter((l) => l.status !== 'active');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        My Listings
      </h1>

      <MyListingsTabs active={active} inactive={inactive} />
    </div>
  );
}
