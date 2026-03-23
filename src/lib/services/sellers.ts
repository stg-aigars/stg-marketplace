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
