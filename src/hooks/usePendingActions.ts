'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { PendingActions } from '@/lib/pending-actions/types';
import { getTotalPendingCount } from '@/lib/pending-actions/types';

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

// Match the account hub page exactly — sub-pages like /account/orders should still show the banner.
// The pathname includes a locale prefix (e.g. /en/account), so we check for /account at the end.
function isAccountHubPage(pathname: string): boolean {
  return pathname === '/account' || /^\/[a-z]{2}\/account$/.test(pathname);
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

  const total = actions ? getTotalPendingCount(actions) : 0;

  // Reset dismiss when new actions appear since dismissal
  const dismissed = total > 0 && total <= dismissedAtCount;

  // Suppress on the account hub page only — it has its own server-rendered ActionStrip
  const onAccountHub = isAccountHubPage(pathname);

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
    dismissed: dismissed || onAccountHub,
    dismiss,
  };
}
