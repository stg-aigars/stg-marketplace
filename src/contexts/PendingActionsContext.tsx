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
const SELLER_CACHE_KEY = 'stg-is-seller';
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

function getCachedIsSeller(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SELLER_CACHE_KEY) === 'true';
  } catch {
    return false;
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
  const [cachedIsSeller, setCachedIsSeller] = useState(getCachedIsSeller);
  const lastFetchedAt = useRef(0);
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing state on sign-out
      setActions(null);
      lastFetchedAt.current = 0;
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
          // Cache isSeller so the next hard load renders the correct menu immediately
          const sellerFlag = !!data.isSeller;
          setCachedIsSeller(sellerFlag);
          try {
            sessionStorage.setItem(SELLER_CACHE_KEY, String(sellerFlag));
          } catch {
            // sessionStorage may be unavailable
          }
        }
      })
      .catch(() => {
        // Silent failure — non-blocking UI enhancement (includes AbortError)
      });

    return () => controller.abort();
  }, [user, pathname]);

  const total = actions ? getTotalPendingCount(actions) : 0;
  // Reset dismiss when new actions appear since dismissal
  const dismissed = total > 0 && total <= dismissedAtCount;
  // Suppress on the account hub page only — it has its own server-rendered ActionStrip
  const onAccountHub = stripLocalePrefix(pathname) === '/account';

  const dismiss = useCallback(() => {
    setDismissedAtCount(total);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAtCount: total }));
    } catch {
      // sessionStorage may be unavailable
    }
  }, [total]);

  // Use cached value until first fetch resolves to avoid seller→buyer flash
  const isSeller = actions ? actions.isSeller : cachedIsSeller;

  const value: PendingActionsContextValue = {
    actions,
    total,
    dismissed: dismissed || onAccountHub,
    dismiss,
    isSeller,
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
