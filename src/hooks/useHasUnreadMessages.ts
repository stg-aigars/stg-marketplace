'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { hasUnreadMessages } from '@/lib/notifications/actions';

/**
 * Hook that returns whether the current user has any unread `message.*` notifications.
 * Refreshes on mount and on each pathname change (same cadence as useUnreadNotificationCount).
 * Drives the small dot next to "Messages" in the header dropdown / mobile menu.
 */
export function useHasUnreadMessages(): boolean {
  const [hasUnread, setHasUnread] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();

  const fetch = useCallback(() => {
    if (!user) {
      setHasUnread(false);
      return;
    }
    hasUnreadMessages().then(setHasUnread);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetching on pathname change
    fetch();
  }, [fetch, pathname]);

  return hasUnread;
}
