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
 * Redacts message content from other users (respects their authorship).
 */
export async function gatherUserData(userId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  const [
    { data: profile },
    { data: listings },
    { data: ordersAsBuyer },
    { data: ordersAsSeller },
    { data: conversations },
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
      .from('conversations')
      .select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('updated_at', { ascending: false }),

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

  // Fetch messages from user's conversations (messages table has no receiver_id —
  // scope through conversations which have buyer_id/seller_id)
  const conversationIds = (conversations ?? []).map((c: Record<string, unknown>) => c.id);
  let processedMessages: Record<string, unknown>[] = [];

  if (conversationIds.length > 0) {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    // Redact content of messages received from other users
    processedMessages = (messages ?? []).map((msg: Record<string, unknown>) => {
      if (msg.sender_id === userId) {
        // User's own sent messages — include full content
        return msg;
      }
      // Messages from other users — metadata only, redact content
      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        created_at: msg.created_at,
        read_at: msg.read_at,
        content: '[Message from another user]',
      };
    });
  }

  return {
    exported_at: new Date().toISOString(),
    profile: profile ?? null,
    listings: listings ?? [],
    orders_as_buyer: ordersAsBuyer ?? [],
    orders_as_seller: ordersAsSeller ?? [],
    conversations: conversations ?? [],
    messages: processedMessages,
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

  // 1. Re-check eligibility (defense in depth)
  const eligibility = await checkDeletionEligibility(userId);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: eligibility.reasons[0],
    };
  }

  // 2. Get user profile for the confirmation email
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const userName = profile?.full_name || 'there';

  // 3. Send confirmation email BEFORE auth deletion (while we still can)
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

  // 4. Anonymize profile
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

  // 5. Deactivate any remaining listings
  await supabase
    .from('listings')
    .update({ status: 'sold' })
    .eq('seller_id', userId)
    .in('status', ['draft', 'inactive']);

  // 6. Delete user favorites
  await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId);

  // 7. Delete storage photos for user's listings
  try {
    const { data: files } = await supabase.storage
      .from('listing-photos')
      .list(userId);

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${userId}/${f.name}`);
      await supabase.storage
        .from('listing-photos')
        .remove(filePaths);
    }
  } catch (err) {
    console.error('[Account] Failed to delete storage photos:', err);
    // Continue — photo cleanup failure should not block deletion
  }

  // 8. Delete Supabase auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    console.error('[Account] Failed to delete auth user:', authError);
    return { success: false, error: 'Failed to delete account. Please try again.' };
  }

  return { success: true };
}
