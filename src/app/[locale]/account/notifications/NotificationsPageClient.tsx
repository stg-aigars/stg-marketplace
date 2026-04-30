'use client';

import { useState } from 'react';
import { Bell } from '@phosphor-icons/react/ssr';
import { Button, EmptyState } from '@/components/ui';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { markAllNotificationsRead, deleteNotification } from '@/lib/notifications/actions';
import type { NotificationRow } from '@/lib/notifications/types';

interface NotificationsPageClientProps {
  initialNotifications: NotificationRow[];
}

export function NotificationsPageClient({
  initialNotifications,
}: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [showAll, setShowAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const displayed = showAll ? notifications : notifications.slice(0, 10);

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

  const handleDelete = async (id: string) => {
    const result = await deleteNotification(id);
    if (!('error' in result)) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="All quiet"
        description="We'll ping you here when there's order news, comments, or other activity."
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-semantic-text-heading">
          Notifications
          {notifications.length > 0 && (
            <span className="ml-2 text-base font-normal text-semantic-text-muted">
              ({notifications.length})
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
        {displayed.map((n) => (
          <NotificationItem key={n.id} notification={n} onRead={handleItemRead} onDelete={handleDelete} />
        ))}
      </div>
      {notifications.length > 10 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 text-sm text-semantic-brand-active sm:hover:underline transition-colors duration-250 ease-out-custom"
        >
          Show all {notifications.length} notifications
        </button>
      )}
    </>
  );
}
