'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Trash } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Input, PhoneInput, Button, Alert, Avatar } from '@/components/ui';
import { updateDisplayName } from '@/lib/auth/actions';
import { apiFetch } from '@/lib/api-fetch';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import type { UserProfile } from '@/lib/auth/types';
import type { CountryCode } from '@/lib/country-utils';

interface ProfileSettingsSectionProps {
  profile: UserProfile;
  returnUrl?: string;
}

export function ProfileSettingsSection({ profile, returnUrl }: ProfileSettingsSectionProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.full_name || '');
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  const [phone, setPhone] = useState(profile.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke blob URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');
    setAvatarLoading(true);

    // Immediate blob preview
    const blobUrl = URL.createObjectURL(file);
    setAvatarPreview(blobUrl);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setAvatarError(data.error || 'Upload failed');
        URL.revokeObjectURL(blobUrl);
        setAvatarPreview('');
      } else {
        setAvatarUrl(data.avatarUrl);
        URL.revokeObjectURL(blobUrl);
        setAvatarPreview('');
        router.refresh();
      }
    } catch {
      setAvatarError('Something went wrong. Please try again');
      URL.revokeObjectURL(blobUrl);
      setAvatarPreview('');
    }

    setAvatarLoading(false);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [router]);

  async function handleAvatarRemove() {
    setAvatarError('');
    setAvatarLoading(true);

    try {
      const res = await apiFetch('/api/profile/avatar', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        setAvatarError(data.error || 'Failed to remove avatar');
      } else {
        setAvatarUrl('');
        router.refresh();
      }
    } catch {
      setAvatarError('Something went wrong. Please try again');
    }

    setAvatarLoading(false);
  }

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
      const res = await apiFetch('/api/profile/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPhoneError(data.error || 'Something went wrong. Please try again');
      } else if (returnUrl) {
        router.push(returnUrl);
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

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-semantic-border-subtle">
          <Avatar
            name={displayName || 'User'}
            src={avatarPreview || avatarUrl || null}
            size="lg"
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                loading={avatarLoading}
              >
                <Camera size={16} className="mr-1.5" />
                {avatarUrl ? 'Change photo' : 'Add photo'}
              </Button>
              {avatarUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleAvatarRemove}
                  disabled={avatarLoading}
                >
                  <Trash size={16} className="mr-1.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-semantic-text-muted">JPEG, PNG, or WebP. Max 2MB.</p>
            {avatarError && <p className="text-xs text-semantic-error">{avatarError}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

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
            <PhoneInput
              id="phone"
              label="Phone number"
              value={phone}
              onChange={setPhone}
              defaultCountry={profile.country as CountryCode}
            />
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
