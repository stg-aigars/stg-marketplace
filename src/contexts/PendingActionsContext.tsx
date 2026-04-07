'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { PendingActions } from '@/lib/pending-actions/types';
import { getTotalPendingCount } from '@/lib/pending-actions/types';
import { stripLocalePrefix } from '@/lib/locale-utils';

const STORAGE_KEY = 'stg-pending-actions-dismissed';
const MIN_FETCH_INTERVAL_MS = 60_000;

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

interface PendingActionsContextValue {
  actions: PendingActions | null;
  total: number;
  dismissed: boolean;
  dismiss: () => void;
  isSeller: boolean;
}

const PendingActionsContext = createContext<PendingActionsContextValue>({
  actions: null,
  total: 0,
  dismissed: false,
  dismiss: () => {},
  isSeller: false,
});

export function PendingActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PendingActions | null>(null);
  const [dismissedAtCount, setDismissedAtCount] = useState(getStoredDismissCount);
  const lastFetchedAt = useRef(0);
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      setActions(null);
      return;
    }

    // Throttle: skip if fetched recently (unless navigating within account pages)
    const now = Date.now();
    const isAccountArea = stripLocalePrefix(pathname).startsWith('/account');
    if (now - lastFetchedAt.current < MIN_FETCH_INTERVAL_MS && !isAccountArea) {
      return;
    }

    const controller = new AbortController();
    fetch('/api/pending-actions', { signal: controller.signal })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data) {
          setActions(data);
          lastFetchedAt.current = Date.now();
        }
      })
      .catch(() => {
        // Silent failure — non-blocking UI enhancement (includes AbortError)
      });

    return () => controller.abort();
  }, [user, pathname]);

  const total = actions ? getTotalPendingCount(actions) : 0;
  const dismissed = total > 0 && total <= dismissedAtCount;
  const onAccountHub = stripLocalePrefix(pathname) === '/account';

  const dismiss = useCallback(() => {
    setDismissedAtCount(total);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAtCount: total }));
    } catch {
      // sessionStorage may be unavailable
    }
  }, [total]);

  const value: PendingActionsContextValue = {
    actions,
    total,
    dismissed: dismissed || onAccountHub,
    dismiss,
    isSeller: actions?.isSeller ?? false,
  };

  return (
    <PendingActionsContext.Provider value={value}>
      {children}
    </PendingActionsContext.Provider>
  );
}

export function usePendingActions() {
  return useContext(PendingActionsContext);
}
