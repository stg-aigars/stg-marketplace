'use client';

import Link from 'next/link';
import { UserIdentity } from '@/components/ui';
import { formatMessageTime } from '@/lib/date-utils';
import type { ThreadRow } from './page';

interface ThreadListProps {
  threads: ThreadRow[];
}

export function ThreadList({ threads }: ThreadListProps) {
  return (
    <ul className="divide-y divide-semantic-border-default border border-semantic-border-default rounded-lg overflow-hidden">
      {threads.map((t) => {
        const unread = !t.viewer_last_read_at || t.last_message_at > t.viewer_last_read_at;
        const name = t.counterparty?.full_name ?? '[deleted user]';
        return (
          <li key={t.id}>
            <Link
              href={`/account/messages/${t.id}`}
              className="flex items-start gap-3 px-4 py-3 sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <UserIdentity
                    name={name}
                    avatarUrl={t.counterparty?.avatar_url}
                    country={t.counterparty?.country}
                  />
                  <span className="text-xs text-semantic-text-muted shrink-0">
                    {formatMessageTime(t.last_message_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-semantic-text-secondary truncate">
                  {t.last_message_preview || ' '}
                </p>
              </div>
              {unread && (
                <span
                  aria-label="Unread"
                  className="mt-2 shrink-0 w-2 h-2 rounded-full bg-semantic-brand"
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
