/**
 * Notification creation utility.
 * Fire-and-forget pattern — never blocks the main operation.
 * Same pattern as logAuditEvent.
 */

import { createServiceClient } from '@/lib/supabase';
import { NOTIFICATION_TEMPLATES } from './templates';
import type { NotificationType, NotificationContext } from './types';

/**
 * Create a single in-app notification.
 * Designed to be called with `void notify(...)` — fire and forget.
 * Failures are logged to console but never thrown.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  context: NotificationContext = {}
): Promise<void> {
  try {
    const template = NOTIFICATION_TEMPLATES[type];
    const serviceClient = createServiceClient();

    const { error } = await serviceClient.from('notifications').insert({
      user_id: userId,
      type,
      title: template.title(context),
      body: template.body(context),
      link: template.link(context),
      metadata: context,
    });
    if (error) {
      console.error(`[Notifications] Failed to create ${type} for ${userId}:`, error.message);
    }
  } catch (err) {
    console.error(`[Notifications] Failed to create ${type} for ${userId}:`, err);
  }
}

/**
 * Create multiple notifications in a single batch insert.
 * Used for events that notify multiple users (e.g., dispute resolved → buyer + seller).
 */
export async function notifyMany(
  notifications: { userId: string; type: NotificationType; context?: NotificationContext }[]
): Promise<void> {
  if (notifications.length === 0) return;

  try {
    const serviceClient = createServiceClient();
    const rows = notifications.map(({ userId, type, context = {} }) => {
      const template = NOTIFICATION_TEMPLATES[type];
      return {
        user_id: userId,
        type,
        title: template.title(context),
        body: template.body(context),
        link: template.link(context),
        metadata: context,
      };
    });

    const { error } = await serviceClient.from('notifications').insert(rows);
    if (error) {
      console.error(`[Notifications] Failed batch insert (${notifications.length} items):`, error.message);
    }
  } catch (err) {
    console.error(`[Notifications] Failed batch insert (${notifications.length} items):`, err);
  }
}
