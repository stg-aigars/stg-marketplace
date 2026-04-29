'use client';

import { useEffect, useRef } from 'react';
import { trackClient } from '@/lib/analytics';

export function SellerProfileAnalytics(props: {
  sellerId: string;
  listingCount: number;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackClient('seller_profile_viewed', {
      seller_id: props.sellerId,
      listing_count: props.listingCount,
    });
  }, [props.sellerId, props.listingCount]);

  return null;
}
