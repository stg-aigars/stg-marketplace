import { SELLER_TERMS_VERSION } from '@/lib/legal/constants';
import { logAuditEvent } from '@/lib/services/audit';

/**
 * Log a `seller_terms.accepted` audit event.
 *
 * `previousVersion` is `null` on first acceptance, or the prior version string
 * on re-acceptance after a `SELLER_TERMS_VERSION` bump. The key is always
 * present in metadata (never omitted) so downstream queries read cleanly as
 * `metadata->>'previous_version' IS NOT NULL` for re-accept filtering.
 *
 * Fire-and-forget — the underlying `logAuditEvent` is internally void-wrapped.
 */
export function logSellerTermsAccepted(
  actorId: string,
  previousVersion: string | null,
): void {
  void logAuditEvent({
    actorId,
    actorType: 'user',
    action: 'seller_terms.accepted',
    resourceType: 'seller_terms',
    resourceId: SELLER_TERMS_VERSION,
    metadata: { source: 'sell_gate', previous_version: previousVersion },
  });
}
