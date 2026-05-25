'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Textarea, Alert } from '@/components/ui';
import { sendFirstMessage } from '@/lib/messaging/actions';
import { MESSAGE_MAX_LENGTH, type MessagingError } from '@/lib/messaging/types';

interface NewMessageFormProps {
  otherUserId: string;
  seedListingId?: string;
  entryPoint: 'listing_detail' | 'seller_profile';
}

function copyForError(error: MessagingError): string {
  switch (error) {
    case 'invalid_body':
      return 'We couldn’t send your message. Please check the length and try again.';
    case 'invalid_listing_ref':
      return 'That listing isn’t part of this conversation. Try removing it.';
    case 'self_target':
      return 'You can’t message yourself.';
    case 'unknown_user':
      return 'This user is no longer available.';
    case 'unauthenticated':
      return 'Sign in to send a message.';
    case 'cannot_message_user':
    default:
      return 'This seller isn’t accepting new messages right now.';
  }
}

export function NewMessageForm({ otherUserId, seedListingId, entryPoint }: NewMessageFormProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      const result = await sendFirstMessage({
        otherUserId,
        body: trimmed,
        listingRefId: seedListingId,
        entryPoint,
      });
      if (!result.ok) {
        setError(copyForError(result.error));
        return;
      }
      router.push(`/account/messages/${result.thread_id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <Alert variant="error">{error}</Alert>}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your first message…"
        rows={5}
        maxLength={MESSAGE_MAX_LENGTH}
        disabled={isPending}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-semantic-text-muted">
          {body.length}/{MESSAGE_MAX_LENGTH}
        </span>
        <Button type="submit" variant="brand" disabled={isPending || !body.trim()}>
          {isPending ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  );
}
