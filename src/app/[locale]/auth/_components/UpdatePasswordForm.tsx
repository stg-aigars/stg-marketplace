'use client';

import { useState } from 'react';
import { Input, Button } from '@/components/ui';
import { updatePassword } from '@/lib/auth/actions';
import {
  PASSWORD_REQUIREMENT_MESSAGE,
  validatePasswordStrength,
} from '@/lib/auth/password-validation';

export function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const result = await updatePassword(password);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          id="password"
          type="password"
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />
        <p className="mt-1.5 text-sm text-semantic-text-muted">
          {PASSWORD_REQUIREMENT_MESSAGE}
        </p>
      </div>

      <Input
        id="confirmPassword"
        type="password"
        label="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
      />

      {error && (
        <p className="text-sm text-semantic-error">{error}</p>
      )}

      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? 'Updating...' : 'Update password'}
      </Button>
    </form>
  );
}
