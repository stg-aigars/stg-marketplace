'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';
import { sendOfferListingCreatedToBuyer, sendOfferSupersededToBuyer, sendWantedListingCreatedToBuyer } from '@/lib/email';
import { fetchProfiles } from '@/lib/supabase/helpers';
import { notify } from '@/lib/notifications';
import { ACTIVE_OFFER_STATUSES } from '@/lib/shelves/types';
import type { CreateListingData, ListingCondition, UpdateListingData } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

  // Fetch seller profile to get country
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('country')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.country) {
    return { error: 'Could not load your profile. Please complete your profile first' };
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

  // If created from an accepted offer, link shelf item and complete the offer
  if (data.offer_id) {

    if (UUID_RE.test(data.offer_id)) {
      await linkOfferToListing(data.offer_id, listing.id, user.id, data.bgg_game_id, data.price_cents);
    }
  } else if (data.wanted_offer_id) {
    // Created from an accepted wanted offer: complete the offer + fill the wanted listing

    if (UUID_RE.test(data.wanted_offer_id)) {
      await linkWantedOfferToListing(data.wanted_offer_id, listing.id, user.id);
    }
  } else {
    // Regular listing (not from offer): auto-link to shelf + decline stale offers
    await autoLinkListingToShelf(user.id, data.bgg_game_id, listing.id);
  }

  revalidatePath('/account/shelf');
  revalidatePath('/account');
  return { listingId: listing.id };
}

/**
 * After creating a listing from an accepted offer:
 * 1. Mark offer as completed
 * 2. Update shelf item: visibility → listed, listing_id → new listing
 * 3. Email buyer with link to the new listing
 *
 * Uses service role for cross-table writes not covered by RLS.
 * Non-blocking: errors are logged but don't fail listing creation.
 */
async function linkOfferToListing(
  offerId: string,
  listingId: string,
  sellerId: string,
  bggGameId: number,
  listingPriceCents: number,
) {
  try {
    const service = createServiceClient();

    // Fetch offer + shelf item to verify game ID, price, and get game_name
    const { data: offer } = await service
      .from('offers')
      .select(`
        id, shelf_item_id, buyer_id, amount_cents, counter_amount_cents,
        shelf_items:shelf_item_id (bgg_game_id, game_name)
      `)
      .eq('id', offerId)
      .eq('seller_id', sellerId)
      .eq('status', 'accepted')
      .single();

    if (!offer) return;

    const shelfItem = offer.shelf_items as unknown as { bgg_game_id: number; game_name: string } | null;

    // Verify game ID matches
    if (shelfItem?.bgg_game_id !== bggGameId) {
      console.warn('[Offer] Game ID mismatch, skipping offer link');
      return;
    }

    // Verify price matches agreed amount
    const agreedPrice = offer.counter_amount_cents ?? offer.amount_cents;
    if (listingPriceCents !== agreedPrice) {
      console.warn('[Offer] Price mismatch, skipping offer link');
      return;
    }

    // Complete offer, update shelf item, and fetch buyer profile in parallel
    const [, , { data: buyer }] = await Promise.all([
      service.from('offers').update({ status: 'completed' }).eq('id', offer.id),
      service.from('shelf_items')
        .update({ visibility: 'listed', listing_id: listingId })
        .eq('id', offer.shelf_item_id)
        .eq('seller_id', sellerId),
      service.from('user_profiles')
        .select('full_name, email')
        .eq('id', offer.buyer_id)
        .single(),
    ]);

    if (buyer?.email) {
      sendOfferListingCreatedToBuyer({
        buyerName: buyer.full_name,
        buyerEmail: buyer.email,
        gameName: shelfItem?.game_name ?? '',
        listingId,
      }).catch((err) => console.error('[Offer] Failed to email buyer:', err));
    }

    void notify(offer.buyer_id, 'offer.listing_created', {
      gameName: shelfItem?.game_name ?? '',
      listingId,
    });
  } catch (err) {
    console.error('[Offer] linkOfferToListing failed:', err);
  }
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

  // Reset shelf item back to open_to_offers
  await syncShelfOnListingRemoved(user.id, listingId);

  revalidatePath(`/listings/${listingId}`);
  revalidatePath('/account/listings');
  revalidatePath('/account/shelf');

  return { success: true };
}

// ============================================================================
// Checkout reservation
// ============================================================================

/**
 * Reserve a listing when the buyer lands on the checkout page.
 * Uses a two-query approach: attempt UPDATE, then SELECT to disambiguate on failure.
 * `reserved_at` is set once and NOT refreshed on revisit (hard 30-min TTL).
 */
export type ReservationError = 'reserved_by_other' | 'unavailable' | 'unauthenticated';

export async function reserveListingForCheckout(
  listingId: string
): Promise<{ success: true; reservedAt: string } | { error: string; code: ReservationError }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in', code: 'unauthenticated' };
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  // Attempt atomic reservation — only succeeds if listing is currently active
  const { data: reserved } = await service
    .from('listings')
    .update({
      status: 'reserved',
      reserved_at: now,
      reserved_by: user.id,
    })
    .eq('id', listingId)
    .eq('status', 'active')
    .select('id, reserved_at')
    .single();

  if (reserved) {
    return { success: true, reservedAt: now };
  }

  // UPDATE matched zero rows — fetch current state to distinguish why
  const { data: current } = await service
    .from('listings')
    .select('status, reserved_by, reserved_at')
    .eq('id', listingId)
    .single();

  if (!current) {
    return { error: 'This listing is no longer available', code: 'unavailable' };
  }

  if (current.status === 'reserved' && current.reserved_by === user.id) {
    // Already reserved by this buyer (page refresh / back button) — idempotent success
    return { success: true, reservedAt: current.reserved_at! };
  }

  if (current.status === 'reserved') {
    return { error: 'This listing is currently reserved by another buyer', code: 'reserved_by_other' };
  }

  return { error: 'This listing is no longer available', code: 'unavailable' };
}

// ============================================================================
// Shelf sync helpers
// ============================================================================

/**
 * When a seller creates a regular listing (not from offer), check if they have
 * a shelf item for the same game. If so:
 * 1. Link the shelf item to this listing (visibility → listed)
 * 2. Auto-decline any active offers on that shelf item
 * 3. Email affected buyers with link to the new listing
 */
async function autoLinkListingToShelf(
  sellerId: string,
  bggGameId: number,
  listingId: string,
) {
  try {
    const service = createServiceClient();

    // Find shelf item for this game
    const { data: shelfItem } = await service
      .from('shelf_items')
      .select('id, game_name')
      .eq('seller_id', sellerId)
      .eq('bgg_game_id', bggGameId)
      .single();

    if (!shelfItem) return;

    // Link shelf item to listing
    await service
      .from('shelf_items')
      .update({ visibility: 'listed', listing_id: listingId })
      .eq('id', shelfItem.id);

    // Find and decline active offers
    const { data: activeOffers } = await service
      .from('offers')
      .select('id, buyer_id')
      .eq('shelf_item_id', shelfItem.id)
      .in('status', ACTIVE_OFFER_STATUSES);

    if (!activeOffers?.length) return;

    // Decline all active offers
    await service
      .from('offers')
      .update({ status: 'declined' })
      .in('id', activeOffers.map((o) => o.id));

    // Fetch seller name + buyer profiles for email
    const buyerIds = Array.from(new Set(activeOffers.map((o) => o.buyer_id)));
    const [{ data: seller }, { data: buyers }] = await Promise.all([
      service.from('user_profiles').select('full_name').eq('id', sellerId).single(),
      service.from('user_profiles').select('id, full_name, email').in('id', buyerIds),
    ]);

    const buyerMap = new Map((buyers ?? []).map((b) => [b.id, b]));
    for (const offer of activeOffers) {
      const buyer = buyerMap.get(offer.buyer_id);
      if (buyer?.email) {
        sendOfferSupersededToBuyer({
          buyerName: buyer.full_name,
          buyerEmail: buyer.email,
          sellerName: seller?.full_name ?? 'Seller',
          gameName: shelfItem.game_name,
          listingId,
        }).catch((err) => console.error('[Shelf] Failed to email superseded offer:', err));
      }

      void notify(offer.buyer_id, 'offer.superseded', {
        gameName: shelfItem.game_name,
        listingId,
        sellerName: seller?.full_name ?? 'Seller',
      });
    }
  } catch (err) {
    console.error('[Shelf] autoLinkListingToShelf failed:', err);
  }
}

/**
 * When a listing is created from an accepted wanted offer:
 * 1. Link the listing to the wanted offer (set wanted_offer_id)
 * 2. Complete the wanted offer (status → completed)
 * 3. Fill the wanted listing (status → filled)
 * 4. Decline other active offers on the wanted listing
 * 5. Notify the buyer
 */
async function linkWantedOfferToListing(wantedOfferId: string, listingId: string, sellerId: string) {
  try {
    const service = createServiceClient();

    // Fetch the wanted offer — verify seller ownership
    const { data: offer } = await service
      .from('wanted_offers')
      .select('id, wanted_listing_id, buyer_id, wanted_listings:wanted_listing_id (game_name)')
      .eq('id', wantedOfferId)
      .eq('seller_id', sellerId)
      .eq('status', 'accepted')
      .single();

    if (!offer) return;

    // Run all updates in parallel — no data dependencies between them
    await Promise.all([
      service.from('listings').update({ wanted_offer_id: wantedOfferId }).eq('id', listingId),
      service.from('wanted_offers').update({ status: 'completed' }).eq('id', wantedOfferId),
      service.from('wanted_listings').update({ status: 'filled' }).eq('id', offer.wanted_listing_id),
      service.from('wanted_offers').update({ status: 'declined' })
        .eq('wanted_listing_id', offer.wanted_listing_id)
        .neq('id', wantedOfferId)
        .in('status', ['pending', 'countered']),
    ]);

    // Fetch profiles for email (single batch query)
    const profiles = await fetchProfiles(service, [sellerId, offer.buyer_id]);
    const sellerProfile = profiles.get(sellerId);
    const buyerProfile = profiles.get(offer.buyer_id);
    const gameName = (offer.wanted_listings as unknown as { game_name: string } | null)?.game_name ?? 'a game';

    if (buyerProfile?.email && sellerProfile?.full_name) {
      sendWantedListingCreatedToBuyer({
        buyerName: buyerProfile.full_name,
        buyerEmail: buyerProfile.email,
        sellerName: sellerProfile.full_name,
        gameName,
        listingId,
      }).catch(() => {});
    }

    void notify(offer.buyer_id, 'wanted.listing_created', {
      gameName,
      listingId,
    });
    void notify(offer.buyer_id, 'wanted.filled', {
      gameName,
    });
  } catch (err) {
    console.error('[Wanted] linkWantedOfferToListing failed:', err);
  }
}

/**
 * When a listing is cancelled, reset the linked shelf item back to open_to_offers.
 */
export async function syncShelfOnListingRemoved(sellerId: string, listingId: string) {
  try {
    const service = createServiceClient();
    await service
      .from('shelf_items')
      .update({ visibility: 'open_to_offers', listing_id: null })
      .eq('listing_id', listingId)
      .eq('seller_id', sellerId);
  } catch (err) {
    console.error('[Shelf] syncShelfOnListingRemoved failed:', err);
  }
}

/**
 * When an order is completed (game sold), set the shelf item to not_for_sale.
 * Called from order-transitions after order completion.
 */
export async function syncShelfOnListingSold(sellerId: string, listingId: string) {
  try {
    const service = createServiceClient();
    await service
      .from('shelf_items')
      .update({ visibility: 'not_for_sale' })
      .eq('listing_id', listingId)
      .eq('seller_id', sellerId);
  } catch (err) {
    console.error('[Shelf] syncShelfOnListingSold failed:', err);
  }
}
