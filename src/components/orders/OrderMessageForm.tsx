'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Textarea } from '@/components/ui';
import { postOrderMessage } from '@/lib/order-messages/actions';
import { MAX_ORDER_MESSAGE_LENGTH } from '@/lib/order-messages/types';

interface OrderMessageFormProps {
  orderId: string;
}

export function OrderMessageForm({ orderId }: OrderMessageFormProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await postOrderMessage(orderId, trimmed);
    if ('error' in result) {
      setError(result.error);
      setSubmitting(false);
    } else {
      setContent('');
      setSubmitting(false);
      router.refresh();
    }
  };

  const charCount = content.length;

  return (
    <form onSubmit={handleSubmit}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Send a message..."
        maxLength={MAX_ORDER_MESSAGE_LENGTH}
        rows={2}
      />
      {error && (
        <p className="mt-1 text-sm text-semantic-error">{error}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-semantic-text-muted">
          {charCount > 0 && `${charCount}/${MAX_ORDER_MESSAGE_LENGTH}`}
        </span>
        <Button type="submit" size="sm" disabled={!content.trim() || submitting}>
          {submitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </form>
  );
}
