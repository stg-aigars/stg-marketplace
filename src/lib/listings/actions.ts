'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';
import { sendWantedListingMatchedToBuyer } from '@/lib/email';
import { fetchProfiles } from '@/lib/supabase/helpers';
import { getConditionLabel } from '@/lib/condition-config';
import { notify } from '@/lib/notifications';
import { trackServer } from '@/lib/analytics/track-server';
import { SELLER_TERMS_VERSION } from '@/lib/legal/constants';
import { extractStoragePath } from './storage-utils';
import {
  LISTING_CONDITIONS,
  MIN_PRICE_CENTS,
  MAX_PRICE_CENTS,
  MAX_GAME_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
  conditionRequiresPhotos,
  conditionRequiresDescription,
  isAuctionWithBids,
  type CreateListingData,
  type ListingCondition,
  type UpdateListingData,
} from './types';

interface ListingFieldsToValidate {
  condition: ListingCondition;
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
  if (!LISTING_CONDITIONS.includes(data.condition)) {
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

  if (!data.photos) {
    data.photos = [];
  }

  for (const photo of data.photos) {
    if (!photo.startsWith(photoUrlPrefix)) {
      return 'Invalid photo URL detected';
    }
  }

  if (conditionRequiresPhotos(data.condition) && data.photos.length === 0) {
    return 'At least one photo is required for this condition';
  }

  if (conditionRequiresDescription(data.condition) && (!data.description || !data.description.trim())) {
    return 'A description is required for this condition';
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
  const turnstile = await verifyTurnstileToken(turnstileToken, await getServerActionIp());
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

  // Fetch seller profile to get country + DAC7 status + seller-terms acceptance
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('country, dac7_status, seller_terms_accepted_at, seller_terms_version')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.country) {
    return { error: 'Could not load your profile. Please complete your profile first' };
  }

  if (profile.dac7_status === 'blocked') {
    return { error: 'Your account is blocked. Please provide the required tax information in your account settings before creating listings' };
  }

  // Seller Terms gate — mirrors the page-level gate in app/[locale]/sell/page.tsx.
  // Fails closed if a tampered or bypassed client hits createListing without
  // first going through the SellerTermsAcceptanceGate.
  if (
    !profile.seller_terms_accepted_at ||
    profile.seller_terms_version !== SELLER_TERMS_VERSION
  ) {
    return { error: 'Please accept the Seller Agreement before creating a listing' };
  }

  // Build insert payload
  const isAuction = data.listing_type === 'auction';
  const insertPayload: Record<string, unknown> = {
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
    version_thumbnail: data.version_thumbnail ?? null,
    condition: data.condition,
    price_cents: isAuction ? data.starting_price_cents : data.price_cents,
    description: data.description,
    photos: data.photos,
    country: profile.country,
    listing_type: data.listing_type ?? 'fixed_price',
  };

  // Add auction-specific fields
  if (isAuction) {
    if (!data.auction_duration_days || !data.starting_price_cents) {
      return { error: 'Auction duration and starting price are required' };
    }
    const validDurations = [1, 3, 5, 7];
    if (!validDurations.includes(data.auction_duration_days)) {
      return { error: 'Invalid auction duration' };
    }
    const endAt = new Date(Date.now() + data.auction_duration_days * 24 * 60 * 60 * 1000).toISOString();
    insertPayload.starting_price_cents = data.starting_price_cents;
    insertPayload.auction_end_at = endAt;
    insertPayload.auction_original_end_at = endAt;
  }

  // Insert listing (RLS allows sellers to insert their own)
  const { data: listing, error: insertError } = await supabase
    .from('listings')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    return { error: 'Something went wrong. Please try again' };
  }

  void trackServer('listing_created', user.id, {
    listing_id: listing.id,
    bgg_game_id: data.bgg_game_id,
    price_cents: isAuction ? data.starting_price_cents! : data.price_cents,
    listing_type: data.listing_type ?? 'fixed_price',
  });

  // Insert expansion rows (non-blocking — listing exists even if this fails)
  if (data.expansions && data.expansions.length > 0) {
    // Self-reference guard: reject if any expansion matches the base game
    const validExpansions = data.expansions.filter((e) => e.bgg_game_id !== data.bgg_game_id);

    if (validExpansions.length > 0) {
      const service = createServiceClient();
      const expansionRows = validExpansions.map((e) => ({
        listing_id: listing.id,
        bgg_game_id: e.bgg_game_id,
        game_name: e.game_name,
        version_source: e.version_source ?? null,
        bgg_version_id: e.bgg_version_id ?? null,
        version_name: e.version_name ?? null,
        publisher: e.publisher ?? null,
        language: e.language ?? null,
        edition_year: e.edition_year ?? null,
        version_thumbnail: e.version_thumbnail ?? null,
      }));

      const { error: expError } = await service
        .from('listing_expansions')
        .insert(expansionRows);

      if (expError) {
        console.error('Failed to insert listing expansions:', expError);
        // Non-fatal — listing was created, seller can edit to add expansions later
      }
    }
  }

  // Notify buyers who have active wanted listings for this game (fire-and-forget)
  void notifyWantedListingMatches(
    data.bgg_game_id,
    user.id,
    listing.id,
    data.game_name,
    data.price_cents,
    data.condition,
    [data.language, data.publisher, data.edition_year].filter(Boolean).join(' · ') || null,
  ).catch((err) => console.error('[Wanted] notifyWantedListingMatches failed:', err));

  revalidatePath('/account');
  return { listingId: listing.id };
}

export async function updateListing(
  data: UpdateListingData,
  turnstileToken?: string
): Promise<{ success: true } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, await getServerActionIp());
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
    .select('seller_id, status, listing_type, bid_count, photos')
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

  if (isAuctionWithBids(listing.listing_type, listing.bid_count)) {
    return { error: 'Auctions with bids cannot be edited' };
  }

  // Game name validation
  if (!data.game_name || data.game_name.length > MAX_GAME_NAME_LENGTH) {
    return { error: `Game name must be ${MAX_GAME_NAME_LENGTH} characters or fewer` };
  }

  // Shared field validations
  const photoUrlPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${user.id}/`;
  const fieldError = validateListingFields(data, photoUrlPrefix);
  if (fieldError) return { error: fieldError };

  // Identify removed photos before updating (need old list for cleanup)
  const oldPhotos: string[] = (listing.photos as string[]) ?? [];
  const removedPhotos = oldPhotos.filter((p) => !data.photos.includes(p));

  // Update listing first — only clean up storage after DB succeeds
  // Uses service client because user-facing UPDATE policy was removed
  const service = createServiceClient();
  const { error: updateError } = await service
    .from('listings')
    .update({
      game_name: data.game_name,
      version_source: data.version_source,
      bgg_version_id: data.bgg_version_id,
      version_name: data.version_name,
      publisher: data.publisher,
      language: data.language,
      edition_year: data.edition_year,
      version_thumbnail: data.version_thumbnail,
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

  // Clean up removed photos from storage (after DB update succeeded)
  if (removedPhotos.length > 0) {
    const pathsToRemove = removedPhotos
      .map(extractStoragePath)
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

  // Sync expansion rows if provided
  if (data.expansions !== undefined) {
    // Self-reference guard: get base game ID to exclude from expansions
    const { data: baseGame } = await service
      .from('listings')
      .select('bgg_game_id')
      .eq('id', data.id)
      .single();
    const baseGameId = baseGame?.bgg_game_id;
    const validExpansions = (data.expansions ?? []).filter(
      (e) => e.bgg_game_id !== baseGameId
    );

    // Fetch existing expansions
    const { data: existing } = await service
      .from('listing_expansions')
      .select('id, bgg_game_id')
      .eq('listing_id', data.id);

    const existingIds = new Set((existing ?? []).map((e) => e.bgg_game_id));
    const newIds = new Set(validExpansions.map((e) => e.bgg_game_id));

    // Delete removed expansions
    const toRemove = (existing ?? []).filter((e) => !newIds.has(e.bgg_game_id));
    if (toRemove.length > 0) {
      await service
        .from('listing_expansions')
        .delete()
        .in('id', toRemove.map((e) => e.id));
    }

    // Insert new expansions
    const toAdd = validExpansions.filter((e) => !existingIds.has(e.bgg_game_id));
    if (toAdd.length > 0) {
      await service
        .from('listing_expansions')
        .insert(toAdd.map((e) => ({
          listing_id: data.id,
          bgg_game_id: e.bgg_game_id,
          game_name: e.game_name,
          version_source: e.version_source ?? null,
          bgg_version_id: e.bgg_version_id ?? null,
          version_name: e.version_name ?? null,
          publisher: e.publisher ?? null,
          language: e.language ?? null,
          edition_year: e.edition_year ?? null,
          version_thumbnail: e.version_thumbnail ?? null,
        })));
    }

    // Update changed versions for existing expansions (parallel)
    const toUpdate = validExpansions.filter((e) => existingIds.has(e.bgg_game_id));
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map((exp) =>
        service
          .from('listing_expansions')
          .update({
            game_name: exp.game_name,
            version_source: exp.version_source ?? null,
            bgg_version_id: exp.bgg_version_id ?? null,
            version_name: exp.version_name ?? null,
            publisher: exp.publisher ?? null,
            language: exp.language ?? null,
            edition_year: exp.edition_year ?? null,
            version_thumbnail: exp.version_thumbnail ?? null,
          })
          .eq('listing_id', data.id)
          .eq('bgg_game_id', exp.bgg_game_id)
      ));
    }
  }

  revalidatePath(`/listings/${data.id}`);

  return { success: true };
}

export async function cancelListing(
  listingId: string,
  turnstileToken?: string
): Promise<{ success: true } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, await getServerActionIp());
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
    .select('seller_id, status, listing_type, bid_count')
    .eq('id', listingId)
    .single();

  if (fetchError || !listing) {
    return { error: 'Listing not found' };
  }

  if (listing.seller_id !== user.id) {
    return { error: 'Listing not found' };
  }

  if (isAuctionWithBids(listing.listing_type, listing.bid_count)) {
    return { error: 'Cannot remove an auction that has bids' };
  }

  if (listing.status === 'reserved') {
    return { error: 'Cannot remove a reserved listing' };
  }

  if (listing.status === 'sold' || listing.status === 'cancelled') {
    return { error: 'This listing has already been removed' };
  }

  // Uses service client because user-facing UPDATE policy was removed
  const service = createServiceClient();
  const { error: updateError } = await service
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

/**
 * After a listing is created, check for active wanted listings matching the same game.
 * Notify each buyer via in-app notification + email. Fire-and-forget.
 */
async function notifyWantedListingMatches(
  bggGameId: number,
  sellerId: string,
  listingId: string,
  gameName: string,
  priceCents: number,
  condition: ListingCondition,
  listingEdition: string | null,
) {
  const service = createServiceClient();

  // Find active wanted listings for this game (exclude seller's own)
  const { data: matches } = await service
    .from('wanted_listings')
    .select('buyer_id, language, publisher, edition_year')
    .eq('bgg_game_id', bggGameId)
    .eq('status', 'active')
    .neq('buyer_id', sellerId)
    .limit(50);

  if (!matches?.length) return;

  const conditionLabel = getConditionLabel(condition);

  // Fetch all buyer profiles + seller profile in one batch
  const buyerIds = matches.map((m) => m.buyer_id);
  const profiles = await fetchProfiles(service, [sellerId, ...buyerIds]);
  const sellerProfile = profiles.get(sellerId);
  const sellerName = sellerProfile?.full_name ?? 'A seller';

  for (const match of matches) {
    const buyerProfile = profiles.get(match.buyer_id);
    const buyerEditionPreference = [match.language, match.publisher, match.edition_year]
      .filter(Boolean)
      .join(' · ') || null;

    // In-app notification
    void notify(match.buyer_id, 'wanted.listing_matched', {
      gameName,
      listingId,
    });

    // Email (non-blocking)
    if (buyerProfile?.email) {
      sendWantedListingMatchedToBuyer({
        buyerName: buyerProfile.full_name,
        buyerEmail: buyerProfile.email,
        sellerName,
        gameName,
        priceCents,
        condition: conditionLabel,
        listingEdition,
        buyerEditionPreference,
        listingId,
      }).catch((err) => console.error('[Wanted] Failed to email matched buyer:', err));
    }
  }
}
