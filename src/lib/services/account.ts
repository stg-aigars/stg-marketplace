/**
 * Account service
 * Handles account deletion eligibility, GDPR data export, and account deletion.
 * All operations use service client to bypass RLS.
 */

import React from 'react';
import { createServiceClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email/service';
import { AccountDeleted } from '@/lib/email/templates/account-deleted';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeletionEligibility {
  eligible: boolean;
  reasons: string[];
}

interface DeleteAccountResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Deletion eligibility
// ---------------------------------------------------------------------------

/**
 * Check whether a user can delete their account.
 * Blocks deletion if user has active listings, in-progress orders,
 * wallet balance, or pending withdrawals.
 */
export async function checkDeletionEligibility(userId: string): Promise<DeletionEligibility> {
  const supabase = createServiceClient();
  const reasons: string[] = [];

  const [
    { count: activeListings },
    { count: buyerOrders },
    { count: sellerOrders },
    { data: wallet },
    { count: pendingWithdrawals },
  ] = await Promise.all([
    // Active or reserved listings
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .in('status', ['active', 'reserved']),

    // In-progress orders as buyer
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', userId)
      .in('status', ['pending_seller', 'accepted', 'shipped', 'delivered', 'disputed']),

    // In-progress orders as seller
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .in('status', ['pending_seller', 'accepted', 'shipped', 'delivered', 'disputed']),

    // Wallet balance
    supabase
      .from('wallets')
      .select('balance_cents')
      .eq('user_id', userId)
      .maybeSingle(),

    // Pending or approved withdrawals
    supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'approved']),
  ]);

  if (activeListings && activeListings > 0) {
    reasons.push('You have active listings. Please deactivate or sell them first.');
  }

  if ((buyerOrders && buyerOrders > 0) || (sellerOrders && sellerOrders > 0)) {
    reasons.push('You have in-progress orders. Please wait for them to complete.');
  }

  if (wallet?.balance_cents && wallet.balance_cents > 0) {
    reasons.push('You have funds in your wallet. Please withdraw your balance first.');
  }

  if (pendingWithdrawals && pendingWithdrawals > 0) {
    reasons.push('You have pending withdrawals. Please wait for them to process.');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// GDPR data export
// ---------------------------------------------------------------------------

/**
 * Gather all user data for GDPR data export.
 * Uses service client to bypass RLS and access all user-related data.
 */
export async function gatherUserData(userId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  const [
    { data: profile },
    { data: listings },
    { data: ordersAsBuyer },
    { data: ordersAsSeller },
    { data: comments },
    { data: orderMessages },
    { data: wallet },
    { data: walletTransactions },
    { data: withdrawalRequests },
    { data: favorites },
    { data: reviewsGiven },
    { data: reviewsReceived },
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single(),

    supabase
      .from('listings')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('orders')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('listing_comments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('order_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', userId),

    supabase
      .from('reviews')
      .select('*')
      .eq('reviewer_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('reviews')
      .select('*')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false }),

  ]);

  return {
    exported_at: new Date().toISOString(),
    profile: profile ?? null,
    listings: listings ?? [],
    orders_as_buyer: ordersAsBuyer ?? [],
    orders_as_seller: ordersAsSeller ?? [],
    comments: comments ?? [],
    order_messages: orderMessages ?? [],
    wallet: wallet ?? null,
    wallet_transactions: walletTransactions ?? [],
    withdrawal_requests: withdrawalRequests ?? [],
    favorites: favorites ?? [],
    reviews_given: reviewsGiven ?? [],
    reviews_received: reviewsReceived ?? [],
  };
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/**
 * Delete a user account. Re-checks eligibility (defense in depth),
 * sends confirmation email, anonymizes profile, cleans up data,
 * and deletes the Supabase auth user.
 *
 * Orders, listings (sold/cancelled), reviews, and wallet transactions
 * are retained for 7-year tax compliance.
 */
export async function deleteUserAccount(
  userId: string,
  userEmail: string
): Promise<DeleteAccountResult> {
  const supabase = createServiceClient();

  // Defense in depth — re-check in case state changed between route guard and here
  const eligibility = await checkDeletionEligibility(userId);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: eligibility.reasons[0],
    };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const userName = profile?.full_name || 'there';

  // Send confirmation email BEFORE auth deletion (while we still have the email address)
  try {
    await sendEmail({
      to: userEmail,
      subject: 'Your Second Turn Games account has been deleted',
      react: React.createElement(AccountDeleted, { userName }),
    });
  } catch (err) {
    console.error('[Account] Failed to send deletion confirmation email:', err);
    // Continue with deletion — email failure should not block account deletion
  }

  // Anonymize user content BEFORE profile deletion — user_id FK is ON DELETE SET NULL,
  // so after profile is gone we can no longer match rows by user_id
  await Promise.all([
    supabase
      .from('listing_comments')
      .update({ content: '[deleted]' })
      .eq('user_id', userId),
    supabase
      .from('order_messages')
      .update({ content: '[deleted]' })
      .eq('user_id', userId),
  ]);

  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      full_name: 'Deleted User',
      email: null,
      phone: null,
    })
    .eq('id', userId);

  if (profileError) {
    console.error('[Account] Failed to anonymize profile:', profileError);
    return { success: false, error: 'Failed to anonymize profile. Please try again.' };
  }

  // 5-7: Cleanup steps are independent — run in parallel
  await Promise.all([
    // Cancel any remaining active/reserved listings (defense-in-depth; eligibility check should block these)
    supabase
      .from('listings')
      .update({ status: 'cancelled' })
      .eq('seller_id', userId)
      .in('status', ['active', 'reserved']),

    // Delete user favorites
    supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', userId),

    // Delete storage photos
    (async () => {
      try {
        const { data: files } = await supabase.storage
          .from('listing-photos')
          .list(userId);

        if (files && files.length > 0) {
          const filePaths = files.map((f) => `${userId}/${f.name}`);
          await supabase.storage.from('listing-photos').remove(filePaths);
        }
      } catch (err) {
        console.error('[Account] Failed to delete storage photos:', err);
        // Continue — photo cleanup failure should not block deletion
      }
    })(),
  ]);

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    console.error('[Account] Failed to delete auth user:', authError);
    return { success: false, error: 'Failed to delete account. Please try again.' };
  }

  return { success: true };
}
