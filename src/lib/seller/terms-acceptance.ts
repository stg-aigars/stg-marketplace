import { SELLER_TERMS_VERSION } from '@/lib/legal/constants';
import type { UserProfile } from '@/lib/auth/types';

/**
 * Pure gate check: does this user need to (re-)accept the Seller Agreement?
 *
 * True when the user has never accepted (seller_terms_accepted_at is null) or
 * accepted a stale version. Used by the /sell page gate and also mirrored in
 * createListing's action-level guard so a tampered or bypassed client still
 * fails closed.
 *
 * Lives in its own file (not in ./actions.ts) because actions.ts is a
 * 'use server' module — its exports must be async server actions, which this
 * pure boolean helper is not.
 */
export function needsSellerTermsAcceptance(profile: UserProfile | null): boolean {
  if (!profile) return true;
  if (!profile.seller_terms_accepted_at) return true;
  if (profile.seller_terms_version !== SELLER_TERMS_VERSION) return true;
  return false;
}
