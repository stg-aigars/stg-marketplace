'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import type { OfferStatus, OfferWithDetails } from '@/lib/shelves/types';
import { MAX_NOTE_LENGTH, MIN_OFFER_CENTS, MAX_OFFER_CENTS, OFFER_TTL_DAYS } from '@/lib/shelves/types';
import {
  sendOfferReceivedToSeller,
  sendOfferCounteredToBuyer,
  sendOfferAccepted,
  sendOfferDeclinedToBuyer,
  sendOfferSupersededToBuyer,
} from '@/lib/email';
import { notify } from '@/lib/notifications';
import { fetchProfiles } from '@/lib/supabase/helpers';

// ============================================================================
// Helpers
// ============================================================================

/** Extract game_name from a Supabase join on shelf_items. */
function extractGameName(shelfItems: unknown): string {
  return (shelfItems as { game_name: string } | null)?.game_name ?? '';
}

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

  const trimmedNote = note?.trim() || null;

  const { data, error } = await supabase
    .from('offers')
    .insert({
      shelf_item_id: shelfItemId,
      buyer_id: user.id,
      seller_id: shelfItem.seller_id,
      amount_cents: amountCents,
      note: trimmedNote,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'You already have an active offer on this game' };
    }
    return { error: 'Failed to make offer' };
  }

  // Email seller (non-blocking)
  const profiles = await fetchProfiles(supabase, [user.id, shelfItem.seller_id]);
  const buyer = profiles.get(user.id);
  const seller = profiles.get(shelfItem.seller_id);

  if (seller?.email && buyer?.full_name) {
    sendOfferReceivedToSeller({
      sellerName: seller.full_name,
      sellerEmail: seller.email,
      buyerName: buyer.full_name,
      gameName: shelfItem.game_name,
      amountCents,
      note: trimmedNote,
    }).catch(() => {});
  }

  void notify(shelfItem.seller_id, 'offer.received', {
    gameName: shelfItem.game_name,
    offerId: data.id,
    buyerName: buyer?.full_name ?? 'Buyer',
  });

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

  // Include email-relevant fields in initial select to avoid re-fetch
  const { data: offer, error: loadError } = await supabase
    .from('offers')
    .select('id, seller_id, buyer_id, status, amount_cents, shelf_items:shelf_item_id (game_name)')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };
  if (offer.seller_id !== user.id) return { error: 'Only the seller can counter' };
  if (offer.status !== 'pending') return { error: 'Can only counter pending offers' };

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
    .eq('status', 'pending');

  if (error) return { error: 'Failed to counter offer' };

  // Email buyer (non-blocking)
  const profiles = await fetchProfiles(supabase, [offer.buyer_id, user.id]);
  const buyer = profiles.get(offer.buyer_id);
  const seller = profiles.get(user.id);

  if (buyer?.email && seller?.full_name) {
    sendOfferCounteredToBuyer({
      buyerName: buyer.full_name,
      buyerEmail: buyer.email,
      sellerName: seller.full_name,
      gameName: extractGameName(offer.shelf_items),
      originalAmountCents: offer.amount_cents,
      counterAmountCents,
    }).catch(() => {});
  }

  void notify(offer.buyer_id, 'offer.countered', {
    gameName: extractGameName(offer.shelf_items),
    offerId,
    sellerName: seller?.full_name ?? 'Seller',
  });

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
    .select('id, seller_id, buyer_id, status, amount_cents, counter_amount_cents, shelf_items:shelf_item_id (game_name)')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };

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
    .eq('status', offer.status);

  if (error) return { error: 'Failed to accept offer' };

  // Email both parties (non-blocking)
  const profiles = await fetchProfiles(supabase, [offer.buyer_id, offer.seller_id]);
  const buyer = profiles.get(offer.buyer_id);
  const seller = profiles.get(offer.seller_id);
  const agreedAmount = offer.counter_amount_cents ?? offer.amount_cents;

  if (buyer?.email && seller?.email) {
    sendOfferAccepted({
      sellerName: seller.full_name,
      sellerEmail: seller.email,
      buyerName: buyer.full_name,
      buyerEmail: buyer.email,
      gameName: extractGameName(offer.shelf_items),
      agreedAmountCents: agreedAmount,
      offerId,
    }).catch(() => {});
  }

  void notify(offer.buyer_id, 'offer.accepted', {
    gameName: extractGameName(offer.shelf_items),
    offerId,
  });
  void notify(offer.seller_id, 'offer.accepted', {
    gameName: extractGameName(offer.shelf_items),
    offerId,
  });

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
    .select('id, seller_id, buyer_id, status, shelf_items:shelf_item_id (game_name)')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };

  const isSeller = offer.seller_id === user.id;
  const isBuyer = offer.buyer_id === user.id;

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

  // Email buyer when seller declines (non-blocking)
  if (isSeller) {
    const profiles = await fetchProfiles(supabase, [offer.buyer_id, user.id]);
    const buyer = profiles.get(offer.buyer_id);
    const seller = profiles.get(user.id);

    if (buyer?.email && seller?.full_name) {
      sendOfferDeclinedToBuyer({
        buyerName: buyer.full_name,
        buyerEmail: buyer.email,
        sellerName: seller.full_name,
        gameName: extractGameName(offer.shelf_items),
      }).catch(() => {});
    }

    void notify(offer.buyer_id, 'offer.declined', {
      gameName: extractGameName(offer.shelf_items),
      offerId,
      sellerName: seller?.full_name ?? 'Seller',
    });
  }

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
    .eq('id', offerId)
    .in('status', ['pending', 'countered']);

  if (error) return { error: 'Failed to cancel offer' };

  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Queries
// ============================================================================

const OFFER_SELECT = `
  *,
  shelf_items:shelf_item_id (game_name, game_year, games:bgg_game_id (thumbnail)),
  buyer:buyer_id (full_name),
  seller:seller_id (full_name)
`;

/** Buyer's sent offers */
export async function getMyOffers(): Promise<OfferWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapOfferRow);
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
    .select(OFFER_SELECT)
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapOfferRow);
}

// ============================================================================
// Auto-decline active offers on a shelf item (used when listing is created)
// ============================================================================

export async function declineActiveOffersOnShelfItem(
  shelfItemId: string,
  gameName: string,
  sellerName: string,
  listingId: string
): Promise<void> {
  const service = createServiceClient();

  const { data: activeOffers } = await service
    .from('offers')
    .select('id, buyer_id')
    .eq('shelf_item_id', shelfItemId)
    .in('status', ['pending', 'countered']);

  if (!activeOffers?.length) return;

  await service
    .from('offers')
    .update({ status: 'declined' })
    .eq('shelf_item_id', shelfItemId)
    .in('status', ['pending', 'countered']);

  // Email affected buyers (non-blocking)
  const buyerIds = Array.from(new Set(activeOffers.map((o) => o.buyer_id)));
  const profiles = await fetchProfiles(service, buyerIds);

  profiles.forEach((buyer) => {
    if (buyer.email) {
      sendOfferSupersededToBuyer({
        buyerName: buyer.full_name,
        buyerEmail: buyer.email,
        sellerName,
        gameName,
        listingId,
      }).catch(() => {});
    }
    void notify(buyer.id, 'offer.superseded', {
      gameName,
      listingId,
      sellerName,
    });
  });
}

// ============================================================================
// Row mapper
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
    buyer_name: row.buyer?.full_name ?? '',
    seller_name: row.seller?.full_name ?? '',
  };
}
