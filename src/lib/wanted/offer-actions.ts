'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { LISTING_CONDITIONS, type ListingCondition } from '@/lib/listings/types';
import { notify } from '@/lib/notifications';
import { fetchProfiles } from '@/lib/supabase/helpers';
import {
  sendWantedOfferReceivedToBuyer,
  sendWantedOfferCounteredToSeller,
  sendWantedOfferAccepted,
  sendWantedOfferDeclined,
} from '@/lib/email';
import type { WantedOfferStatus, WantedOfferWithDetails } from './types';
import {
  MIN_OFFER_CENTS,
  MAX_OFFER_CENTS,
  MAX_NOTE_LENGTH,
  OFFER_TTL_DAYS,
  meetsConditionThreshold,
} from './types';

// ============================================================================
// Make offer on wanted listing (seller)
// ============================================================================

export async function makeWantedOffer(
  wantedListingId: string,
  condition: ListingCondition,
  priceCents: number,
  note?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };
  if (!LISTING_CONDITIONS.includes(condition)) return { error: 'Invalid condition' };
  if (!Number.isInteger(priceCents) || priceCents < MIN_OFFER_CENTS || priceCents > MAX_OFFER_CENTS) {
    return { error: 'Invalid offer amount' };
  }
  if (note && note.length > MAX_NOTE_LENGTH) {
    return { error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  // Fetch wanted listing details
  const { data: wanted, error: wantedError } = await supabase
    .from('wanted_listings')
    .select('id, buyer_id, game_name, min_condition, status')
    .eq('id', wantedListingId)
    .single();

  if (wantedError || !wanted) return { error: 'Wanted listing not found' };
  if (wanted.buyer_id === user.id) return { error: 'You cannot make an offer on your own wanted listing' };
  if (wanted.status !== 'active') return { error: 'This wanted listing is no longer active' };

  // Validate condition meets buyer's minimum threshold
  if (!meetsConditionThreshold(condition, wanted.min_condition as ListingCondition)) {
    return { error: 'Condition does not meet the minimum requirement' };
  }

  const trimmedNote = note?.trim() || null;

  const { data, error } = await supabase
    .from('wanted_offers')
    .insert({
      wanted_listing_id: wantedListingId,
      seller_id: user.id,
      buyer_id: wanted.buyer_id,
      condition,
      price_cents: priceCents,
      note: trimmedNote,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'You already have an active offer on this wanted listing' };
    }
    return { error: 'Failed to make offer' };
  }

  // Notify + email buyer (non-blocking)
  const profiles = await fetchProfiles(supabase, [user.id, wanted.buyer_id]);
  const seller = profiles.get(user.id);
  const buyer = profiles.get(wanted.buyer_id);

  if (buyer?.email && seller?.full_name) {
    const conditionLabel = condition.replace('_', ' ');
    sendWantedOfferReceivedToBuyer({
      buyerName: buyer.full_name,
      buyerEmail: buyer.email,
      sellerName: seller.full_name,
      gameName: wanted.game_name,
      condition: conditionLabel,
      priceCents,
      note: trimmedNote,
    }).catch(() => {});
  }

  void notify(wanted.buyer_id, 'wanted.offer_received', {
    gameName: wanted.game_name,
    offerId: data.id,
    sellerName: seller?.full_name ?? 'Seller',
  });

  revalidatePath('/account/wanted');
  revalidatePath('/account/offers');
  return { id: data.id };
}

// ============================================================================
// Counter wanted offer (buyer only, on pending offers — single round)
// ============================================================================

export async function counterWantedOffer(
  offerId: string,
  counterPriceCents: number
): Promise<{ success: true } | { error: string }> {
  if (!Number.isInteger(counterPriceCents) || counterPriceCents < MIN_OFFER_CENTS || counterPriceCents > MAX_OFFER_CENTS) {
    return { error: 'Invalid counter amount' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: offer, error: loadError } = await supabase
    .from('wanted_offers')
    .select('id, seller_id, buyer_id, status, price_cents, wanted_listings:wanted_listing_id (game_name)')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };
  if (offer.buyer_id !== user.id) return { error: 'Only the buyer can counter' };
  if (offer.status !== 'pending') return { error: 'Can only counter pending offers' };

  const service = createServiceClient();
  const newExpiry = new Date(Date.now() + OFFER_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await service
    .from('wanted_offers')
    .update({
      status: 'countered',
      counter_price_cents: counterPriceCents,
      expires_at: newExpiry,
    })
    .eq('id', offerId)
    .eq('status', 'pending');

  if (error) return { error: 'Failed to counter offer' };

  // Notify + email seller (non-blocking)
  const gameName = extractGameName(offer.wanted_listings);

  const profiles = await fetchProfiles(supabase, [user.id, offer.seller_id]);
  const buyer = profiles.get(user.id);
  const seller = profiles.get(offer.seller_id);

  if (seller?.email && buyer?.full_name) {
    sendWantedOfferCounteredToSeller({
      sellerName: seller.full_name,
      sellerEmail: seller.email,
      buyerName: buyer.full_name,
      gameName,
      originalPriceCents: offer.price_cents,
      counterPriceCents,
    }).catch(() => {});
  }

  void notify(offer.seller_id, 'wanted.offer_countered', {
    gameName,
    offerId,
    buyerName: buyer?.full_name ?? 'Buyer',
  });

  revalidatePath('/account/wanted');
  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Accept wanted offer (role-dependent)
// Buyer accepts pending → seller must create listing
// Seller accepts countered → seller must create listing
// ============================================================================

export async function acceptWantedOffer(
  offerId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: offer, error: loadError } = await supabase
    .from('wanted_offers')
    .select('id, seller_id, buyer_id, status, price_cents, counter_price_cents, wanted_listings:wanted_listing_id (game_name)')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };

  const isBuyer = offer.buyer_id === user.id;
  const isSeller = offer.seller_id === user.id;

  // Buyer accepts pending offers; seller accepts countered offers
  if (isBuyer && offer.status !== 'pending') {
    return { error: 'Can only accept pending offers' };
  }
  if (isSeller && offer.status !== 'countered') {
    return { error: 'Can only accept countered offers' };
  }
  if (!isBuyer && !isSeller) {
    return { error: 'You are not a party to this offer' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('wanted_offers')
    .update({ status: 'accepted' })
    .eq('id', offerId)
    .eq('status', offer.status);

  if (error) return { error: 'Failed to accept offer' };

  const gameName = extractGameName(offer.wanted_listings);
  const agreedPrice = offer.counter_price_cents ?? offer.price_cents;

  // Email both parties (non-blocking)
  const profiles = await fetchProfiles(supabase, [offer.buyer_id, offer.seller_id]);
  const buyer = profiles.get(offer.buyer_id);
  const seller = profiles.get(offer.seller_id);

  if (buyer?.email && seller?.email) {
    sendWantedOfferAccepted({
      sellerName: seller.full_name,
      sellerEmail: seller.email,
      buyerName: buyer.full_name,
      buyerEmail: buyer.email,
      gameName,
      agreedPriceCents: agreedPrice,
      offerId,
    }).catch(() => {});
  }

  // Notify both parties (non-blocking)
  void notify(offer.buyer_id, 'wanted.offer_accepted', {
    gameName,
    offerId,
  });
  void notify(offer.seller_id, 'wanted.offer_accepted', {
    gameName,
    offerId,
  });

  revalidatePath('/account/wanted');
  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Decline wanted offer (role-dependent)
// ============================================================================

export async function declineWantedOffer(
  offerId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: offer, error: loadError } = await supabase
    .from('wanted_offers')
    .select('id, seller_id, buyer_id, status, wanted_listings:wanted_listing_id (game_name)')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };

  const isBuyer = offer.buyer_id === user.id;
  const isSeller = offer.seller_id === user.id;

  // Buyer declines pending offers; seller declines countered offers
  if (isBuyer && offer.status !== 'pending') {
    return { error: 'Can only decline pending offers' };
  }
  if (isSeller && offer.status !== 'countered') {
    return { error: 'Can only decline countered offers' };
  }
  if (!isBuyer && !isSeller) {
    return { error: 'You are not a party to this offer' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('wanted_offers')
    .update({ status: 'declined' })
    .eq('id', offerId)
    .eq('status', offer.status);

  if (error) return { error: 'Failed to decline offer' };

  const gameName = extractGameName(offer.wanted_listings);

  // Notify + email the other party
  const otherPartyId = isBuyer ? offer.seller_id : offer.buyer_id;
  const profiles = await fetchProfiles(supabase, [user.id, otherPartyId]);
  const currentUser = profiles.get(user.id);
  const otherParty = profiles.get(otherPartyId);

  if (otherParty?.email && currentUser?.full_name) {
    sendWantedOfferDeclined({
      recipientName: otherParty.full_name,
      recipientEmail: otherParty.email,
      otherPartyName: currentUser.full_name,
      gameName,
    }).catch(() => {});
  }

  if (isBuyer) {
    void notify(offer.seller_id, 'wanted.offer_declined', {
      gameName,
      offerId,
      buyerName: currentUser?.full_name ?? 'Buyer',
    });
  } else {
    void notify(offer.buyer_id, 'wanted.offer_declined', {
      gameName,
      offerId,
      sellerName: currentUser?.full_name ?? 'Seller',
    });
  }

  revalidatePath('/account/wanted');
  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Cancel wanted offer (seller only — cancel their own offer)
// ============================================================================

export async function cancelWantedOffer(
  offerId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: offer, error: loadError } = await supabase
    .from('wanted_offers')
    .select('id, seller_id, status')
    .eq('id', offerId)
    .single();

  if (loadError || !offer) return { error: 'Offer not found' };
  if (offer.seller_id !== user.id) return { error: 'Only the seller can cancel their offer' };
  if (offer.status !== 'pending' && offer.status !== 'countered') {
    return { error: 'Can only cancel active offers' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('wanted_offers')
    .update({ status: 'cancelled' })
    .eq('id', offerId)
    .in('status', ['pending', 'countered']);

  if (error) return { error: 'Failed to cancel offer' };

  revalidatePath('/account/wanted');
  revalidatePath('/account/offers');
  return { success: true };
}

// ============================================================================
// Queries
// ============================================================================

const WANTED_OFFER_SELECT = `
  *,
  wanted_listings:wanted_listing_id (game_name, game_year, games:bgg_game_id (thumbnail)),
  buyer:buyer_id (full_name),
  seller:seller_id (full_name)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWantedOfferRow(row: any): WantedOfferWithDetails {
  const wanted = row.wanted_listings ?? {};
  const game = wanted.games ?? {};

  return {
    id: row.id,
    wanted_listing_id: row.wanted_listing_id,
    seller_id: row.seller_id,
    buyer_id: row.buyer_id,
    condition: row.condition,
    price_cents: row.price_cents,
    note: row.note,
    counter_price_cents: row.counter_price_cents,
    status: row.status as WantedOfferStatus,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    game_name: wanted.game_name ?? '',
    game_year: wanted.game_year ?? null,
    thumbnail: game.thumbnail ?? null,
    buyer_name: row.buyer?.full_name ?? '',
    seller_name: row.seller?.full_name ?? '',
  };
}

/** Buyer's received wanted offers (on their wanted listings) */
export async function getMyWantedOffers(): Promise<WantedOfferWithDetails[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('wanted_offers')
    .select(WANTED_OFFER_SELECT)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapWantedOfferRow);
}

/** Seller's sent wanted offers */
export async function getSellerWantedOffers(): Promise<WantedOfferWithDetails[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('wanted_offers')
    .select(WANTED_OFFER_SELECT)
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapWantedOfferRow);
}

// ============================================================================
// Decline active offers on a wanted listing (used when listing is cancelled)
// ============================================================================

export async function declineActiveWantedOffers(
  wantedListingId: string
): Promise<void> {
  const service = createServiceClient();

  await service
    .from('wanted_offers')
    .update({ status: 'declined' })
    .eq('wanted_listing_id', wantedListingId)
    .in('status', ['pending', 'countered']);
}

// ============================================================================
// Helpers
// ============================================================================

function extractGameName(wantedListings: unknown): string {
  return (wantedListings as { game_name: string } | null)?.game_name ?? '';
}
