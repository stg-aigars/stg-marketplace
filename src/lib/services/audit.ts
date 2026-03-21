/**
 * Audit logging for financial operations and security-relevant events.
 * Fire-and-forget pattern — never blocks the main operation.
 */

import { createServiceClient } from '@/lib/supabase';

interface AuditEvent {
  actorId?: string;
  actorType: 'user' | 'system' | 'cron';
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to the database.
 * Designed to be called with `void logAuditEvent(...)` — fire and forget.
 * Failures are logged to console but never thrown.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from('audit_log')
      .insert({
        actor_id: event.actorId ?? null,
        actor_type: event.actorType,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId ?? null,
        metadata: event.metadata ?? {},
      });

    if (error) {
      console.error('[Audit] Failed to log event:', error.message, event.action);
    }
  } catch (err) {
    console.error('[Audit] Unexpected error:', err);
  }
}
