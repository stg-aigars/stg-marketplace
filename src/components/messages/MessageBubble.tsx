import { formatMessageTime } from '@/lib/date-utils';

interface MessageBubbleProps {
  content: string;
  senderName: string;
  createdAt: string;
  isOwn: boolean;
}

function MessageBubble({ content, senderName, createdAt, isOwn }: MessageBubbleProps) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
          isOwn
            ? 'bg-semantic-brand/20 text-semantic-text-primary rounded-br-md'
            : 'bg-semantic-bg-subtle text-semantic-text-primary rounded-bl-md'
        }`}
      >
        {!isOwn && (
          <p className="text-xs font-medium text-semantic-text-muted mb-0.5">
            {senderName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <p className={`text-[11px] mt-1 ${isOwn ? 'text-semantic-brand-active/60' : 'text-semantic-text-muted'}`}>
          {formatMessageTime(createdAt)}
        </p>
      </div>
    </div>
  );
}

export { MessageBubble };
