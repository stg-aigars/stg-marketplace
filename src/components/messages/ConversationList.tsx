import Link from 'next/link';
import Image from 'next/image';
import { ChatCircle, Package } from '@phosphor-icons/react/ssr';
import { EmptyState } from '@/components/ui';
import { formatMessageTime } from '@/lib/date-utils';
import type { Conversation } from '@/lib/messages/types';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
}

function ConversationList({ conversations, activeConversationId }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={ChatCircle}
        title="No messages yet"
        description="When you message a seller about a listing, your conversations will appear here."
        className="px-4"
      />
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
            className={`flex items-center gap-3 px-4 py-3 transition-colors duration-250 ease-out-custom ${
              isActive
                ? 'bg-semantic-brand/10'
                : 'hover:bg-semantic-bg-subtle'
            }`}
          >
            {/* Listing thumbnail */}
            <div className="w-12 h-12 rounded-lg bg-semantic-bg-secondary flex items-center justify-center overflow-hidden shrink-0 relative">
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
                <Package size={24} className="text-semantic-text-muted" />
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
              <div className="w-2.5 h-2.5 rounded-full bg-semantic-brand-active shrink-0" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export { ConversationList };
