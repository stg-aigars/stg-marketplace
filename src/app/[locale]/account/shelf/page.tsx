import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { getMyShelf } from '@/lib/shelves/actions';
import { ShelfManager } from './ShelfManager';

export const metadata: Metadata = { title: 'My shelf' };

export default async function ShelfPage() {
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const [items, profileResult] = await Promise.all([
    getMyShelf(),
    supabase
      .from('user_profiles')
      .select('bgg_username')
      .eq('id', user.id)
      .single(),
  ]);

  const bggUsername: string | null = profileResult.data?.bgg_username ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <ShelfManager initialItems={items} bggUsername={bggUsername} />
    </div>
  );
}
