'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import type { ShelfVisibility, ShelfItemWithGame } from './types';
import { SHELF_VISIBILITIES, MAX_NOTE_LENGTH } from './types';

// ============================================================================
// Shelf item CRUD
// ============================================================================

export async function addToShelf(
  bggGameId: number,
  gameName: string,
  gameYear: number | null,
  visibility: ShelfVisibility = 'not_for_sale',
  notes?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  if (!bggGameId || bggGameId <= 0) return { error: 'Invalid game' };
  if (!SHELF_VISIBILITIES.includes(visibility)) return { error: 'Invalid visibility' };
  if (notes && notes.length > MAX_NOTE_LENGTH) {
    return { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  const { data, error } = await supabase
    .from('shelf_items')
    .insert({
      seller_id: user.id,
      bgg_game_id: bggGameId,
      game_name: gameName,
      game_year: gameYear,
      visibility,
      notes: notes?.trim() || null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'This game is already on your shelf' };
    }
    return { error: 'Failed to add game to shelf' };
  }

  revalidatePath('/account/shelf');
  revalidatePath('/account');
  return { id: data.id };
}

export async function addBulkToShelf(
  items: { bggGameId: number; gameName: string; gameYear: number | null }[],
  bggUsername?: string
): Promise<{ added: number } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };
  if (!items.length) return { error: 'No games to add' };

  // Save BGG username if provided
  if (bggUsername?.trim()) {
    await supabase
      .from('user_profiles')
      .update({ bgg_username: bggUsername.trim() })
      .eq('id', user.id);
  }

  const rows = items.map((item) => ({
    seller_id: user.id,
    bgg_game_id: item.bggGameId,
    game_name: item.gameName,
    game_year: item.gameYear,
    visibility: 'not_for_sale' as const,
  }));

  // ON CONFLICT skip — ignoreDuplicates returns only newly inserted rows
  const { data, error } = await supabase
    .from('shelf_items')
    .upsert(rows, { onConflict: 'seller_id,bgg_game_id', ignoreDuplicates: true })
    .select('id');

  if (error) {
    return { error: 'Failed to import games' };
  }

  revalidatePath('/account/shelf');
  revalidatePath('/account');
  return { added: data?.length ?? 0 };
}

export async function updateShelfItem(
  id: string,
  visibility: ShelfVisibility,
  notes?: string | null
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };
  if (!SHELF_VISIBILITIES.includes(visibility)) return { error: 'Invalid visibility' };
  if (notes && notes.length > MAX_NOTE_LENGTH) {
    return { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer` };
  }

  // Cannot manually set to 'listed' — that happens via listing creation
  if (visibility === 'listed') {
    return { error: 'Cannot manually set visibility to listed' };
  }

  const { error } = await supabase
    .from('shelf_items')
    .update({
      visibility,
      notes: notes?.trim() || null,
    })
    .eq('id', id)
    .eq('seller_id', user.id); // RLS + explicit check

  if (error) {
    return { error: 'Failed to update shelf item' };
  }

  revalidatePath('/account/shelf');
  return { success: true };
}

export async function removeFromShelf(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { error } = await supabase
    .from('shelf_items')
    .delete()
    .eq('id', id)
    .eq('seller_id', user.id);

  if (error) {
    return { error: 'Failed to remove game from shelf' };
  }

  revalidatePath('/account/shelf');
  return { success: true };
}

// ============================================================================
// Shelf queries
// ============================================================================

const SHELF_SELECT = `*, games:bgg_game_id (thumbnail, image)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShelfRow(item: any): ShelfItemWithGame {
  const games = item.games as { thumbnail: string | null; image: string | null } | null;
  return {
    ...item,
    thumbnail: games?.thumbnail ?? null,
    image: games?.image ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchShelfItems(supabase: { from: (table: string) => any }, sellerId: string): Promise<ShelfItemWithGame[]> {
  const { data } = await supabase
    .from('shelf_items')
    .select(SHELF_SELECT)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapShelfRow);
}

export async function getMyShelf(): Promise<ShelfItemWithGame[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];
  return fetchShelfItems(supabase, user.id);
}

export async function getSellerShelf(sellerId: string): Promise<ShelfItemWithGame[]> {
  const supabase = await createClient();
  return fetchShelfItems(supabase, sellerId);
}

// ============================================================================
// Shelf-listing link (used by accept flow and auto-link)
// ============================================================================

export async function linkListingToShelfItem(
  shelfItemId: string,
  listingId: string
): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('shelf_items')
    .update({ visibility: 'listed', listing_id: listingId })
    .eq('id', shelfItemId);
}

export async function unlinkShelfItem(
  shelfItemId: string,
  newVisibility: ShelfVisibility = 'open_to_offers'
): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('shelf_items')
    .update({ visibility: newVisibility, listing_id: null })
    .eq('id', shelfItemId);
}

// ============================================================================
// BGG username
// ============================================================================

export async function updateBggUsername(
  username: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const trimmed = username.trim();
  if (trimmed.length > 50) return { error: 'Username too long' };

  const { error } = await supabase
    .from('user_profiles')
    .update({ bgg_username: trimmed || null })
    .eq('id', user.id);

  if (error) return { error: 'Failed to update BGG username' };

  return { success: true };
}
