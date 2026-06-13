import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch expansion, comment, and component-upgrade counts for a set of listings.
 * Used by all pages that render ListingCard grids.
 */
export async function getListingCardCounts(
  supabase: SupabaseClient,
  listingIds: string[]
): Promise<{
  expansionCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  upgradeCounts: Record<string, number>;
}> {
  if (listingIds.length === 0) {
    return { expansionCounts: {}, commentCounts: {}, upgradeCounts: {} };
  }

  const [{ data: expansions }, { data: comments }, { data: upgradeRows }] = await Promise.all([
    supabase
      .from('listing_expansions')
      .select('listing_id')
      .in('listing_id', listingIds),
    supabase
      .from('listing_comments')
      .select('listing_id')
      .in('listing_id', listingIds),
    // component_upgrades is a JSONB array on the listings row (not a child table),
    // so we read it directly and count array length per listing.
    supabase
      .from('listings')
      .select('id, component_upgrades')
      .in('id', listingIds),
  ]);

  const expansionCounts = (expansions ?? []).reduce((acc, e) => {
    acc[e.listing_id] = (acc[e.listing_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const commentCounts = (comments ?? []).reduce((acc, c) => {
    acc[c.listing_id] = (acc[c.listing_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const upgradeCounts = (upgradeRows ?? []).reduce((acc, row) => {
    const upgrades = (row as { id: string; component_upgrades: unknown[] | null }).component_upgrades;
    if (Array.isArray(upgrades) && upgrades.length > 0) {
      acc[(row as { id: string }).id] = upgrades.length;
    }
    return acc;
  }, {} as Record<string, number>);

  return { expansionCounts, commentCounts, upgradeCounts };
}
