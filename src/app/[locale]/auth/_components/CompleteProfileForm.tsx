'use client';

import { useState } from 'react';
import { Input, Button, Checkbox } from '@/components/ui';
import { updateProfile } from '@/lib/auth/actions';
import { CountrySelector } from './CountrySelector';
import { Link } from '@/i18n/navigation';
import type { CountryCode } from '@/lib/country-utils';

interface CompleteProfileFormProps {
  returnUrl?: string;
}

export function CompleteProfileForm({ returnUrl }: CompleteProfileFormProps) {
  const [country, setCountry] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = country && acceptedTerms;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!country) {
      setError('Please select your country');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);

    const result = await updateProfile({
      country: country as CountryCode,
      displayName: displayName || undefined,
      returnUrl,
      termsAccepted: true,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CountrySelector
        value={country as CountryCode | ''}
        onChange={(code) => setCountry(code)}
      />

      <Input
        id="displayName"
        type="text"
        label="Display name (optional)"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        autoComplete="name"
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

      <Button
        type="submit"
        size="lg"
        loading={loading}
        disabled={!canSubmit || loading}
        className="w-full"
      >
        {loading ? 'Saving...' : 'Continue'}
      </Button>
    </form>
  );
}
