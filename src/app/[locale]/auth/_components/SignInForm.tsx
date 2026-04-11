'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Button, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { validateSignIn } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/browser';
import { useAuth } from '@/contexts/AuthContext';
import { OAuthButton } from './OAuthButton';
import { Link } from '@/i18n/navigation';

/** Prevent open redirects — only allow relative paths. */
function safeReturnUrl(url?: string): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return '/';
  }
  return url;
}

interface SignInFormProps {
  returnUrl?: string;
  errorMessage?: string;
}

export function SignInForm({ returnUrl, errorMessage }: SignInFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(errorMessage || '');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  // Redirect away if user becomes authenticated (e.g. after OAuth callback)
  useEffect(() => {
    if (user) {
      router.replace(safeReturnUrl(returnUrl));
    }
  }, [user, router, returnUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const validation = await validateSignIn(turnstileToken);
    if (validation?.error) {
      setError(validation.error);
      setLoading(false);
      turnstileRef.current?.reset();
      return;
    }

    // Sign in on browser client so onAuthStateChange fires SIGNED_IN
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Invalid email or password');
      setLoading(false);
      turnstileRef.current?.reset();
      return;
    }

    // AuthProvider's onAuthStateChange sets user → useEffect above handles redirect
  }

  return (
    <div className="space-y-6">
      <OAuthButton returnUrl={returnUrl} />

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
              className="text-sm text-semantic-brand sm:hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}

        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-semantic-text-secondary">
        New here?{' '}
        <Link
          href="/auth/signup"
          className="font-medium text-semantic-brand sm:hover:underline"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
