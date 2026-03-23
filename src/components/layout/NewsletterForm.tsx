'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          required
          className="min-h-[36px] rounded-md border border-semantic-border-default bg-semantic-bg-elevated px-3 py-1.5 text-sm text-semantic-text-primary placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus w-48"
        />
        <Button variant="secondary" size="sm" loading={status === 'loading'} className="min-h-[36px]">
          Subscribe
        </Button>
      </form>
      <p className="text-xs text-semantic-text-muted mt-1.5">
        Occasional updates about new features. Unsubscribe anytime.
      </p>
      {status === 'error' && (
        <p className="text-xs text-semantic-error mt-1">{errorMsg}</p>
      )}
    </div>
  );
}
