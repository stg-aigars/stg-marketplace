'use client';

import { useState, useTransition } from 'react';
import { Button, Textarea } from '@/components/ui';
import { sendMessage } from '@/lib/messaging/actions';
import { MESSAGE_MAX_LENGTH } from '@/lib/messaging/types';

interface ComposerProps {
  threadId: string;
  disabled: boolean;
  disabledReason: string | null;
  onOptimisticSend?: (body: string) => void;
}

export function Composer({ threadId, disabled, disabledReason, onOptimisticSend }: ComposerProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (disabled) {
    return (
      <div className="rounded-md border border-semantic-border-default bg-semantic-bg-subtle px-4 py-3 text-sm text-semantic-text-muted">
        {disabledReason ?? 'You can’t reply to this conversation.'}
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      setError(`Messages are limited to ${MESSAGE_MAX_LENGTH} characters.`);
      return;
    }
    startTransition(async () => {
      onOptimisticSend?.(trimmed);
      const result = await sendMessage({ threadId, body: trimmed });
      if ('error' in result) {
        setError(
          result.error === 'invalid_body'
            ? 'We couldn’t send your message. Please check the length and try again.'
            : 'We couldn’t send your message. Please try again.',
        );
        return;
      }
      setBody('');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a message…"
        rows={3}
        maxLength={MESSAGE_MAX_LENGTH}
        disabled={isPending}
        error={error ?? undefined}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-semantic-text-muted">
          {body.length}/{MESSAGE_MAX_LENGTH}
        </span>
        <Button type="submit" variant="brand" disabled={isPending || !body.trim()}>
          {isPending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </form>
  );
}
