'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadNotificationCount } from '@/lib/notifications/actions';

/**
 * Hook that returns the current user's unread notification count + a refresh function.
 * Refreshes on mount and on each pathname change (page navigation).
 * The refresh function allows the dropdown to trigger a re-fetch after marking all read.
 */
export function useUnreadNotificationCount(): [number, () => void] {
  const [count, setCount] = useState(0);
  const { user } = useAuth();
  const pathname = usePathname();

  const fetchCount = useCallback(() => {
    if (!user) {
      setCount(0);
      return;
    }
    getUnreadNotificationCount().then(setCount);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount, pathname]);

  return [count, fetchCount];
}
