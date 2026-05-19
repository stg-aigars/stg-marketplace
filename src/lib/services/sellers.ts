import { createClient } from '@/lib/supabase/server';

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

export type TrustTier = 'new' | 'bronze' | 'gold' | 'trusted';

export function calculateTrustTier(completedSales: number, positivePct: number, ratingCount: number): TrustTier {
  if (completedSales >= 20 && positivePct >= 90) return 'trusted';
  if (completedSales >= 5 && positivePct >= 80) return 'gold';
  if (completedSales >= 1 && ratingCount >= 1) return 'bronze';
  return 'new';
}

export const TRUST_TIER_CONFIG: Record<TrustTier, { label: string; show: boolean }> = {
  new: { label: 'New seller', show: false },
  bronze: { label: 'Bronze seller', show: true },
  gold: { label: 'Gold seller', show: true },
  trusted: { label: 'Trusted seller', show: true },
};

/**
 * Sellers whose accounts were created before this cutoff get a permanent
 * "Early member" badge. Anchored to soft-launch + ~3.5 months so the badge
 * stays meaningful (scarce after 31 Aug 2026 inclusive) while giving genuine
 * day-zero adopters real social capital.
 */
export const EARLY_MEMBER_CUTOFF = '2026-09-01T00:00:00Z';

export function isEarlyMember(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  return new Date(createdAt) < new Date(EARLY_MEMBER_CUTOFF);
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
