import { formatMessageTime } from '@/lib/date-utils';
import { ListingChipInline } from './ListingChipInline';
import { cn } from '@/lib/cn';

interface MessageBubbleProps {
  body: string;
  createdAt: string;
  isOwnMessage: boolean;
  listingChip:
    | { id: string; game_name: string; price_cents: number; primary_photo_url: string | null }
    | null;
}

export function MessageBubble({ body, createdAt, isOwnMessage, listingChip }: MessageBubbleProps) {
  return (
    <li className={cn('flex flex-col max-w-[80%]', isOwnMessage ? 'self-end items-end' : 'self-start items-start')}>
      {listingChip && (
        <div className="mb-1.5 w-full">
          <ListingChipInline listing={listingChip} />
        </div>
      )}
      <div
        className={cn(
          'rounded-md px-4 py-2.5 text-sm whitespace-pre-wrap break-words',
          isOwnMessage
            ? 'bg-semantic-brand text-semantic-text-inverse'
            : 'bg-semantic-bg-subtle text-semantic-text-primary',
        )}
      >
        {body}
      </div>
      <time
        dateTime={createdAt}
        className="mt-1 text-xs text-semantic-text-muted"
      >
        {formatMessageTime(createdAt)}
      </time>
    </li>
  );
}
