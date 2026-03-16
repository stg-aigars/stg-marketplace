'use client';

import { useState } from 'react';
import { Input, Button } from '@/components/ui';
import { updateProfile } from '@/lib/auth/actions';
import { CountrySelector } from './CountrySelector';
import type { CountryCode } from '@/lib/country-utils';

export function CompleteProfileForm() {
  const [country, setCountry] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!country) {
      setError('Please select your country');
      return;
    }

    setLoading(true);

    const result = await updateProfile({
      country: country as CountryCode,
      displayName: displayName || undefined,
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

      {error && (
        <p className="text-sm text-semantic-error">{error}</p>
      )}

      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? 'Saving...' : 'Continue'}
      </Button>
    </form>
  );
}
