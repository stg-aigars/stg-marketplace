'use client';

import { useState } from 'react';
import { Card, CardBody, Input, Button, Alert, Badge } from '@/components/ui';
import { updateEmail, changePassword, setPassword } from '@/lib/auth/actions';

interface SecuritySectionProps {
  email: string;
  hasPassword: boolean;
  authProvider: string;
}

export function SecuritySection({ email, hasPassword, authProvider }: SecuritySectionProps) {
  // Email form state
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Set password form state (for Google-only users)
  const [setNewPw, setSetNewPw] = useState('');
  const [setConfirmPw, setSetConfirmPw] = useState('');
  const [setPwError, setSetPwError] = useState('');
  const [setPwSuccess, setSetPwSuccess] = useState('');
  const [setPwLoading, setSetPwLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);

    const result = await updateEmail(newEmail);

    if (result?.error) {
      setEmailError(result.error);
    } else if (result?.success) {
      setEmailSuccess(result.success);
      setNewEmail('');
    }

    setEmailLoading(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordLoading(true);

    const result = await changePassword(currentPassword, newPassword);

    if (result?.error) {
      setPasswordError(result.error);
    } else if (result?.success) {
      setPasswordSuccess(result.success);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }

    setPasswordLoading(false);
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setSetPwError('');
    setSetPwSuccess('');

    if (setNewPw.length < 8) {
      setSetPwError('Password must be at least 8 characters');
      return;
    }

    if (setNewPw !== setConfirmPw) {
      setSetPwError('Passwords do not match');
      return;
    }

    setSetPwLoading(true);

    const result = await setPassword(setNewPw);

    if (result?.error) {
      setSetPwError(result.error);
    } else if (result?.success) {
      setSetPwSuccess(result.success);
      setSetNewPw('');
      setSetConfirmPw('');
    }

    setSetPwLoading(false);
  }

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
          Email and security
        </h2>

        {/* Auth provider info */}
        {authProvider === 'google' && (
          <div className="mb-3">
            <Badge variant="default">Signed in with Google</Badge>
          </div>
        )}
        <p className="text-sm text-semantic-text-secondary mb-4">
          {email}
        </p>

        {/* Email change */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <Input
            id="newEmail"
            label="New email address"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Button type="submit" size="sm" loading={emailLoading}>
            {emailLoading ? 'Updating...' : 'Update email'}
          </Button>
          {emailSuccess && (
            <Alert variant="success">{emailSuccess}</Alert>
          )}
          {emailError && (
            <Alert variant="error">{emailError}</Alert>
          )}
        </form>

        {/* Change password (email users) */}
        {hasPassword && (
          <div className="border-t border-semantic-border-subtle pt-4 mt-4">
            <h3 className="text-sm font-semibold text-semantic-text-heading mb-3">
              Change password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <Input
                id="currentPassword"
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Input
                id="changeNewPassword"
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <Input
                id="changeConfirmPassword"
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <Button type="submit" size="sm" loading={passwordLoading}>
                {passwordLoading ? 'Changing...' : 'Change password'}
              </Button>
              {passwordSuccess && (
                <Alert variant="success">{passwordSuccess}</Alert>
              )}
              {passwordError && (
                <Alert variant="error">{passwordError}</Alert>
              )}
            </form>
          </div>
        )}

        {/* Set password (Google-only users) */}
        {!hasPassword && (
          <div className="border-t border-semantic-border-subtle pt-4 mt-4">
            <h3 className="text-sm font-semibold text-semantic-text-heading mb-3">
              Set a password
            </h3>
            <p className="text-sm text-semantic-text-muted mb-3">
              Set a password to also sign in with email
            </p>
            <form onSubmit={handleSetPassword} className="space-y-3">
              <Input
                id="setNewPassword"
                label="New password"
                type="password"
                value={setNewPw}
                onChange={(e) => setSetNewPw(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <Input
                id="setConfirmPassword"
                label="Confirm password"
                type="password"
                value={setConfirmPw}
                onChange={(e) => setSetConfirmPw(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <Button type="submit" size="sm" loading={setPwLoading}>
                {setPwLoading ? 'Setting...' : 'Set password'}
              </Button>
              {setPwSuccess && (
                <Alert variant="success">{setPwSuccess}</Alert>
              )}
              {setPwError && (
                <Alert variant="error">{setPwError}</Alert>
              )}
            </form>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
