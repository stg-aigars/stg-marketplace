'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadMessageCount } from '@/lib/messages/actions';

/**
 * Hook that returns the current user's unread message count.
 * Refreshes on mount and on each pathname change (page navigation).
 */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let cancelled = false;

    getUnreadMessageCount().then((n) => {
      if (!cancelled) setCount(n);
    });

    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  return count;
}
