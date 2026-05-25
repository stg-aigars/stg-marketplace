'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { formatMessageTime } from '@/lib/date-utils';
import { cn } from '@/lib/cn';
import type { ThreadRow } from './page';

interface ThreadListProps {
  threads: ThreadRow[];
}

export function ThreadList({ threads }: ThreadListProps) {
  return (
    <ul className="divide-y divide-semantic-border-default">
      {threads.map((t) => {
        const unread = !t.viewer_last_read_at || t.last_message_at > t.viewer_last_read_at;
        const name = t.counterparty?.full_name ?? '[deleted user]';
        const flagClass = t.counterparty?.country ? getCountryFlag(t.counterparty.country) : '';
        const countryName = t.counterparty?.country ? getCountryName(t.counterparty.country) : '';
        return (
          <li key={t.id}>
            <Link
              href={`/account/messages/${t.id}`}
              className={cn(
                'flex items-start gap-3 px-4 py-3 sm:py-4 transition-colors duration-250 ease-out-custom',
                unread ? 'bg-semantic-brand/5' : '',
                'sm:hover:bg-semantic-bg-secondary',
              )}
            >
              <Avatar name={name} src={t.counterparty?.avatar_url} size="md" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      'truncate flex items-center gap-1.5',
                      unread
                        ? 'font-semibold text-semantic-text-primary'
                        : 'font-medium text-semantic-text-secondary',
                    )}
                  >
                    <span className="truncate">{name}</span>
                    {flagClass && (
                      <span
                        className={`${flagClass} shrink-0`}
                        title={countryName}
                        aria-label={countryName}
                      />
                    )}
                  </p>
                  <time
                    dateTime={t.last_message_at}
                    className={cn(
                      'text-xs shrink-0',
                      unread ? 'text-semantic-brand-active font-medium' : 'text-semantic-text-muted',
                    )}
                  >
                    {formatMessageTime(t.last_message_at)}
                  </time>
                </div>
                <p
                  className={cn(
                    'mt-1 text-sm truncate',
                    unread ? 'text-semantic-text-primary' : 'text-semantic-text-muted',
                  )}
                >
                  {t.last_message_preview || ' '}
                </p>
              </div>
              {unread && (
                <span
                  aria-label="Unread"
                  className="mt-2 shrink-0 w-2 h-2 rounded-full bg-semantic-brand-active"
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
