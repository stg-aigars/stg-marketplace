'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { orderMessageLimiter } from '@/lib/rate-limit';
import { notify } from '@/lib/notifications';
import { logAuditEvent } from '@/lib/services/audit';
import { fetchProfileNames } from '@/lib/supabase/profiles';
import { MAX_ORDER_MESSAGE_LENGTH, type OrderMessage } from './types';

/**
 * Post a private message on an order (buyer or seller only).
 */
export async function postOrderMessage(
  orderId: string,
  content: string
): Promise<{ success: true } | { error: string }> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_ORDER_MESSAGE_LENGTH) {
    return { error: `Message must be between 1 and ${MAX_ORDER_MESSAGE_LENGTH} characters` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const limitResult = orderMessageLimiter.check(user.id);
  if (!limitResult.success) return { error: 'Too many messages. Please wait a moment.' };

  // Fetch order + sender name in parallel — RLS ensures only participants can read
  const [{ data: order }, { data: senderProfile }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, buyer_id, seller_id, order_number')
      .eq('id', orderId)
      .single<{ id: string; buyer_id: string; seller_id: string; order_number: string }>(),
    supabase
      .from('public_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single<{ full_name: string | null }>(),
  ]);

  if (!order) return { error: 'Order not found' };

  const authorRole = user.id === order.buyer_id ? 'buyer' : 'seller';

  const { error: insertError } = await supabase
    .from('order_messages')
    .insert({
      order_id: orderId,
      user_id: user.id,
      author_role: authorRole,
      content: trimmed,
    });

  if (insertError) {
    console.error('[OrderMessages] Insert failed:', insertError.message);
    return { error: 'Failed to send message. Please try again.' };
  }

  // Fire-and-forget: notify the other party
  const recipientId = authorRole === 'buyer' ? order.seller_id : order.buyer_id;
  void notify(recipientId, 'order.message_received', {
    senderName: senderProfile?.full_name ?? 'Someone',
    orderNumber: order.order_number,
    orderId: order.id,
  }).catch((err) => console.error('[OrderMessages] Notification dispatch failed:', err));

  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

/**
 * Get all messages for an order, oldest first.
 * RLS restricts to order participants + staff.
 */
export async function getOrderMessages(orderId: string): Promise<OrderMessage[]> {
  const supabase = await createClient();

  const { data: messages } = await supabase
    .from('order_messages')
    .select('id, order_id, user_id, author_role, content, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (!messages || messages.length === 0) return [];

  const userIds = [...new Set(messages.map((m) => m.user_id).filter(Boolean))] as string[];
  const profileMap = await fetchProfileNames(supabase, userIds);

  return messages.map((m) => ({
    id: m.id,
    order_id: m.order_id,
    user_id: m.user_id,
    author_role: m.author_role as 'buyer' | 'seller',
    content: m.content,
    created_at: m.created_at,
    author_name: m.user_id ? (profileMap.get(m.user_id) ?? null) : null,
  }));
}

/**
 * Soft-delete a message (staff only). Uses service role client.
 */
export async function deleteOrderMessage(
  messageId: string,
  orderId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_staff')
    .eq('id', user.id)
    .single<{ is_staff: boolean }>();

  if (!profile?.is_staff) return { error: 'Not authorized' };

  const serviceClient = createServiceClient();
  const { error: updateError } = await serviceClient
    .from('order_messages')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', messageId)
    .is('deleted_at', null);

  if (updateError) {
    console.error('[OrderMessages] Delete failed:', updateError.message);
    return { error: 'Failed to delete message' };
  }

  void logAuditEvent({
    actorId: user.id,
    actorType: 'user',
    action: 'order_message.deleted',
    resourceType: 'order_message',
    resourceId: messageId,
  });

  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}
