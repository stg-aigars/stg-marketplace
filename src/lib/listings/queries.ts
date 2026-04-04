import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch expansion and comment counts for a set of listings.
 * Used by all pages that render ListingCard grids.
 */
export async function getListingCardCounts(
  supabase: SupabaseClient,
  listingIds: string[]
): Promise<{ expansionCounts: Record<string, number>; commentCounts: Record<string, number> }> {
  if (listingIds.length === 0) {
    return { expansionCounts: {}, commentCounts: {} };
  }

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

  const expansionCounts = (expansions ?? []).reduce((acc, e) => {
    acc[e.listing_id] = (acc[e.listing_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const commentCounts = (comments ?? []).reduce((acc, c) => {
    acc[c.listing_id] = (acc[c.listing_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { expansionCounts, commentCounts };
}
