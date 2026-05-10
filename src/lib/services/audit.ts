/**
 * Audit logging for financial operations and security-relevant events.
 * Fire-and-forget pattern — never blocks the main operation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
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
 *
 * Accepts an optional service-role `supabase` client as the first argument.
 * Callers that already hold a service-role client (most do) should pass it —
 * the audit-write path then shares env state and connection-pool ordering
 * with the surrounding data write, closing the structural seam that surfaced
 * during PR #3's Phase 0 backfill (audit insert silently dropped 23 events
 * while the data insert succeeded). Calling with the options object alone
 * falls through to a service-role client created at audit-time — back-compat
 * for SSR-only flows that have no service-role client locally scoped.
 */
export function logAuditEvent(supabase: SupabaseClient, event: AuditEvent): Promise<void>;
export function logAuditEvent(event: AuditEvent): Promise<void>;
export async function logAuditEvent(
  clientOrEvent: SupabaseClient | AuditEvent,
  maybeEvent?: AuditEvent
): Promise<void> {
  const supabase: SupabaseClient = maybeEvent
    ? (clientOrEvent as SupabaseClient)
    : createServiceClient();
  const event: AuditEvent = (maybeEvent ?? clientOrEvent) as AuditEvent;

  try {
    const { error } = await supabase
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
