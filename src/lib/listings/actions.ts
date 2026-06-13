'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { listingCreateLimiter, listingUpdateLimiter, checkUserRateLimit } from '@/lib/rate-limit';
import { sendWantedListingMatchedToBuyer, sendListingPriceDroppedToBuyer } from '@/lib/email';
import { fetchProfiles } from '@/lib/supabase/helpers';
import { getConditionLabel } from '@/lib/condition-config';
import { notifyMany } from '@/lib/notifications';
import { trackServer } from '@/lib/analytics/track-server';
import { SELLER_TERMS_VERSION } from '@/lib/legal/constants';
import { AUCTION_DURATIONS } from '@/lib/auctions/types';
import { extractStoragePath } from './storage-utils';
import {
  MAX_GAME_NAME_LENGTH,
  isAuctionWithBids,
  type CreateListingData,
  type ListingCondition,
  type UpdateListingData,
} from './types';
import { validateListingFields, sanitizeComponentUpgrades } from './validation';

export async function createListing(
  data: CreateListingData
): Promise<{ listingId: string } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to create a listing' };
  }

  const limited = checkUserRateLimit(listingCreateLimiter, user.id, 'listing_create', 'Too many listings created. Please wait a moment.');
  if (limited) return limited;

  // Create-specific validations
  if (!data.bgg_game_id || data.bgg_game_id <= 0) {
    return { error: 'A valid game must be selected' };
  }

  if (data.game_name && data.game_name.length > MAX_GAME_NAME_LENGTH) {
    return { error: `Game name must be ${MAX_GAME_NAME_LENGTH} characters or fewer` };
  }

  // Shared field validations
  const photoUrlPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${user.id}/`;
  // Normalize the seller-declared upgrades before validation so dedup/trim run
  // once and both the validation gate and the insert see the same clean array.
  data.component_upgrades = sanitizeComponentUpgrades(data.component_upgrades);
  const fieldError = validateListingFields(data, photoUrlPrefix);
  if (fieldError) return { error: fieldError };

  // Verify every referenced photo still exists in storage. The cleanup-photos
  // cron can sweep uploads from a long-running draft session before submit;
  // without this guard the listing would persist with dead URLs and render
  // broken images. URLs are guaranteed by validateListingFields to have the
  // shape {prefix}/{user_id}/{filename}, so slicing by prefix length yields
  // the storage file name directly.
  if (data.photos.length > 0) {
    const { data: storedFiles, error: listError } = await supabase.storage
      .from('listing-photos')
      .list(user.id, { limit: 200 });

    if (listError) {
      return { error: 'Could not verify your photos. Please try again' };
    }

    const storedNames = new Set((storedFiles ?? []).map((f) => f.name));
    const missing = data.photos.some((url) => !storedNames.has(url.slice(photoUrlPrefix.length)));

    if (missing) {
      return {
        error: 'One of your photos is no longer available. Please re-upload before submitting.',
      };
    }
  }

  // Fetch seller profile to get country + DAC7 status + seller-terms acceptance
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('country, dac7_status, seller_status, seller_terms_accepted_at, seller_terms_version')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.country) {
    return { error: 'Could not load your profile. Please complete your profile first' };
  }

  if (profile.dac7_status === 'blocked') {
    return { error: 'Your account is blocked. Please provide the required tax information in your account settings before creating listings' };
  }

  if (profile.seller_status === 'suspended') {
    return { error: 'Your selling privileges are suspended. Contact support if you think this is in error.' };
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
    component_upgrades:
      data.component_upgrades && data.component_upgrades.length > 0 ? data.component_upgrades : null,
  };

  // Add auction-specific fields
  if (isAuction) {
    if (!data.auction_duration_days || !data.starting_price_cents) {
      return { error: 'Auction duration and starting price are required' };
    }
    if (!(AUCTION_DURATIONS as readonly number[]).includes(data.auction_duration_days)) {
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
  data: UpdateListingData
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in' };
  }

  const limited = checkUserRateLimit(listingUpdateLimiter, user.id, 'listing_update', 'Too many edits. Please wait a moment.');
  if (limited) return limited;

  // Fetch listing and verify ownership.
  // Extra fields (price_cents, bgg_game_id, game_name, condition) feed the
  // post-update price-drop fan-out without a second round-trip.
  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('seller_id, status, listing_type, bid_count, photos, price_cents, bgg_game_id, game_name, condition')
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
  // Only normalize when the field is present — an undefined payload means "leave
  // upgrades unchanged", so we must not wipe existing ones with an empty array.
  if (data.component_upgrades !== undefined) {
    data.component_upgrades = sanitizeComponentUpgrades(data.component_upgrades);
  }
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
      ...(data.component_upgrades !== undefined
        ? {
            component_upgrades:
              data.component_upgrades.length > 0 ? data.component_upgrades : null,
          }
        : {}),
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

  // Price-drop fan-out — only for fixed-price listings whose price actually
  // dropped. Fire-and-forget (matches notifyWantedListingMatches pattern).
  // The DB trigger from migration 122 has already updated previous_price_cents
  // and price_changed_at server-side; this helper is just the user-facing ping.
  if (
    listing.listing_type === 'fixed_price' &&
    data.price_cents < (listing.price_cents as number)
  ) {
    void notifyWantedListingPriceDropped(
      listing.bgg_game_id as number,
      user.id,
      data.id,
      data.game_name,
      listing.price_cents as number,
      data.price_cents,
      listing.condition as ListingCondition,
      [data.language, data.publisher, data.edition_year].filter(Boolean).join(' · ') || null,
    ).catch((err) => console.error('[PriceDrop] notifyWantedListingPriceDropped failed:', err));
  }

  return { success: true };
}

export async function cancelListing(
  listingId: string
): Promise<{ success: true } | { error: string }> {
  // No Turnstile gate here: the action is already constrained to the authenticated
  // owner of the listing, blocked on reserved/sold/cancelled status, and refuses
  // auctions with bids. A bot can only cancel listings it created — and creation
  // is itself Turnstile-gated — so there's no abuse vector that adding bot
  // protection here would close.
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
 * Active wanted-listing matchers for a given BGG game, excluding the seller's
 * own wanted entries. Pure read; shared between `notifyWantedListingMatches`
 * (fires on listing-create) and `notifyWantedListingPriceDropped` (fires on
 * fixed-price drop). Each caller owns its own downstream — dedup check,
 * notify type, email template, analytics — so this helper stays just a
 * SELECT and not a generic notify dispatcher.
 *
 * The 50-row cap mirrors the original `notifyWantedListingMatches` bound.
 */
async function findActiveWantedMatchers(
  service: ReturnType<typeof createServiceClient>,
  bggGameId: number,
  sellerId: string,
) {
  const { data: matches } = await service
    .from('wanted_listings')
    .select('buyer_id, language, publisher, edition_year')
    .eq('bgg_game_id', bggGameId)
    .eq('status', 'active')
    .neq('buyer_id', sellerId)
    .limit(50);
  return matches ?? [];
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
  const matches = await findActiveWantedMatchers(service, bggGameId, sellerId);
  if (!matches.length) return;

  const conditionLabel = getConditionLabel(condition);
  const buyerIds = matches.map((m) => m.buyer_id);
  const profiles = await fetchProfiles(service, [sellerId, ...buyerIds]);
  const sellerName = profiles.get(sellerId)?.full_name ?? 'A seller';

  void notifyMany(
    matches.map((m) => ({
      userId: m.buyer_id,
      type: 'wanted.listing_matched',
      context: { gameName, listingId },
    })),
  );

  for (const match of matches) {
    const buyerProfile = profiles.get(match.buyer_id);
    if (!buyerProfile?.email) continue;
    const buyerEditionPreference = [match.language, match.publisher, match.edition_year]
      .filter(Boolean)
      .join(' · ') || null;
    void sendWantedListingMatchedToBuyer({
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

/**
 * After a fixed-price listing's price drops, ping every buyer with an active
 * wanted entry for the same BGG game — in-app + email. 14-day per-buyer
 * dedup so rapid edits don't flood the recipient.
 *
 * Auctions are excluded at the caller (current price is the high bid, not a
 * seller-set price). Fire-and-forget — never blocks the seller's edit submit.
 */
async function notifyWantedListingPriceDropped(
  bggGameId: number,
  sellerId: string,
  listingId: string,
  gameName: string,
  fromCents: number,
  toCents: number,
  condition: ListingCondition,
  listingEdition: string | null,
) {
  const service = createServiceClient();
  const percentDrop = Math.round(((fromCents - toCents) / fromCents) * 100);
  const fireAnalytics = (wantedMatchCount: number) =>
    trackServer('listing_price_dropped', sellerId, {
      listing_id: listingId,
      seller_id: sellerId,
      bgg_game_id: bggGameId,
      from_cents: fromCents,
      to_cents: toCents,
      percent_drop: percentDrop,
      wanted_match_count: wantedMatchCount,
    });

  const matches = await findActiveWantedMatchers(service, bggGameId, sellerId);
  if (!matches.length) {
    void fireAnalytics(0);
    return;
  }

  // 14-day per-(buyer, listing) dedup runs in parallel with profile fetch — both
  // only need the matcher buyerIds, neither depends on the other. The JSONB
  // `metadata->>'listingId'` filter is a sequential scan over each buyer's
  // recent notifications (memo: deferred-follow-up #11 in design doc — add a
  // top-level `listing_id` column on `notifications` if power-buyer load grows).
  const cutoffIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const buyerIds = matches.map((m) => m.buyer_id);
  const [{ data: alreadyPinged }, profiles] = await Promise.all([
    service
      .from('notifications')
      .select('user_id')
      .eq('type', 'wanted.price_dropped')
      .in('user_id', buyerIds)
      .eq('metadata->>listingId', listingId)
      .gt('created_at', cutoffIso),
    fetchProfiles(service, [sellerId, ...buyerIds]),
  ]);
  const pingedIds = new Set((alreadyPinged ?? []).map((r) => r.user_id));
  const fresh = matches.filter((m) => !pingedIds.has(m.buyer_id));

  void fireAnalytics(fresh.length);
  if (!fresh.length) return;

  const conditionLabel = getConditionLabel(condition);
  const sellerName = profiles.get(sellerId)?.full_name ?? 'A seller';

  void notifyMany(
    fresh.map((m) => ({
      userId: m.buyer_id,
      type: 'wanted.price_dropped',
      context: { gameName, listingId, fromCents, toCents },
    })),
  );

  for (const match of fresh) {
    const buyerProfile = profiles.get(match.buyer_id);
    if (!buyerProfile?.email) continue;
    const buyerEditionPreference = [match.language, match.publisher, match.edition_year]
      .filter(Boolean)
      .join(' · ') || null;
    void sendListingPriceDroppedToBuyer({
      buyerName: buyerProfile.full_name,
      buyerEmail: buyerProfile.email,
      sellerName,
      gameName,
      fromCents,
      toCents,
      condition: conditionLabel,
      listingEdition,
      buyerEditionPreference,
      listingId,
    }).catch((err) => console.error('[PriceDrop] Failed to email matched buyer:', err));
  }
}
