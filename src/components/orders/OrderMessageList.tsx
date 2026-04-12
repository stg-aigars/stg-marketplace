'use client';

import { Badge, UserIdentity } from '@/components/ui';
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
    return null;
  }

  return (
    <div className="divide-y divide-semantic-border-subtle">
      {messages.map((message) => (
        <div key={message.id} className="py-3 last:pb-0 first:pt-0">
          <div className="flex items-center gap-2 mb-1.5">
            <UserIdentity
              name={message.author_name ?? '[deleted]'}
              avatarUrl={message.author_avatar_url}
              size="sm"
            >
              <Badge variant={message.author_role === 'seller' ? 'trust' : 'default'}>
                {message.author_role === 'seller' ? 'Seller' : 'Buyer'}
              </Badge>
            </UserIdentity>
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
