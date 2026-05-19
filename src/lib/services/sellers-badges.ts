/**
 * Pure helpers for seller-badge logic (trust tier + early-member). No DB access
 * and no server-only imports — safe to import from client components.
 *
 * The sibling module `sellers.ts` keeps the DB-access functions
 * (`getSellerCompletedSales`, `getActiveListingCount`, etc.) and pulls in
 * `@/lib/supabase/server`, which would poison any client bundle that imported
 * it transitively. Anything pure that the client side needs lives here.
 */

export type TrustTier = 'new' | 'bronze' | 'gold' | 'trusted';

export function calculateTrustTier(
  completedSales: number,
  positivePct: number,
  ratingCount: number,
): TrustTier {
  if (completedSales >= 20 && positivePct >= 90) return 'trusted';
  if (completedSales >= 5 && positivePct >= 80) return 'gold';
  if (completedSales >= 1 && ratingCount >= 1) return 'bronze';
  return 'new';
}

export const TRUST_TIER_CONFIG: Record<TrustTier, { label: string; show: boolean }> = {
  new: { label: 'New seller', show: false },
  bronze: { label: 'Bronze seller', show: true },
  gold: { label: 'Gold seller', show: true },
  trusted: { label: 'Trusted seller', show: true },
};

/**
 * Sellers whose accounts were created before this cutoff get a permanent
 * "Early member" badge. Anchored to soft-launch + ~3.5 months so the badge
 * stays meaningful (scarce after 31 Aug 2026 inclusive) while giving genuine
 * day-zero adopters real social capital.
 */
export const EARLY_MEMBER_CUTOFF = '2026-09-01T00:00:00Z';

export function isEarlyMember(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  return new Date(createdAt) < new Date(EARLY_MEMBER_CUTOFF);
}
