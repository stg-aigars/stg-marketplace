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
