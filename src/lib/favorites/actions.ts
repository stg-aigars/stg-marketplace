'use server';

import { createClient } from '@/lib/supabase/server';

export async function toggleFavorite(
  listingId: string
): Promise<{ favorited: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Check if favorite already exists
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (existing) {
    // Remove favorite
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', existing.id);

    if (error) {
      return { error: 'Failed to remove favorite' };
    }
    return { favorited: false };
  } else {
    // Add favorite
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, listing_id: listingId });

    if (error) {
      return { error: 'Failed to add favorite' };
    }
    return { favorited: true };
  }
}

/**
 * Get the set of listing IDs the current user has favorited.
 * Returns empty set for unauthenticated users.
 */
export async function getUserFavoriteIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Set();

  const { data } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id);

  return new Set(data?.map((f) => f.listing_id) ?? []);
}

/**
 * Get the current user and their favorited listing IDs in a single auth call.
 * Eliminates the duplicate getUser() when pages need both user and favorites.
 */
export async function getUserWithFavorites(): Promise<{
  user: import('@supabase/supabase-js').User | null;
  favoriteIds: Set<string>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, favoriteIds: new Set() };

  // TODO: paginate or cap — unbounded for users with hundreds of favorites
  const { data } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id);

  return { user, favoriteIds: new Set(data?.map((f) => f.listing_id) ?? []) };
}
