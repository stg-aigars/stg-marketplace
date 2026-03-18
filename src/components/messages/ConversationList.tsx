import Link from 'next/link';
import Image from 'next/image';
import { formatMessageTime } from '@/lib/date-utils';
import type { Conversation } from '@/lib/messages/types';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
}

function ConversationList({ conversations, activeConversationId }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <svg
          className="w-16 h-16 mx-auto text-semantic-text-muted mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
        <p className="text-semantic-text-secondary text-lg">
          No messages yet
        </p>
        <p className="text-semantic-text-muted mt-1">
          When you message a seller about a listing, your conversations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-semantic-border-subtle">
      {conversations.map((conv) => {
        const isActive = conv.id === activeConversationId;
        const hasUnread = (conv.unread_count ?? 0) > 0;

        return (
          <Link
            key={conv.id}
            href={`/messages/${conv.id}`}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
              isActive
                ? 'bg-frost-ice/10'
                : 'hover:bg-semantic-bg-subtle'
            }`}
          >
            {/* Listing thumbnail */}
            <div className="w-12 h-12 rounded-lg bg-snow-storm-light flex items-center justify-center overflow-hidden shrink-0 relative">
              {conv.listing_thumbnail ? (
                <Image
                  src={conv.listing_thumbnail}
                  alt={conv.listing_title ?? ''}
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized={conv.listing_thumbnail?.includes('cf.geekdo-images.com')}
                />
              ) : (
                <svg className="w-6 h-6 text-semantic-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-semantic-text-heading' : 'font-medium text-semantic-text-heading'}`}>
                  {conv.listing_title ?? 'Unknown listing'}
                </p>
                <span className="text-xs text-semantic-text-muted shrink-0">
                  {formatMessageTime(conv.last_message_at)}
                </span>
              </div>
              <p className="text-xs text-semantic-text-muted mt-0.5">
                {conv.other_user_name}
              </p>
              {conv.last_message_content && (
                <p className={`text-sm mt-0.5 truncate ${hasUnread ? 'font-medium text-semantic-text-primary' : 'text-semantic-text-secondary'}`}>
                  {conv.last_message_content}
                </p>
              )}
            </div>

            {/* Unread indicator */}
            {hasUnread && (
              <div className="w-2.5 h-2.5 rounded-full bg-frost-arctic shrink-0" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export { ConversationList };
