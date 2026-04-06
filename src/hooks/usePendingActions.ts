'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { PendingActions } from '@/lib/services/pending-actions';

const STORAGE_KEY = 'stg-pending-actions-dismissed';

function getStoredDismissCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return typeof parsed.dismissedAtCount === 'number' ? parsed.dismissedAtCount : 0;
  } catch {
    return 0;
  }
}

function getTotalCount(actions: PendingActions): number {
  return (
    actions.sellerOrdersPending +
    actions.sellerOrdersToShip +
    actions.sellerDisputes +
    actions.sellerOffersPending +
    actions.buyerDisputes +
    actions.buyerDeliveryConfirm +
    actions.buyerWantedOffers
  );
}

export function usePendingActions() {
  const [actions, setActions] = useState<PendingActions | null>(null);
  const [dismissedAtCount, setDismissedAtCount] = useState(getStoredDismissCount);
  const { user } = useAuth();
  const pathname = usePathname();

  const fetchActions = useCallback(async () => {
    if (!user) {
      setActions(null);
      return;
    }
    try {
      const res = await fetch('/api/pending-actions');
      if (res.ok) {
        const data = await res.json();
        setActions(data);
      }
    } catch {
      // Silent failure — non-blocking UI enhancement
    }
  }, [user]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions, pathname]);

  const total = actions ? getTotalCount(actions) : 0;

  // Reset dismiss when new actions appear since dismissal
  const dismissed = total > 0 && total <= dismissedAtCount;

  // Suppress on /account pages — account page has its own server-rendered ActionStrip
  // TODO: i18n — when locale prefix changes, update this check
  const onAccountPage = pathname.includes('/account');

  const dismiss = useCallback(() => {
    setDismissedAtCount(total);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAtCount: total }));
    } catch {
      // sessionStorage may be unavailable
    }
  }, [total]);

  return {
    actions,
    total,
    dismissed: dismissed || onAccountPage,
    dismiss,
  };
}
