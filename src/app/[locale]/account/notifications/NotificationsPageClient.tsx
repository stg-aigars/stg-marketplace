'use client';

import { useState } from 'react';
import { Bell } from '@phosphor-icons/react/ssr';
import { Button, EmptyState } from '@/components/ui';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { markAllNotificationsRead } from '@/lib/notifications/actions';
import type { NotificationRow } from '@/lib/notifications/types';

interface NotificationsPageClientProps {
  initialNotifications: NotificationRow[];
  totalCount: number;
}

export function NotificationsPageClient({
  initialNotifications,
  totalCount,
}: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  };

  const handleItemRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications"
        description="You will see notifications here when you have order updates, comments, or offers."
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Notifications
          {totalCount > 0 && (
            <span className="ml-2 text-base font-normal text-semantic-text-muted">
              ({totalCount})
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-semantic-border-subtle overflow-hidden divide-y divide-semantic-border-subtle">
        {notifications.map((n) => (
          <NotificationItem key={n.id} notification={n} onRead={handleItemRead} />
        ))}
      </div>
    </>
  );
}
