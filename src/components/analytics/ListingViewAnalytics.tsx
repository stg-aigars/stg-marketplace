'use client';

import { useEffect, useRef } from 'react';
import { trackClient } from '@/lib/analytics';
import type { ListingCondition } from '@/lib/listings/types';

// The ref-based guard protects against re-renders within the same mount.
// Navigating listing A -> B -> A deliberately fires A's event twice — each
// mount is a distinct view for funnel purposes. Do not "fix" this with a
// listing-id cache in sessionStorage; two visits are two views.
export function ListingViewAnalytics(props: {
  listingId: string;
  bggGameId: number;
  priceCents: number;
  condition: ListingCondition;
  listingType: 'fixed_price' | 'auction';
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackClient('listing_viewed', {
      listing_id: props.listingId,
      bgg_game_id: props.bggGameId,
      price_cents: props.priceCents,
      condition: props.condition,
      listing_type: props.listingType,
    });
  }, [props.listingId, props.bggGameId, props.priceCents, props.condition, props.listingType]);

  return null;
}
