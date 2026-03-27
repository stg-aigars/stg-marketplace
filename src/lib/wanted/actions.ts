'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { LISTING_CONDITIONS, type ListingCondition } from '@/lib/listings/types';
import type { WantedListingWithGame, WantedListingWithDetails } from './types';
import { MAX_NOTE_LENGTH } from './types';

// ============================================================================
// Create wanted listing
// ============================================================================

export async function createWantedListing(
  bggGameId: number,
  gameName: string,
  gameYear: number | null,
  minCondition: ListingCondition,
  maxPriceCents: number | null,
  notes?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };
  if (!bggGameId || bggGameId <= 0) return { error: 'Invalid game' };
  if (!LISTING_CONDITIONS.includes(minCondition)) return { error: 'Invalid condition' };
  if (maxPriceCents != null && (!Number.isInteger(maxPriceCents) || maxPriceCents < 50 || maxPriceCents > 9999999)) {
    return { error: 'Invalid budget amount' };
  }
  if (notes && notes.length > MAX_NOTE_LENGTH) {
    return { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  // Fetch buyer's country
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('country')
    .eq('id', user.id)
    .single();

  if (!profile) return { error: 'Profile not found' };

  const { data, error } = await supabase
    .from('wanted_listings')
    .insert({
      buyer_id: user.id,
      bgg_game_id: bggGameId,
      game_name: gameName,
      game_year: gameYear,
      min_condition: minCondition,
      max_price_cents: maxPriceCents,
      notes: notes?.trim() || null,
      country: profile.country,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'You already have an active wanted listing for this game' };
    }
    return { error: 'Failed to create wanted listing' };
  }

  revalidatePath('/account/wanted');
  revalidatePath('/wanted');
  return { id: data.id };
}

// ============================================================================
// Update wanted listing
// ============================================================================

export async function updateWantedListing(
  id: string,
  minCondition: ListingCondition,
  maxPriceCents: number | null,
  notes?: string | null
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };
  if (!LISTING_CONDITIONS.includes(minCondition)) return { error: 'Invalid condition' };
  if (maxPriceCents != null && (!Number.isInteger(maxPriceCents) || maxPriceCents < 50 || maxPriceCents > 9999999)) {
    return { error: 'Invalid budget amount' };
  }
  if (notes && notes.length > MAX_NOTE_LENGTH) {
    return { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  const { error } = await supabase
    .from('wanted_listings')
    .update({
      min_condition: minCondition,
      max_price_cents: maxPriceCents,
      notes: notes?.trim() || null,
    })
    .eq('id', id)
    .eq('buyer_id', user.id)
    .eq('status', 'active');

  if (error) return { error: 'Failed to update wanted listing' };

  revalidatePath('/account/wanted');
  revalidatePath('/wanted');
  return { success: true };
}

// ============================================================================
// Cancel wanted listing (auto-declines active offers)
// ============================================================================

export async function cancelWantedListing(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  // Verify ownership and active status
  const { data: listing, error: loadError } = await supabase
    .from('wanted_listings')
    .select('id, buyer_id, status')
    .eq('id', id)
    .single();

  if (loadError || !listing) return { error: 'Wanted listing not found' };
  if (listing.buyer_id !== user.id) return { error: 'You can only cancel your own wanted listings' };
  if (listing.status !== 'active') return { error: 'Can only cancel active wanted listings' };

  const service = createServiceClient();

  // Decline all active offers on this wanted listing
  await service
    .from('wanted_offers')
    .update({ status: 'declined' })
    .eq('wanted_listing_id', id)
    .in('status', ['pending', 'countered']);

  // Cancel the wanted listing
  const { error } = await service
    .from('wanted_listings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'active');

  if (error) return { error: 'Failed to cancel wanted listing' };

  revalidatePath('/account/wanted');
  revalidatePath('/wanted');
  return { success: true };
}

// ============================================================================
// Queries
// ============================================================================

const WANTED_LISTING_SELECT = `*, games:bgg_game_id (thumbnail, image)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWantedListingRow(row: any): WantedListingWithGame {
  const games = row.games as { thumbnail: string | null; image: string | null } | null;
  return {
    ...row,
    thumbnail: games?.thumbnail ?? null,
    image: games?.image ?? null,
  };
}

/** Buyer's own wanted listings */
export async function getMyWantedListings(): Promise<WantedListingWithGame[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('wanted_listings')
    .select(WANTED_LISTING_SELECT)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapWantedListingRow);
}

/** Single wanted listing with game details (for detail page) */
export async function getWantedListingById(
  id: string
): Promise<WantedListingWithDetails | null> {
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('wanted_listings')
    .select(`
      ${WANTED_LISTING_SELECT},
      buyer:buyer_id (full_name)
    `)
    .eq('id', id)
    .single();

  if (!listing) return null;

  // Count active offers on this wanted listing
  const service = createServiceClient();
  const { count } = await service
    .from('wanted_offers')
    .select('id', { count: 'exact', head: true })
    .eq('wanted_listing_id', id)
    .in('status', ['pending', 'countered', 'accepted']);

  const games = (listing as Record<string, unknown>).games as { thumbnail: string | null; image: string | null } | null;
  const buyer = (listing as Record<string, unknown>).buyer as { full_name: string | null } | null;

  return {
    ...listing,
    thumbnail: games?.thumbnail ?? null,
    image: games?.image ?? null,
    buyer_name: buyer?.full_name ?? null,
    offer_count: count ?? 0,
  } as WantedListingWithDetails;
}
