/**
 * Audit logging for financial operations and security-relevant events.
 * Fire-and-forget pattern — never blocks the main operation.
 */

import { createServiceClient } from '@/lib/supabase';

/**
 * Retention class drives the cleanup-audit-log cron's filter.
 *
 * - 'operational' — 30-day retention. Use for ephemeral events (shipping
 *   operational events, moderation steps with a regulatory companion, order
 *   lifecycle status changes that mirror orders.status).
 * - 'regulatory' — 10-year retention. Use for any event that may be relevant
 *   to a regulator inquiry, OSS prior-period adjustment, accountant retention,
 *   DSA Art. 16/17 defensibility, financial ledger, contract resolution, or
 *   trader-status (Kamenova C-105/17) defense.
 *
 * Canonical register: CLAUDE.md "Audit Events". New event types must be
 * registered there with their retention class before/with the emission site.
 */
export type RetentionClass = 'operational' | 'regulatory';

interface AuditEvent {
  actorId?: string;
  // Operator-precedence trap: '||' binds tighter than '?:'. To derive actorType from a
  // possibly-empty value, write '(authedUserId || email) ? "user" : "system"' — without
  // the parens, the ternary always returns "user" and the "system" branch is unreachable.
  actorType: 'user' | 'system' | 'cron';
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  retentionClass: RetentionClass;
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
        retention_class: event.retentionClass,
      });

    if (error) {
      console.error('[Audit] Failed to log event:', error.message, event.action);
    }
  } catch (err) {
    console.error('[Audit] Unexpected error:', err);
  }
}
