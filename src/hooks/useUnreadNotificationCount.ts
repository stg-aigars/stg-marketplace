'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadNotificationCount } from '@/lib/notifications/actions';

/**
 * Hook that returns the current user's unread notification count.
 * Refreshes on mount and on each pathname change (page navigation).
 * Same pattern as useUnreadCount for messages.
 */
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0);
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let cancelled = false;

    getUnreadNotificationCount().then((n) => {
      if (!cancelled) setCount(n);
    });

    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  return count;
}
