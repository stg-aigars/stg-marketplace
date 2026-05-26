'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { wantedCreateLimiter, checkUserRateLimit } from '@/lib/rate-limit';
import { trackServer } from '@/lib/analytics/track-server';
import type { WantedListingWithGame, WantedListingWithDetails, EditionPayload } from './types';
import { MAX_NOTE_LENGTH } from './types';

function revalidateWantedPaths(id?: string) {
  revalidatePath('/account/wanted');
  revalidatePath('/wanted');
  if (id) revalidatePath(`/wanted/${id}`);
}

// ============================================================================
// Create wanted listing
// ============================================================================

export async function createWantedListing(
  bggGameId: number,
  gameName: string,
  gameYear: number | null,
  edition: EditionPayload | null,
  notes?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const limited = checkUserRateLimit(wantedCreateLimiter, user.id, 'wanted_create', 'Too many wanted listings created. Please wait a moment.');
  if (limited) return limited;

  if (!bggGameId || bggGameId <= 0) return { error: 'Invalid game' };
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
      version_source: edition?.versionSource ?? null,
      bgg_version_id: edition?.bggVersionId ?? null,
      version_name: edition?.versionName ?? null,
      publisher: edition?.publisher ?? null,
      language: edition?.language ?? null,
      edition_year: edition?.editionYear ?? null,
      version_thumbnail: edition?.versionThumbnail ?? null,
      notes: notes?.trim() || null,
      country: profile.country,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'You already have an active wanted listing for this game' };
    }
    console.error('[Wanted] Failed to create:', error);
    return { error: 'Failed to create wanted listing' };
  }

  void trackServer('wanted_listing_created', user.id, {
    wanted_listing_id: data.id,
    bgg_game_id: bggGameId,
    has_edition_preference: edition !== null,
  });

  revalidateWantedPaths();
  return { id: data.id };
}

// ============================================================================
// Update wanted listing (edition + notes; game identity is fixed)
// ============================================================================

export async function updateWantedListing(
  id: string,
  edition: EditionPayload | null,
  notes?: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };
  if (notes && notes.length > MAX_NOTE_LENGTH) {
    return { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  const { data: listing, error: loadError } = await supabase
    .from('wanted_listings')
    .select('id, buyer_id, status')
    .eq('id', id)
    .single();

  if (loadError || !listing) return { error: 'Wanted listing not found' };
  if (listing.buyer_id !== user.id) return { error: 'You can only edit your own wanted listings' };
  if (listing.status !== 'active') return { error: 'Can only edit active wanted listings' };

  const service = createServiceClient();

  const { error } = await service
    .from('wanted_listings')
    .update({
      version_source: edition?.versionSource ?? null,
      bgg_version_id: edition?.bggVersionId ?? null,
      version_name: edition?.versionName ?? null,
      publisher: edition?.publisher ?? null,
      language: edition?.language ?? null,
      edition_year: edition?.editionYear ?? null,
      version_thumbnail: edition?.versionThumbnail ?? null,
      notes: notes?.trim() || null,
    })
    .eq('id', id)
    .eq('buyer_id', user.id)
    .eq('status', 'active');

  if (error) {
    console.error('[Wanted] Failed to update:', error);
    return { error: 'Failed to update wanted listing' };
  }

  revalidateWantedPaths(id);
  return { success: true };
}

// ============================================================================
// Cancel wanted listing
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

  const { error } = await service
    .from('wanted_listings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'active');

  if (error) return { error: 'Failed to cancel wanted listing' };

  revalidateWantedPaths();
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

/** Single wanted listing with full game metadata (for detail page) */
export async function getWantedListingById(
  id: string
): Promise<WantedListingWithDetails | null> {
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('wanted_listings')
    .select(`
      *,
      games:bgg_game_id (name, yearpublished, thumbnail, image, player_count, min_players, max_players, min_age, playing_time, description, weight, categories, mechanics)
    `)
    .eq('id', id)
    .single();

  if (!listing) return null;

  // Fetch buyer profile separately (public_profiles view — safe for anonymous access)
  const { data: buyerProfile } = await supabase
    .from('public_profiles')
    .select('full_name, avatar_url, created_at')
    .eq('id', (listing as { buyer_id: string }).buyer_id)
    .single<{ full_name: string | null; avatar_url: string | null; created_at: string | null }>();

  const games = (listing as Record<string, unknown>).games as {
    name: string | null;
    yearpublished: number | null;
    thumbnail: string | null;
    image: string | null;
    player_count: string | null;
    min_players: number | null;
    max_players: number | null;
    min_age: number | null;
    playing_time: string | null;
    description: string | null;
    weight: number | null;
    categories: string[] | null;
    mechanics: string[] | null;
  } | null;

  return {
    ...listing,
    thumbnail: games?.thumbnail ?? null,
    image: games?.image ?? null,
    game_display_name: games?.name ?? null,
    game_year_published: games?.yearpublished ?? null,
    player_count: games?.player_count ?? null,
    min_players: games?.min_players ?? null,
    max_players: games?.max_players ?? null,
    min_age: games?.min_age ?? null,
    playing_time: games?.playing_time ?? null,
    description: games?.description ?? null,
    weight: games?.weight ?? null,
    categories: games?.categories ?? null,
    mechanics: games?.mechanics ?? null,
    buyer_name: buyerProfile?.full_name ?? '',
    buyer_avatar_url: buyerProfile?.avatar_url ?? null,
    buyer_created_at: buyerProfile?.created_at ?? null,
  } as WantedListingWithDetails;
}
