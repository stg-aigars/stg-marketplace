'use server';

import { createClient } from '@/lib/supabase/server';
import type { NotificationRow } from './types';

/**
 * Get total unread notification count for the current user.
 * Lightweight query for header badge.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  return count ?? 0;
}

/**
 * Fetch recent notifications for the current user.
 */
export async function getNotifications(
  limit = 20,
  offset = 0
): Promise<{ notifications: NotificationRow[]; total: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { notifications: [], total: 0 };

  const { data, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return {
    notifications: (data ?? []) as NotificationRow[],
    total: count ?? 0,
  };
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .is('read_at', null);
}

/**
 * Mark all unread notifications as read for the current user.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
}

/**
 * Delete a single notification. Returns success indicator so caller
 * can decide whether to remove from UI state.
 */
export async function deleteNotification(
  notificationId: string
): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id);

  return { success: !error };
}
