'use client';

import { useState, useRef } from 'react';
import { Button, Input, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  if (status === 'success') {
    return (
      <p className="text-sm text-semantic-success">
        Subscribed. Welcome aboard.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      turnstileRef.current?.reset();
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="w-48 min-w-0">
          <Input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            required
            className="min-h-[36px] py-1.5 text-sm"
          />
        </div>
        <Button variant="secondary" size="sm" loading={status === 'loading'} className="min-h-[36px] shrink-0">
          Subscribe
        </Button>
      </form>
      <p className="text-xs text-semantic-text-muted mt-1.5">
        Occasional updates about new features. Unsubscribe anytime.
      </p>
      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />
      {status === 'error' && (
        <p className="text-xs text-semantic-error mt-1">{errorMsg}</p>
      )}
    </div>
  );
}
