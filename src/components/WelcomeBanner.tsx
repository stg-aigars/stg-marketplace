'use client';

import { useState } from 'react';

export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-lg border border-aurora-green/30 bg-aurora-green/10 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-semantic-text-primary">
            Account created — check your email
          </p>
          <p className="mt-1 text-sm text-semantic-text-secondary">
            We sent a confirmation link to your email address.
            Click the link to activate your account and start using Second Turn Games.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 text-semantic-text-muted sm:hover:text-semantic-text-secondary"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
