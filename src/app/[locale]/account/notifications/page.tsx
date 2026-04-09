import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getNotifications } from '@/lib/notifications/actions';
import { NotificationsPageClient } from './NotificationsPageClient';

export const metadata: Metadata = {
  title: 'Notifications',
};

export default async function NotificationsPage() {
  await requireServerAuth();

  const { notifications } = await getNotifications(50);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <NotificationsPageClient
        initialNotifications={notifications}
      />
    </div>
  );
}
