'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { startConversation } from '@/lib/messages/actions';
import { MAX_MESSAGE_LENGTH } from '@/lib/messages/types';

interface StartConversationFormProps {
  listingId: string;
}

function StartConversationForm({ listingId }: StartConversationFormProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = message.trim();
      if (!trimmed || sending) return;

      setSending(true);
      setError(null);

      const result = await startConversation(listingId, trimmed, turnstileToken);
      if ('error' in result) {
        setError(result.error);
        setSending(false);
        turnstileRef.current?.reset();
      } else {
        router.push(`/messages/${result.conversationId}`);
      }
    },
    [message, sending, listingId, router, turnstileToken]
  );

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask a question about this game..."
        maxLength={MAX_MESSAGE_LENGTH}
        rows={3}
        className="w-full rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand resize-none"
      />
      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />
      {error && (
        <p className="mt-1 text-sm text-semantic-error">{error}</p>
      )}
      <div className="mt-3 flex justify-end">
        <Button type="submit" disabled={!message.trim() || sending}>
          {sending ? 'Sending...' : 'Send message'}
        </Button>
      </div>
    </form>
  );
}

export { StartConversationForm };
