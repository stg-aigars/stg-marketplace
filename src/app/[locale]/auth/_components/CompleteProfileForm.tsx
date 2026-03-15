'use client';

import { useState } from 'react';
import { Input, Button, Select } from '@/components/ui';
import { updateProfile } from '@/lib/auth/actions';
import { COUNTRIES } from '@/lib/country-utils';
import type { CountryCode } from '@/lib/country-utils';

const countryOptions = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
}));

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
      <Select
        id="country"
        label="Your country"
        options={countryOptions}
        placeholder="Select your country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        required
      />
      <p className="-mt-2 text-sm text-semantic-text-muted">
        Your country determines shipping routes and marketplace settings
      </p>

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
