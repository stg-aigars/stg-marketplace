import { createClient } from '@/lib/supabase/server';
import type { PendingActions } from '@/lib/pending-actions/types';

export type { PendingActions, ActionChip } from '@/lib/pending-actions/types';
export { getTotalPendingCount, buildActionChips } from '@/lib/pending-actions/types';

const EMPTY: PendingActions = {
  sellerOrdersPending: 0,
  sellerOrdersToShip: 0,
  sellerDisputes: 0,
  sellerOffersPending: 0,
  buyerDisputes: 0,
  buyerDeliveryConfirm: 0,
  buyerWantedOffers: 0,
};

export async function getPendingActions(userId: string): Promise<PendingActions> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_pending_actions', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Failed to get pending actions:', error);
    return EMPTY;
  }

  if (!data) return EMPTY;

  return {
    sellerOrdersPending: data.seller_orders_pending ?? 0,
    sellerOrdersToShip: data.seller_orders_to_ship ?? 0,
    sellerDisputes: data.seller_disputes ?? 0,
    sellerOffersPending: data.seller_offers_pending ?? 0,
    buyerDisputes: data.buyer_disputes ?? 0,
    buyerDeliveryConfirm: data.buyer_delivery_confirm ?? 0,
    buyerWantedOffers: data.buyer_wanted_offers ?? 0,
  };
}
