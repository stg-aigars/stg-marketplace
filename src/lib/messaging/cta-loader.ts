import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type CanMessageSellerResult =
  | { visible: true }
  | { visible: false; reason: 'self' | 'unauthenticated' | 'unavailable' };

/**
 * Resolves whether a "Message seller" CTA should be visible on a listing detail
 * or seller profile page. Privacy-equivalent — collapses block + opt-out into a
 * single "unavailable" reason so the hidden-state copy doesn't leak which is true.
 *
 * Performance: two extra queries per render (user_profiles + message_blocks).
 * TODO: fold into seller-data SSR loader on the listing detail route when its
 * existing seller-fetch is consolidated. Pre-launch volume acceptable.
 */
export async function canMessageSeller(
  viewerId: string | null,
  sellerId: string,
): Promise<CanMessageSellerResult> {
  if (!viewerId) return { visible: false, reason: 'unauthenticated' };
  if (viewerId === sellerId) return { visible: false, reason: 'self' };

  const supabase = await createClient();

  const [profileRes, blockRes] = await Promise.all([
    supabase.from('user_profiles').select('messaging_enabled').eq('id', sellerId).maybeSingle(),
    supabase
      .from('message_blocks')
      .select('id')
      .or(
        `and(blocker_id.eq.${viewerId},blocked_id.eq.${sellerId}),and(blocker_id.eq.${sellerId},blocked_id.eq.${viewerId})`,
      )
      .limit(1),
  ]);

  if (profileRes.error || !profileRes.data) {
    return { visible: false, reason: 'unavailable' };
  }
  if (!profileRes.data.messaging_enabled) {
    return { visible: false, reason: 'unavailable' };
  }
  if ((blockRes.data ?? []).length > 0) {
    return { visible: false, reason: 'unavailable' };
  }

  return { visible: true };
}
