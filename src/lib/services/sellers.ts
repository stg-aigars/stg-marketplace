import { createClient } from '@/lib/supabase/server';

// Re-export pure badge/tier helpers so existing server-side callers keep their
// `from '@/lib/services/sellers'` imports working. Client components must
// import directly from `./sellers-badges` to avoid pulling the server-only
// `createClient` into the client bundle.
export {
  type TrustTier,
  calculateTrustTier,
  TRUST_TIER_CONFIG,
  EARLY_MEMBER_CUTOFF,
  isEarlyMember,
} from './sellers-badges';

/**
 * Get the number of completed sales for a seller.
 * Uses a SECURITY DEFINER DB function to bypass orders RLS
 * (only returns a count, no sensitive data).
 */
export async function getSellerCompletedSales(sellerId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_seller_completed_sales', {
    p_seller_id: sellerId,
  });

  if (error) {
    console.error('Failed to get seller completed sales:', error);
    return 0;
  }

  return data ?? 0;
}

/**
 * Count active listings for a seller.
 */
export async function getActiveListingCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Failed to get active listing count:', error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Count active or reserved listings for a seller. Mirrors the framing used on
 * the seller public profile page (`/sellers/[id]`), where both `active` and
 * `reserved` are treated as "currently listed for sale" — a reserved listing
 * is still on the marketplace, just temporarily on hold for one buyer.
 */
export async function getActiveOrReservedListingCount(sellerId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .in('status', ['active', 'reserved']);

  if (error) {
    console.error('Failed to get active+reserved listing count:', error);
    return 0;
  }

  return count ?? 0;
}
