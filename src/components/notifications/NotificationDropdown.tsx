'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { NotificationItem } from './NotificationItem';
import { getNotifications, markAllNotificationsRead } from '@/lib/notifications/actions';
import type { NotificationRow } from '@/lib/notifications/types';

interface NotificationDropdownProps {
  unreadCount: number;
  onCountChange?: () => void;
}

function NotificationDropdown({ unreadCount, onCountChange }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);

  // Fetch on first open, refetch only when pathname changes
  const fetchNotifications = useCallback(async () => {
    const { notifications: data } = await getNotifications(10);
    setNotifications(data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      void fetchNotifications();
    }
  }, [open, loaded, fetchNotifications]);

  // Refetch when pathname changes (only if already loaded)
  useEffect(() => {
    if (pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      if (loaded) {
        setLoaded(false); // Will refetch on next open
      }
    }
  }, [pathname, loaded]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    onCountChange?.();
  };

  const handleItemRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    onCountChange?.();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={22} weight={unreadCount > 0 ? 'fill' : 'regular'} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-aurora-red text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 max-h-[28rem] rounded-lg bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-semantic-border-subtle">
            <h3 className="text-sm font-semibold text-semantic-text-heading">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                Mark all read
              </Button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[22rem]">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-semantic-text-muted text-center">
                No notifications yet
              </p>
            ) : (
              <div className="divide-y divide-semantic-border-subtle">
                {notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={handleItemRead} />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-semantic-border-subtle px-4 py-2">
            <Link
              href="/account/notifications"
              className="block text-center text-sm text-semantic-brand-active sm:hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export { NotificationDropdown };
