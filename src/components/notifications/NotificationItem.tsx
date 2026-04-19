'use client';

import Link from 'next/link';
import {
  Package, ChatCircle, Gavel, Truck, Trash,
} from '@phosphor-icons/react/ssr';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { formatMessageTime } from '@/lib/date-utils';
import { markNotificationRead } from '@/lib/notifications/actions';
import type { NotificationRow } from '@/lib/notifications/types';

const TYPE_ICONS: Record<string, PhosphorIcon> = {
  order: Package,
  comment: ChatCircle,
  dispute: Gavel,
  shipping: Truck,
};

function getIconPrefix(type: string): string {
  return type.split('.')[0];
}

interface NotificationItemProps {
  notification: NotificationRow;
  onRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function NotificationItem({ notification, onRead, onDelete }: NotificationItemProps) {
  const Icon = TYPE_ICONS[getIconPrefix(notification.type)] ?? Package;
  const isUnread = !notification.read_at;

  const handleClick = () => {
    if (isUnread) {
      void markNotificationRead(notification.id);
      onRead?.(notification.id);
    }
  };

  const content = (
    <div
      className={`flex gap-3 px-4 py-3 transition-colors duration-250 ease-out-custom ${
        isUnread
          ? 'bg-semantic-brand/5'
          : ''
      } sm:hover:bg-semantic-bg-secondary`}
    >
      <div className="shrink-0 mt-0.5">
        <Icon size={18} className={isUnread ? 'text-semantic-brand-active' : 'text-semantic-text-muted'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isUnread ? 'font-medium text-semantic-text-primary' : 'text-semantic-text-secondary'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-semantic-text-muted mt-0.5 line-clamp-2">
          {notification.body}
        </p>
        <p className="text-xs text-semantic-text-tertiary mt-1">
          {formatMessageTime(notification.created_at)}
        </p>
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="shrink-0 mt-0.5 p-1 text-semantic-text-muted sm:hover:text-semantic-error transition-colors duration-250 ease-out-custom"
          aria-label="Delete notification"
        >
          <Trash size={14} />
        </button>
      ) : isUnread ? (
        <div className="shrink-0 mt-2">
          <div className="w-2 h-2 rounded-full bg-semantic-brand-active" />
        </div>
      ) : null}
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={handleClick} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export { NotificationItem };
