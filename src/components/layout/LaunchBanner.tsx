'use client';

import { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react/ssr';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

const STORAGE_KEY = 'stg:launch-banner-dismissed:v1';

export function LaunchBanner() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    setMounted(true);
  }, []);

  // Don't render until mounted (avoids hydration mismatch from localStorage read)
  if (!mounted || loading) return null;
  // Hide for authenticated users
  if (user) return null;
  // Hide if dismissed or already subscribed
  if (dismissed) return null;

  function hide() {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const res = await apiFetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong');
      }

      hide();
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="bg-semantic-brand/10 border-b border-semantic-brand/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <p className="text-sm font-medium text-semantic-text-heading flex-1 min-w-0">
          We&rsquo;re launching soon. Leave your email to be the first to know.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2 items-start shrink-0">
          <div className="w-56 min-w-0">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              placeholder="Your email"
              required
              error={error}
              className="min-h-[36px] py-1.5 text-sm"
            />
          </div>
          <Button
            variant="brand"
            size="sm"
            loading={status === 'loading'}
            className="min-h-[36px] shrink-0"
          >
            Notify me
          </Button>
        </form>
        <Button
          variant="ghost"
          size="sm"
          onClick={hide}
          aria-label="Dismiss"
          className="shrink-0 !p-1 hidden sm:flex"
        >
          <X size={16} weight="bold" />
        </Button>
      </div>
    </div>
  );
}
