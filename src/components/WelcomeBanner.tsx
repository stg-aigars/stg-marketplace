'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui';

export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Alert variant="success" dismissible onDismiss={() => setDismissed(true)} className="mb-6">
      <p className="text-sm font-medium text-semantic-text-primary">
        Account created — check your email
      </p>
      <p className="mt-1 text-sm text-semantic-text-secondary">
        We sent a confirmation link to your email address.
        Click the link to activate your account and start using Second Turn Games.
      </p>
    </Alert>
  );
}
