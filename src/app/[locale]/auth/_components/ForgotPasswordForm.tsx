'use client';

import { useState, useRef } from 'react';
import { Input, Button, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { resetPassword } from '@/lib/auth/actions';
import { Link } from '@/i18n/navigation';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await resetPassword(email, turnstileToken);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      turnstileRef.current?.reset();
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-semantic-text-primary">
          Check your email for a reset link. It may take a minute to arrive.
        </p>
        <Link
          href="/auth/signin"
          className="text-sm font-medium text-semantic-brand sm:hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          type="email"
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}

        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-center text-sm text-semantic-text-secondary">
        <Link
          href="/auth/signin"
          className="font-medium text-semantic-brand sm:hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
