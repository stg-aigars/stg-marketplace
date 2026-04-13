'use client';

import { useState, useRef } from 'react';
import { Input, Button, TurnstileWidget, Checkbox } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { signUpWithEmail } from '@/lib/auth/actions';
import { OAuthButton } from './OAuthButton';
import { CountrySelector } from './CountrySelector';
import { Link } from '@/i18n/navigation';
import type { CountryCode } from '@/lib/country-utils';

interface SignUpFormProps {
  returnUrl?: string;
}

export function SignUpForm({ returnUrl }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const canSubmit =
    displayName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    country &&
    acceptedTerms;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Defense-in-depth: disabled button can be bypassed via devtools
    if (!country) {
      setError('Please select your country');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);

    const result = await signUpWithEmail({
      email,
      password,
      displayName,
      country: country as CountryCode,
    }, turnstileToken, returnUrl);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      turnstileRef.current?.reset();
    }
  }

  const signInHref = returnUrl
    ? `/auth/signin?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/auth/signin';

  return (
    <div className="space-y-6">
      <OAuthButton returnUrl={returnUrl} label="Sign up with Google" />

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
        <div>
          <Input
            id="displayName"
            type="text"
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="name"
          />
          <p className="mt-1.5 text-sm text-semantic-text-muted">
            Shown on your public profile
          </p>
        </div>

        <Input
          id="email"
          type="email"
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <div>
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
          <p className="mt-1.5 text-sm text-semantic-text-muted">
            At least 8 characters with letters, numbers, and symbols
          </p>
        </div>

        <CountrySelector
          value={country as CountryCode | ''}
          onChange={(code) => setCountry(code)}
        />

        <div className="border-t border-semantic-border-subtle pt-4">
          <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
            I agree to the{' '}
            <Link
              href="/terms"
              target="_blank"
              className="link-brand"
            >
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link
              href="/privacy"
              target="_blank"
              className="link-brand"
            >
              Privacy Policy
            </Link>
          </Checkbox>
        </div>

        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}

        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

        <Button
          type="submit"
          size="lg"
          loading={loading}
          disabled={!canSubmit || loading}
          className="w-full"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-semantic-text-secondary">
        Already have an account?{' '}
        <Link
          href={signInHref}
          className="font-medium text-semantic-brand sm:hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
