'use client';

import { ChatCircleDots } from '@phosphor-icons/react/ssr';
import { Avatar, Badge } from '@/components/ui';
import { formatMessageTime } from '@/lib/date-utils';
import { DeleteOrderMessageButton } from './DeleteOrderMessageButton';
import type { OrderMessage } from '@/lib/order-messages/types';

interface OrderMessageListProps {
  messages: OrderMessage[];
  isStaff: boolean;
  locale?: string;
}

export function OrderMessageList({ messages, isStaff, locale }: OrderMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-6">
        <ChatCircleDots size={36} className="mx-auto text-semantic-text-muted mb-2" />
        <p className="text-sm text-semantic-text-muted">
          No messages yet. Send a message to coordinate details.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-semantic-border-subtle">
      {messages.map((message) => (
        <div key={message.id} className="py-3 last:pb-0 first:pt-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Avatar name={message.author_name ?? '?'} size="sm" />
            <span className="text-sm font-medium text-semantic-text-heading truncate">
              {message.author_name ?? '[deleted]'}
            </span>
            <Badge variant={message.author_role === 'seller' ? 'trust' : 'default'}>
              {message.author_role === 'seller' ? 'Seller' : 'Buyer'}
            </Badge>
            <span className="text-xs text-semantic-text-muted ml-auto flex-shrink-0">
              {formatMessageTime(message.created_at, locale)}
            </span>
            {isStaff && (
              <DeleteOrderMessageButton messageId={message.id} orderId={message.order_id} />
            )}
          </div>
          <p className="text-sm text-semantic-text-secondary whitespace-pre-line pl-8">
            {message.content}
          </p>
        </div>
      ))}
    </div>
  );
}
