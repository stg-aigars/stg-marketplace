'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import type { OfferStatus, OfferWithDetails } from '@/lib/shelves/types';
import { MAX_NOTE_LENGTH, MIN_OFFER_CENTS, MAX_OFFER_CENTS, OFFER_TTL_DAYS } from '@/lib/shelves/types';

// ============================================================================
// Make an offer (buyer)
// ============================================================================

export async function makeOffer(
  shelfItemId: string,
  amountCents: number,
  note?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  // Validate amount
  if (
    !Number.isInteger(amountCents) ||
    amountCents < MIN_OFFER_CENTS ||
    amountCents > MAX_OFFER_CENTS
  ) {
    return { error: 'Invalid offer amount' };
  }

  if (note && note.length > MAX_NOTE_LENGTH) {
    return { error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  // Fetch shelf item to validate visibility and get seller_id
  const { data: shelfItem, error: shelfError } = await supabase
    .from('shelf_items')
    .select('id, seller_id, visibility, game_name')
    .eq('id', shelfItemId)
    .single();

  if (shelfError || !shelfItem) return { error: 'Shelf item not found' };
  if (shelfItem.seller_id === user.id) return { error: 'You cannot make an offer on your own game' };
  if (shelfItem.visibility !== 'open_to_offers') {
    return { error: 'This game is not open to offers' };
  }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      shelf_item_id: shelfItemId,
      buyer_id: user.id,
      seller_id: shelfItem.seller_id,
      amount_cents: amountCents,
      note: note?.trim() || null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'You already have an active offer on this game' };
    }
    return { error: 'Failed to make offer' };
  }

  // TODO: Task 5 — sendOfferReceivedToSeller()

  revalidatePath('/account/offers');
  return { id: data.id };
}

// ============================================================================
// Counter offer (seller only, on pending offers)
// ============================================================================

export async function counterOffer(
  offerId: string,
  counterAmountCents: number
): Promise<{ success: true } | { error: string }> {
  if (
    !Number.isInteger(counterAmountCents) ||
    counterAmountCents < MIN_OFFER_CENTS ||
    counterAmountCents > MAX_OFFER_CENTS
  ) {
    return { error: 'Invalid counter amount' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  // Load offer and verify seller + status
  const { data: offer, error: loadError } = await supabase
    .from('offers')
    .select('id, seller_id, buyer_id, status')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };
  if (offer.seller_id !== user.id) return { error: 'Only the seller can counter' };
  if (offer.status !== 'pending') return { error: 'Can only counter pending offers' };

  // Use service client for status transition
  const service = createServiceClient();
  const newExpiry = new Date(Date.now() + OFFER_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await service
    .from('offers')
    .update({
      status: 'countered',
      counter_amount_cents: counterAmountCents,
      expires_at: newExpiry,
    })
    .eq('id', offerId)
    .eq('status', 'pending'); // Optimistic lock

  if (error) return { error: 'Failed to counter offer' };

  // TODO: Task 5 — sendOfferCounteredToBuyer()

  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Accept offer (role-dependent)
// ============================================================================

export async function acceptOffer(
  offerId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: offer, error: loadError } = await supabase
    .from('offers')
    .select('id, seller_id, buyer_id, status')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };

  // Seller accepts pending, buyer accepts countered
  const isSeller = offer.seller_id === user.id;
  const isBuyer = offer.buyer_id === user.id;

  if (isSeller && offer.status !== 'pending') {
    return { error: 'Can only accept pending offers' };
  }
  if (isBuyer && offer.status !== 'countered') {
    return { error: 'Can only accept countered offers' };
  }
  if (!isSeller && !isBuyer) {
    return { error: 'You are not a party to this offer' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('offers')
    .update({ status: 'accepted' })
    .eq('id', offerId)
    .eq('status', offer.status); // Optimistic lock

  if (error) return { error: 'Failed to accept offer' };

  // TODO: Task 5 — sendOfferAccepted()

  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Decline offer (role-dependent)
// ============================================================================

export async function declineOffer(
  offerId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: offer, error: loadError } = await supabase
    .from('offers')
    .select('id, seller_id, buyer_id, status')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };

  const isSeller = offer.seller_id === user.id;
  const isBuyer = offer.buyer_id === user.id;

  // Seller declines pending, buyer declines countered
  if (isSeller && offer.status !== 'pending') {
    return { error: 'Can only decline pending offers' };
  }
  if (isBuyer && offer.status !== 'countered') {
    return { error: 'Can only decline countered offers' };
  }
  if (!isSeller && !isBuyer) {
    return { error: 'You are not a party to this offer' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('offers')
    .update({ status: 'declined' })
    .eq('id', offerId)
    .eq('status', offer.status);

  if (error) return { error: 'Failed to decline offer' };

  // TODO: Task 5 — sendOfferDeclinedToBuyer()

  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Cancel offer (buyer only, on their own pending/countered offers)
// ============================================================================

export async function cancelOffer(
  offerId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: offer, error: loadError } = await supabase
    .from('offers')
    .select('id, buyer_id, status')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };
  if (offer.buyer_id !== user.id) return { error: 'Only the buyer can cancel' };
  if (offer.status !== 'pending' && offer.status !== 'countered') {
    return { error: 'Can only cancel active offers' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('offers')
    .update({ status: 'cancelled' })
    .eq('id', offerId);

  if (error) return { error: 'Failed to cancel offer' };

  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Queries
// ============================================================================

/** Buyer's sent offers */
export async function getMyOffers(): Promise<OfferWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('offers')
    .select(`
      *,
      shelf_items:shelf_item_id (game_name, game_year, games:bgg_game_id (thumbnail)),
      seller:seller_id (full_name)
    `)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map(mapOfferRow);
}

/** Seller's received offers */
export async function getSellerOffers(): Promise<OfferWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('offers')
    .select(`
      *,
      shelf_items:shelf_item_id (game_name, game_year, games:bgg_game_id (thumbnail)),
      buyer:buyer_id (full_name)
    `)
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map(mapOfferRow);
}

// ============================================================================
// Auto-decline active offers on a shelf item (used when listing is created)
// ============================================================================

export async function declineActiveOffersOnShelfItem(
  shelfItemId: string
): Promise<void> {
  const service = createServiceClient();

  const { data: activeOffers } = await service
    .from('offers')
    .select('id, buyer_id')
    .eq('shelf_item_id', shelfItemId)
    .in('status', ['pending', 'countered']);

  if (!activeOffers?.length) return;

  // Batch decline
  await service
    .from('offers')
    .update({ status: 'declined' })
    .eq('shelf_item_id', shelfItemId)
    .in('status', ['pending', 'countered']);

  // TODO: Task 5 — email each affected buyer (offer-superseded template)
}

// ============================================================================
// Helpers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOfferRow(row: any): OfferWithDetails {
  const shelfItem = row.shelf_items ?? {};
  const game = shelfItem.games ?? {};

  return {
    id: row.id,
    shelf_item_id: row.shelf_item_id,
    buyer_id: row.buyer_id,
    seller_id: row.seller_id,
    amount_cents: row.amount_cents,
    counter_amount_cents: row.counter_amount_cents,
    note: row.note,
    status: row.status as OfferStatus,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    game_name: shelfItem.game_name ?? '',
    game_year: shelfItem.game_year ?? null,
    thumbnail: game.thumbnail ?? null,
    buyer_name: row.buyer?.full_name ?? row.seller?.full_name ?? '',
    seller_name: row.seller?.full_name ?? row.buyer?.full_name ?? '',
  };
}
