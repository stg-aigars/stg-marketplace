'use client';

import { useState } from 'react';
import { Card, CardBody, Input, Button, Alert } from '@/components/ui';
import { updateDisplayName } from '@/lib/auth/actions';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import type { UserProfile } from '@/lib/auth/types';

interface ProfileSettingsSectionProps {
  profile: UserProfile;
}

export function ProfileSettingsSection({ profile }: ProfileSettingsSectionProps) {
  // Display name form state
  const [displayName, setDisplayName] = useState(profile.full_name || '');
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  // Phone form state
  const [phone, setPhone] = useState(profile.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');
    setNameLoading(true);

    const result = await updateDisplayName(displayName);

    if (result?.error) {
      setNameError(result.error);
    } else if (result?.success) {
      setNameSuccess(result.success);
    }

    setNameLoading(false);
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');
    setPhoneLoading(true);

    try {
      const res = await fetch('/api/profile/phone', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPhoneError(data.error || 'Something went wrong. Please try again');
      } else {
        setPhoneSuccess(data.success || 'Phone number updated');
      }
    } catch {
      setPhoneError('Something went wrong. Please try again');
    }

    setPhoneLoading(false);
  }

  const flagClass = getCountryFlag(profile.country);
  const countryName = getCountryName(profile.country);

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
          Profile
        </h2>

        {/* Display name */}
        <form onSubmit={handleNameSubmit} className="space-y-3">
          <Input
            id="displayName"
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Button type="submit" size="sm" loading={nameLoading}>
            {nameLoading ? 'Saving...' : 'Save'}
          </Button>
          {nameSuccess && (
            <Alert variant="success">{nameSuccess}</Alert>
          )}
          {nameError && (
            <Alert variant="error">{nameError}</Alert>
          )}
        </form>

        {/* Phone number */}
        <div className="border-t border-semantic-border-subtle pt-4 mt-4">
          <form onSubmit={handlePhoneSubmit} className="space-y-3">
            <Input
              id="phone"
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
            <p className="text-sm text-semantic-text-muted">
              Include country code, e.g. +37061234567
            </p>
            <Button type="submit" size="sm" loading={phoneLoading}>
              {phoneLoading ? 'Saving...' : 'Save'}
            </Button>
            {phoneSuccess && (
              <Alert variant="success">{phoneSuccess}</Alert>
            )}
            {phoneError && (
              <Alert variant="error">{phoneError}</Alert>
            )}
          </form>
        </div>

        {/* Country (read-only) */}
        <div className="border-t border-semantic-border-subtle pt-4 mt-4">
          <p className="block text-sm font-medium text-semantic-text-primary mb-1.5">
            Country
          </p>
          <p className="text-sm text-semantic-text-primary">
            {flagClass && <span className={`${flagClass} mr-2`} />}
            {countryName}
          </p>
          <p className="text-sm text-semantic-text-muted mt-1">
            Country affects VAT and shipping. Contact support to change.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
