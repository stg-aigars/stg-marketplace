'use client';

import { useState } from 'react';
import { Input, Button } from '@/components/ui';
import { updatePassword } from '@/lib/auth/actions';

export function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
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
