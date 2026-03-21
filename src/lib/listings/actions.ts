'use server';

import { createClient } from '@/lib/supabase/server';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';
import type { CreateListingData } from './types';
import {
  LISTING_CONDITIONS,
  MIN_PRICE_CENTS,
  MAX_PRICE_CENTS,
  MAX_GAME_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
} from './types';

export async function createListing(
  data: CreateListingData,
  turnstileToken?: string
): Promise<{ listingId: string } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to create a listing' };
  }

  // Validate inputs
  if (!data.bgg_game_id || data.bgg_game_id <= 0) {
    return { error: 'A valid game must be selected' };
  }

  if (!LISTING_CONDITIONS.includes(data.condition)) {
    return { error: 'Invalid condition selected' };
  }

  // Price validation
  if (
    !data.price_cents ||
    !Number.isFinite(data.price_cents) ||
    !Number.isInteger(data.price_cents) ||
    data.price_cents < MIN_PRICE_CENTS ||
    data.price_cents > MAX_PRICE_CENTS
  ) {
    return {
      error: `Price must be between ${formatCentsToCurrency(MIN_PRICE_CENTS)} and ${formatCentsToCurrency(MAX_PRICE_CENTS)}`,
    };
  }

  if (!data.photos || data.photos.length < 1) {
    return { error: 'At least one photo is required' };
  }

  // Validate photo URL origins
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const allowedPrefix = `${supabaseUrl}/storage/v1/object/public/listing-photos/${user.id}/`;

  for (const photo of data.photos) {
    if (!photo.startsWith(allowedPrefix)) {
      return { error: 'Invalid photo URL detected' };
    }
  }

  // String length validation
  if (data.game_name && data.game_name.length > MAX_GAME_NAME_LENGTH) {
    return { error: `Game name must be ${MAX_GAME_NAME_LENGTH} characters or fewer` };
  }

  if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` };
  }

  if (data.publisher && data.publisher.length > MAX_TEXT_FIELD_LENGTH) {
    return { error: `Publisher must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  if (data.language && data.language.length > MAX_TEXT_FIELD_LENGTH) {
    return { error: `Language must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  if (data.version_name && data.version_name.length > MAX_TEXT_FIELD_LENGTH) {
    return { error: `Version name must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer` };
  }

  // bgg_version_id validation
  if (data.bgg_version_id != null && (!Number.isInteger(data.bgg_version_id) || data.bgg_version_id <= 0)) {
    return { error: 'Invalid BGG version selected' };
  }

  // Fetch seller profile to get country
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('country')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.country) {
    return { error: 'Could not load your profile. Please complete your profile first' };
  }

  // Insert listing (RLS allows sellers to insert their own)
  const { data: listing, error: insertError } = await supabase
    .from('listings')
    .insert({
      seller_id: user.id,
      bgg_game_id: data.bgg_game_id,
      game_name: data.game_name,
      game_year: data.game_year,
      version_source: data.version_source,
      bgg_version_id: data.bgg_version_id,
      version_name: data.version_name,
      publisher: data.publisher,
      language: data.language,
      edition_year: data.edition_year,
      condition: data.condition,
      price_cents: data.price_cents,
      description: data.description,
      photos: data.photos,
      country: profile.country,
    })
    .select('id')
    .single();

  if (insertError) {
    return { error: 'Something went wrong. Please try again' };
  }

  return { listingId: listing.id };
}
