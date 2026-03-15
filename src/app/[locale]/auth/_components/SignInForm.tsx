'use client';

import { useState } from 'react';
import { Input, Button } from '@/components/ui';
import { signInWithEmail } from '@/lib/auth/actions';
import { OAuthButton } from './OAuthButton';
import { Link } from '@/i18n/navigation';

interface SignInFormProps {
  returnUrl?: string;
  errorMessage?: string;
}

export function SignInForm({ returnUrl, errorMessage }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(errorMessage || '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signInWithEmail({ email, password }, returnUrl);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
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
            autoComplete="current-password"
          />
          <div className="mt-1.5 text-right">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-semantic-trust sm:hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-semantic-text-secondary">
        New here?{' '}
        <Link
          href="/auth/signup"
          className="font-medium text-semantic-trust sm:hover:underline"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
