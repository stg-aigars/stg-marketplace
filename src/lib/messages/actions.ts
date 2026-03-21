'use server';

import { createClient } from '@/lib/supabase/server';
import { MAX_MESSAGE_LENGTH, type Conversation, type Message } from './types';
import { sendNewMessageNotification } from '@/lib/email';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';

/**
 * Start a new conversation about a listing, or get the existing one.
 * Only buyers can start conversations (RLS enforces this).
 */
export async function startConversation(
  listingId: string,
  initialMessage: string,
  turnstileToken?: string
): Promise<{ conversationId: string } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const content = initialMessage.trim();
  if (!content || content.length > MAX_MESSAGE_LENGTH) {
    return { error: 'Message must be between 1 and 2000 characters' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  // Get listing to find the seller
  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, game_name, games(thumbnail)')
    .eq('id', listingId)
    .single<{ id: string; seller_id: string; game_name: string; games: { thumbnail: string | null } | null }>();

  if (!listing) return { error: 'Listing not found' };
  if (listing.seller_id === user.id) return { error: 'Cannot message yourself' };

  // Check for existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .maybeSingle();

  let conversationId: string;

  if (existing) {
    conversationId = existing.id;
  } else {
    // Create new conversation
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listing.seller_id,
      })
      .select('id')
      .single();

    if (convError || !conv) {
      return { error: 'Failed to create conversation' };
    }
    conversationId = conv.id;
  }

  // Send the initial message
  const { error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });

  if (msgError) {
    return { error: 'Failed to send message' };
  }

  // Send email notification (non-blocking)
  void notifyRecipient(conversationId, user.id, listing.seller_id, content, listing.game_name);

  return { conversationId };
}

/**
 * Send a message in an existing conversation.
 */
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<{ messageId: string } | { error: string }> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
    return { error: 'Message must be between 1 and 2000 characters' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  // Verify user is a participant (RLS also enforces this)
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, buyer_id, seller_id, listings(game_name)')
    .eq('id', conversationId)
    .single<{ id: string; buyer_id: string; seller_id: string; listings: { game_name: string } | null }>();

  if (!conv) return { error: 'Conversation not found' };

  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: trimmed,
    })
    .select('id')
    .single();

  if (msgError || !msg) {
    return { error: 'Failed to send message' };
  }

  // Send email notification to the other participant (non-blocking)
  const recipientId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
  void notifyRecipient(
    conversationId,
    user.id,
    recipientId,
    trimmed,
    conv.listings?.game_name ?? 'a listing'
  );

  return { messageId: msg.id };
}

/**
 * Mark all unread messages in a conversation as read (where sender != current user).
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
}

/**
 * Get all conversations for the current user with last message preview.
 * Uses 3 batched parallel queries instead of N+1 per conversation.
 */
export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // 1. Get conversations with listing info
  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id, listing_id, buyer_id, seller_id, last_message_at, created_at,
      listings(game_name, status, games(thumbnail), price_cents)
    `)
    .order('last_message_at', { ascending: false });

  if (!conversations || conversations.length === 0) return [];

  // Collect IDs for batch queries
  const conversationIds = conversations.map((c) => c.id);
  const otherUserIds = Array.from(
    new Set(conversations.map((c) => (c.buyer_id === user.id ? c.seller_id : c.buyer_id)))
  );

  // 2. Batch-fetch profiles, last messages, and unread counts in parallel
  const [profilesResult, lastMessagesResult, unreadResult] = await Promise.all([
    // Batch user profiles
    supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', otherUserIds)
      .then((r) => r.data ?? []),

    // Last message per conversation: use last_message_at from the trigger
    // to fetch the exact message without pulling the full history
    supabase
      .from('messages')
      .select('conversation_id, content')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .then((r) => r.data ?? []),

    // Unread counts: all unread messages not from the current user
    supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', user.id)
      .is('read_at', null)
      .then((r) => r.data ?? []),
  ]);

  // Build lookup maps
  const profileMap = new Map(profilesResult.map((p) => [p.id, p.full_name ?? 'Unknown']));

  // Last message per conversation (first occurrence in desc-ordered results)
  const lastMessageMap = new Map<string, string>();
  for (const msg of lastMessagesResult) {
    if (!lastMessageMap.has(msg.conversation_id)) {
      lastMessageMap.set(msg.conversation_id, msg.content);
    }
  }

  // Unread count per conversation
  const unreadMap = new Map<string, number>();
  for (const msg of unreadResult) {
    unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) ?? 0) + 1);
  }

  // 3. Assemble results
  return conversations.map((conv) => {
    const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listing = (conv.listings as any) as {
      game_name: string; status: string;
      games: { thumbnail: string | null } | null;
      price_cents: number;
    } | null;

    return {
      id: conv.id,
      listing_id: conv.listing_id,
      buyer_id: conv.buyer_id,
      seller_id: conv.seller_id,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
      listing_title: listing?.game_name,
      listing_thumbnail: listing?.games?.thumbnail,
      listing_price_cents: listing?.price_cents,
      listing_status: listing?.status,
      other_user_name: profileMap.get(otherUserId) ?? 'Unknown',
      last_message_content: lastMessageMap.get(conv.id),
      unread_count: unreadMap.get(conv.id) ?? 0,
    };
  });
}

/**
 * Get messages for a conversation, optionally only after a timestamp (for polling).
 */
export async function getMessages(
  conversationId: string,
  afterTimestamp?: string
): Promise<Message[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, read_at, created_at, user_profiles(full_name)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (afterTimestamp) {
    query = query.gt('created_at', afterTimestamp);
  }

  const { data } = await query;

  return (data ?? []).map((msg) => ({
    id: msg.id,
    conversation_id: msg.conversation_id,
    sender_id: msg.sender_id,
    content: msg.content,
    read_at: msg.read_at,
    created_at: msg.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sender_name: ((msg.user_profiles as any) as { full_name: string | null } | null)?.full_name ?? 'Unknown',
  }));
}

/**
 * Get a single conversation with listing details.
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: conv } = await supabase
    .from('conversations')
    .select(`
      id, listing_id, buyer_id, seller_id, last_message_at, created_at,
      listings(game_name, status, price_cents, games(thumbnail))
    `)
    .eq('id', conversationId)
    .single();

  if (!conv) return null;

  const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = (conv.listings as any) as { game_name: string; status: string; price_cents: number; games: { thumbnail: string | null } | null } | null;

  const { data: otherProfile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', otherUserId)
    .single();

  return {
    id: conv.id,
    listing_id: conv.listing_id,
    buyer_id: conv.buyer_id,
    seller_id: conv.seller_id,
    last_message_at: conv.last_message_at,
    created_at: conv.created_at,
    listing_title: listing?.game_name,
    listing_thumbnail: listing?.games?.thumbnail,
    listing_price_cents: listing?.price_cents,
    listing_status: listing?.status,
    other_user_name: otherProfile?.full_name ?? 'Unknown',
  };
}

/**
 * Find an existing conversation for a listing + current user.
 */
export async function findConversation(listingId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .maybeSingle();

  return data?.id ?? null;
}

// --- Internal helpers ---

/**
 * Send email notification to the recipient of a message.
 * Throttle: skip if they already have unread messages in this conversation.
 */
async function notifyRecipient(
  conversationId: string,
  senderId: string,
  recipientId: string,
  messageContent: string,
  gameTitle: string
): Promise<void> {
  try {
    const supabase = await createClient();

    // Check if recipient already has unread messages in this conversation
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', recipientId)
      .is('read_at', null);

    // If more than 1 unread (the one we just sent), skip notification
    if (count && count > 1) return;

    // Get recipient email
    const { data: recipient } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', recipientId)
      .single();

    if (!recipient?.email) return;

    // Get sender name
    const { data: sender } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', senderId)
      .single();

    await sendNewMessageNotification({
      to: recipient.email,
      recipientName: recipient.full_name ?? 'there',
      senderName: sender?.full_name ?? 'Someone',
      gameTitle,
      messagePreview: messageContent.slice(0, 200),
      conversationId,
    });
  } catch (err) {
    console.error('[Messages] Failed to send notification:', err);
  }
}
