'use client';

import { useState, useRef } from 'react';
import { Input, Button, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { signUpWithEmail } from '@/lib/auth/actions';
import { OAuthButton } from './OAuthButton';
import { CountrySelector } from './CountrySelector';
import { Link } from '@/i18n/navigation';
import type { CountryCode } from '@/lib/country-utils';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!country) {
      setError('Please select your country');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const result = await signUpWithEmail({
      email,
      password,
      displayName,
      country: country as CountryCode,
    }, turnstileToken);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      turnstileRef.current?.reset();
    }
  }

  return (
    <div className="space-y-6">
      <OAuthButton />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-semantic-border-subtle" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-semantic-bg-elevated px-2 text-semantic-text-muted">
            or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="displayName"
          type="text"
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          autoComplete="name"
        />

        <Input
          id="email"
          type="email"
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />

        <CountrySelector
          value={country as CountryCode | ''}
          onChange={(code) => setCountry(code)}
        />

        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}

        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-semantic-text-secondary">
        Already have an account?{' '}
        <Link
          href="/auth/signin"
          className="font-medium text-semantic-brand sm:hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
