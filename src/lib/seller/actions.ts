'use server';

import { createClient } from '@/lib/supabase/server';
import { SELLER_TERMS_VERSION } from '@/lib/legal/constants';
import { logAuditEvent } from '@/lib/services/audit';

/**
 * Record a `seller_terms.accepted` audit event. Internal helper called from
 * `acceptSellerTerms` below. Not exported — a 'use server' file exports only
 * server actions, and this is a plain sync helper (follows the
 * `logTermsAccepted` pattern in `src/lib/auth/actions.ts`).
 *
 * `previousVersion` is `null` on first acceptance or the prior version string
 * on re-acceptance. Always-present-key convention: the `previous_version` key
 * is always set in metadata, never omitted, so downstream filters read as
 * `metadata->>'previous_version' IS NOT NULL` for re-accept queries.
 */
function logSellerTermsAccepted(actorId: string, previousVersion: string | null): void {
  void logAuditEvent({
    actorId,
    actorType: 'user',
    action: 'seller_terms.accepted',
    resourceType: 'seller_terms',
    resourceId: SELLER_TERMS_VERSION,
    metadata: { source: 'sell_gate', previous_version: previousVersion },
    retentionClass: 'regulatory',
  });
}

/**
 * Stamp the user's Seller Agreement acceptance and write the audit event.
 *
 * Called from `SellerTermsAcceptanceGate` when the user clicks "Accept and
 * continue" on /sell. Idempotent: if the user re-triggers acceptance against
 * an unchanged `SELLER_TERMS_VERSION`, this is a no-op (no double-write, no
 * duplicate audit row). Re-acceptance after a version bump writes both the
 * new user_profiles stamp and an audit row with `previous_version` pointing
 * at the prior version.
 */
export async function acceptSellerTerms(): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Read the current version first so the audit event can describe first-vs-reaccept.
  const { data: current, error: readError } = await supabase
    .from('user_profiles')
    .select('seller_terms_version')
    .eq('id', user.id)
    .single();

  if (readError) {
    console.error('[acceptSellerTerms] read failed:', readError);
    return { error: 'Could not load your profile. Please try again in a moment.' };
  }

  const previousVersion = current?.seller_terms_version ?? null;

  // Idempotent: already on the current version — no-op, no second audit write.
  if (previousVersion === SELLER_TERMS_VERSION) {
    return { success: true };
  }

  const { error: writeError } = await supabase
    .from('user_profiles')
    .update({
      seller_terms_accepted_at: new Date().toISOString(),
      seller_terms_version: SELLER_TERMS_VERSION,
    })
    .eq('id', user.id);

  if (writeError) {
    console.error('[acceptSellerTerms] write failed:', writeError);
    return { error: 'Could not save your acceptance. Please try again.' };
  }

  logSellerTermsAccepted(user.id, previousVersion);
  return { success: true };
}
