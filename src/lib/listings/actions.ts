'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';
import type { CreateListingData, UpdateListingData } from './types';
import {
  LISTING_CONDITIONS,
  MIN_PRICE_CENTS,
  MAX_PRICE_CENTS,
  MAX_GAME_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
} from './types';

interface ListingFieldsToValidate {
  condition: string;
  price_cents: number;
  photos: string[];
  description: string | null;
  publisher: string | null;
  language: string | null;
  version_name: string | null;
  bgg_version_id: number | null;
}

/** Shared validation for listing fields common to create and update. */
function validateListingFields(
  data: ListingFieldsToValidate,
  photoUrlPrefix: string
): string | null {
  if (!LISTING_CONDITIONS.includes(data.condition as (typeof LISTING_CONDITIONS)[number])) {
    return 'Invalid condition selected';
  }

  if (
    !data.price_cents ||
    !Number.isFinite(data.price_cents) ||
    !Number.isInteger(data.price_cents) ||
    data.price_cents < MIN_PRICE_CENTS ||
    data.price_cents > MAX_PRICE_CENTS
  ) {
    return `Price must be between ${formatCentsToCurrency(MIN_PRICE_CENTS)} and ${formatCentsToCurrency(MAX_PRICE_CENTS)}`;
  }

  if (!data.photos || data.photos.length < 1) {
    return 'At least one photo is required';
  }

  for (const photo of data.photos) {
    if (!photo.startsWith(photoUrlPrefix)) {
      return 'Invalid photo URL detected';
    }
  }

  if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`;
  }

  if (data.publisher && data.publisher.length > MAX_TEXT_FIELD_LENGTH) {
    return `Publisher must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`;
  }

  if (data.language && data.language.length > MAX_TEXT_FIELD_LENGTH) {
    return `Language must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`;
  }

  if (data.version_name && data.version_name.length > MAX_TEXT_FIELD_LENGTH) {
    return `Version name must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`;
  }

  if (data.bgg_version_id != null && (!Number.isInteger(data.bgg_version_id) || data.bgg_version_id <= 0)) {
    return 'Invalid BGG version selected';
  }

  return null;
}

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

  // Create-specific validations
  if (!data.bgg_game_id || data.bgg_game_id <= 0) {
    return { error: 'A valid game must be selected' };
  }

  if (data.game_name && data.game_name.length > MAX_GAME_NAME_LENGTH) {
    return { error: `Game name must be ${MAX_GAME_NAME_LENGTH} characters or fewer` };
  }

  // Shared field validations
  const photoUrlPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${user.id}/`;
  const fieldError = validateListingFields(data, photoUrlPrefix);
  if (fieldError) return { error: fieldError };

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

export async function updateListing(
  data: UpdateListingData,
  turnstileToken?: string
): Promise<{ success: true } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in' };
  }

  // Fetch listing and verify ownership
  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('seller_id, status, photos')
    .eq('id', data.id)
    .single();

  if (fetchError || !listing) {
    return { error: 'Listing not found' };
  }

  if (listing.seller_id !== user.id) {
    return { error: 'Listing not found' };
  }

  if (listing.status !== 'active') {
    return { error: 'Only active listings can be edited' };
  }

  // Shared field validations
  const photoUrlPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${user.id}/`;
  const fieldError = validateListingFields(data, photoUrlPrefix);
  if (fieldError) return { error: fieldError };

  // Clean up removed photos from storage
  const oldPhotos: string[] = (listing.photos as string[]) ?? [];
  const removedPhotos = oldPhotos.filter((p) => !data.photos.includes(p));

  if (removedPhotos.length > 0) {
    const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/`;
    const pathsToRemove = removedPhotos
      .map((url) => url.replace(storagePrefix, ''))
      .filter((path) => path.length > 0);

    if (pathsToRemove.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('listing-photos')
        .remove(pathsToRemove);

      if (storageError) {
        console.error('Failed to clean up removed photos:', storageError);
      }
    }
  }

  // Update listing
  const { error: updateError } = await supabase
    .from('listings')
    .update({
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
    })
    .eq('id', data.id)
    .eq('seller_id', user.id);

  if (updateError) {
    return { error: 'Something went wrong. Please try again' };
  }

  revalidatePath(`/listings/${data.id}`);

  return { success: true };
}

export async function cancelListing(
  listingId: string,
  turnstileToken?: string
): Promise<{ success: true } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in' };
  }

  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('seller_id, status')
    .eq('id', listingId)
    .single();

  if (fetchError || !listing) {
    return { error: 'Listing not found' };
  }

  if (listing.seller_id !== user.id) {
    return { error: 'Listing not found' };
  }

  if (listing.status === 'reserved') {
    return { error: 'Cannot remove a reserved listing' };
  }

  if (listing.status === 'sold' || listing.status === 'cancelled') {
    return { error: 'This listing has already been removed' };
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update({ status: 'cancelled' })
    .eq('id', listingId)
    .eq('seller_id', user.id);

  if (updateError) {
    return { error: 'Something went wrong. Please try again' };
  }

  revalidatePath(`/listings/${listingId}`);
  revalidatePath('/account/listings');

  return { success: true };
}
