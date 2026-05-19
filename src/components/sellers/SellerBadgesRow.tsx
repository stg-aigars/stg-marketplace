'use client';

import { useState } from 'react';
import { TrustBadge } from '@/components/sellers/TrustBadge';
import { EarlyMemberBadge } from '@/components/sellers/EarlyMemberBadge';
import {
  calculateTrustTier,
  isEarlyMember,
  TRUST_TIER_CONFIG,
  type TrustTier,
} from '@/lib/services/sellers-badges';

/**
 * Trust + early-member badge row with inline-disclosure explainers.
 *
 * Rating (👍 N% positive) lives outside this component so it can sit with
 * sales/listings counts in the stats line — the badges row stays free of
 * quantitative chatter and the rating reinforces the sales count instead.
 */
interface SellerBadgesRowProps {
  positivePct: number;
  ratingCount: number;
  completedSales: number;
  sellerCreatedAt: string | null | undefined;
}

// One-sentence "what does this mean" line per visible trust tier. Phrased as a
// property of the seller ("Sellers with…") rather than a gamified "Awarded for…"
// to keep the brand voice neutral and factual.
const TRUST_EXPLAINERS: Record<Exclude<TrustTier, 'new'>, string> = {
  bronze: 'Sellers with at least one completed sale and a buyer rating.',
  gold: 'Sellers with 5 or more completed sales and 80%+ positive ratings.',
  trusted: 'Sellers with 20 or more completed sales and 90%+ positive ratings.',
};

const EARLY_MEMBER_EXPLAINER =
  'Joined Second Turn Games before 1 September 2026. Early members keep this badge permanently.';

type OpenExplainer = 'trust' | 'early' | null;

function SellerBadgesRow({
  positivePct,
  ratingCount,
  completedSales,
  sellerCreatedAt,
}: SellerBadgesRowProps) {
  const [open, setOpen] = useState<OpenExplainer>(null);

  const tier = calculateTrustTier(completedSales, positivePct, ratingCount);
  const trustVisible = TRUST_TIER_CONFIG[tier].show;
  const earlyVisible = isEarlyMember(sellerCreatedAt);

  // Avoid leaving an empty row with mt-3 spacing when the seller has neither badge.
  if (!trustVisible && !earlyVisible) return null;

  function toggle(which: NonNullable<OpenExplainer>) {
    setOpen((prev) => (prev === which ? null : which));
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {trustVisible && (
          <button
            type="button"
            onClick={() => toggle('trust')}
            aria-expanded={open === 'trust'}
            aria-controls="seller-badge-explainer"
            className="cursor-help rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-brand focus-visible:ring-offset-2"
          >
            <TrustBadge tier={tier} />
          </button>
        )}

        {earlyVisible && (
          <button
            type="button"
            onClick={() => toggle('early')}
            aria-expanded={open === 'early'}
            aria-controls="seller-badge-explainer"
            className="cursor-help rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-brand focus-visible:ring-offset-2"
          >
            <EarlyMemberBadge />
          </button>
        )}
      </div>

      {open !== null && (
        <p
          id="seller-badge-explainer"
          className="mt-2 px-3 py-2 rounded-md bg-semantic-bg-secondary text-sm text-semantic-text-secondary"
        >
          {open === 'trust' && tier !== 'new' && (
            <>
              <span className="font-medium text-semantic-text-heading">{TRUST_TIER_CONFIG[tier].label}</span>
              {' — '}
              {TRUST_EXPLAINERS[tier]}
            </>
          )}
          {open === 'early' && (
            <>
              <span className="font-medium text-semantic-text-heading">Early member</span>
              {' — '}
              {EARLY_MEMBER_EXPLAINER}
            </>
          )}
        </p>
      )}
    </>
  );
}

export { SellerBadgesRow };
